import os
import datetime
import base64

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from kubernetes.stream import stream

from kari_backend.kube_utils import core_v1

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

    app = backup.app
    cluster = app.namespace.cluster
    core_api = core_v1(cluster)

    date_str = datetime.date.today().isoformat()
    out_dir = os.path.join(settings.BACKUP_ROOT, str(app.id), date_str)
    os.makedirs(out_dir, exist_ok=True)
    out_file = os.path.join(out_dir, f"{backup.backup_id}.tar.gz")

    try:
        pod = _find_pod_for_app(core_api, app)

        exec_command = ["sh", "-c", f"tar czf - {backup.source_path} | base64"]
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

        b64_chunks = []
        while resp.is_open():
            resp.update(timeout=5)
            if resp.peek_stdout():
                b64_chunks.append(resp.read_stdout())
            if resp.peek_stderr():
                # Drain stderr (e.g. tar path warnings) - useful for debugging.
                resp.read_stderr()
        resp.close()

        raw_bytes = base64.b64decode("".join(b64_chunks))
        with open(out_file, "wb") as f:
            f.write(raw_bytes)

        backup.status = Backup.Status.COMPLETED
        backup.file_path = out_file
        backup.finished_at = timezone.now()
        backup.save(update_fields=["status", "file_path", "finished_at"])

    except Exception as exc:
        backup.status = Backup.Status.FAILED
        backup.error_message = str(exc)
        backup.finished_at = timezone.now()
        backup.save(update_fields=["status", "error_message", "finished_at"])
        # Bounded, controlled retry; once retries are exhausted it stays failed.
        raise self.retry(exc=exc)


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
