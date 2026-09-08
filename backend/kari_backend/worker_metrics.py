"""
Celery workers are separate processes from the Django web server, so the
backup metrics they record are not visible on the web app's /metrics
endpoint. This module starts a small HTTP server inside the worker that
exposes those metrics on their own port, so VMAgent can scrape the worker
directly (see observability/manifests/21-vmservicescrape-celery.yaml).

Two details make this correct under Celery's default prefork pool:

  * Only one process can bind the port. Whichever child wins the race
    serves the endpoint; the others log and move on.
  * That one process must not serve its *own* registry, or it would report
    the metrics of a single fork out of many. When PROMETHEUS_MULTIPROC_DIR
    is set, every fork writes its samples into that shared directory and
    the server below serves a MultiProcessCollector registry that adds
    them all together.

Wired up via Celery's worker_process_init signal in kari_backend/celery.py.
"""
import os
import logging

from prometheus_client import CollectorRegistry, start_http_server, multiprocess, REGISTRY

logger = logging.getLogger(__name__)

_started = False


def _build_registry():
    """Aggregated registry in multiprocess mode, plain default registry otherwise."""
    multiproc_dir = os.environ.get("PROMETHEUS_MULTIPROC_DIR")
    if not multiproc_dir:
        return REGISTRY
    os.makedirs(multiproc_dir, exist_ok=True)
    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry, path=multiproc_dir)
    return registry


def start_worker_metrics_server():
    global _started
    if _started:
        return
    port = int(os.environ.get("CELERY_METRICS_PORT", "9101"))
    try:
        start_http_server(port, registry=_build_registry())
        _started = True
        logger.info("Celery metrics server listening on :%s", port)
    except OSError as exc:
        # With prefork concurrency several child processes start up at once
        # and only the first one can bind the port. That is expected and
        # harmless: the process that owns the port serves the shared
        # multiprocess registry, which already includes every fork.
        logger.info("Celery metrics server not started in this process: %s", exc)
