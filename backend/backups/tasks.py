import os
import time
import datetime

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from kubernetes.stream import stream

from kari_backend.kube_utils import core_v1
from kari_backend.metrics import (
    BACKUP_JOBS_TOTAL,
    BACKUP_DURATION_SECONDS,
    BACKUPS_IN_PROGRESS,
)

from .models import Backup, generate_backup_id


def _find_pod_for_app(core_api, app):
    pods = core_api.list_namespaced_pod(
        namespace=app.namespace.name, label_selector=f"app={app.name}"
    )
    running = [p for p in pods.items if p.status.phase == "Running"]
    if not running:
        raise RuntimeError("No running pod found for this App.")
    return running[0]


@shared_task(bind=True, max_retries=2, default_retry_delay=30)
def run_backup_task(self, backup_pk):
    backup = Backup.objects.get(pk=backup_pk)
    backup.status = Backup.Status.RUNNING
    backup.started_at = timezone.now()
    backup.save(update_fields=["status", "started_at"])

    # Concurrency gauge: incremented for the whole lifetime of the job and
    # decremented in the finally block below, so it always reflects how
    # many backups are actually executing right now.
    BACKUPS_IN_PROGRESS.inc()
    started_monotonic = time.perf_counter()

    app = backup.app
    cluster = app.namespace.cluster
    core_api = core_v1(cluster)

    date_str = datetime.date.today().isoformat()
    out_dir = os.path.join(settings.BACKUP_ROOT, str(app.id), date_str)
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"{backup.backup_id}.tar.gz")

    try:
        pod = _find_pod_for_app(core_api, app)

        exec_command = ["tar", "czf", "-", backup.source_path]
        resp = stream(
            core_api.connect_get_namespaced_pod_exec,
            pod.metadata.name,
            app.namespace.name,
            command=exec_command,
            stderr=True,
            stdin=False,
            stdout=True,
            tty=False,
            _preload_content=False,
        )

        with open(out_file, "wb") as f:
            while resp.is_open():
                resp.update(timeout=5)
                if resp.peek_stdout():
                    f.write(resp.read_stdout(binary=True))
                if resp.peek_stderr():
                    # Drain stderr (e.g. tar path warnings) - useful for debugging.
                    resp.read_stderr()
        resp.close()

        backup.status = Backup.Status.COMPLETED
        backup.file_path = out_file
        backup.finished_at = timezone.now()
        backup.save(update_fields=["status", "file_path", "finished_at"])

        BACKUP_JOBS_TOTAL.labels(outcome="completed").inc()

    except Exception as exc:
        backup.status = Backup.Status.FAILED
        backup.error_message = str(exc)
        backup.finished_at = timezone.now()
        backup.save(update_fields=["status", "error_message", "finished_at"])

        BACKUP_JOBS_TOTAL.labels(outcome="failed").inc()
        # Bounded, controlled retry; once retries are exhausted it stays failed.
        raise self.retry(exc=exc)

    finally:
        BACKUPS_IN_PROGRESS.dec()
        BACKUP_DURATION_SECONDS.observe(time.perf_counter() - started_monotonic)


@shared_task
def run_scheduled_backup(app_id, source_path):
    """Called by Celery beat according to the cron schedule; creates a new, independent Backup every time."""
    backup = Backup.objects.create(
        backup_id=generate_backup_id(), app_id=app_id, source_path=source_path
    )
    run_backup_task.delay(backup.pk)
    return backup.backup_id


@shared_task
def mark_stale_backups_as_failed():
    """
    If a Backup has stayed in pending/running for longer than
    BACKUP_PENDING_TIMEOUT_SECONDS (i.e. the worker was down or the queue
    got stuck), mark it as failed. This task should be registered as a
    periodic task in celery beat (e.g. every 15 minutes).
    """
    cutoff = timezone.now() - datetime.timedelta(
        seconds=settings.BACKUP_PENDING_TIMEOUT_SECONDS
    )
    stale = Backup.objects.filter(
        status__in=[Backup.Status.PENDING, Backup.Status.RUNNING], created_at__lt=cutoff
    )
    count = stale.update(
        status=Backup.Status.FAILED, error_message="Timeout: backup stuck too long."
    )
    return count
