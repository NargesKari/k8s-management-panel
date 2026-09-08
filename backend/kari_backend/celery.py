import os
from celery import Celery
from celery.signals import worker_process_init

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "kari_backend.settings")

app = Celery("kari_backend")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@worker_process_init.connect
def _start_metrics_server(**_kwargs):
    """Expose backup metrics from inside the Celery worker (see worker_metrics)."""
    from kari_backend.worker_metrics import start_worker_metrics_server

    start_worker_metrics_server()
