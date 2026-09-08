"""
Gunicorn configuration.

Its only job is to make prometheus_client's multiprocess mode work
correctly. With several gunicorn workers, each one keeps its own counters
in memory; without the shared multiprocess directory a scrape would hit a
random worker and report only that worker's numbers, so the metrics would
appear to jump up and down.

PROMETHEUS_MULTIPROC_DIR points all workers at one shared directory.
django-prometheus detects that variable and serves an aggregated registry
on /metrics. The two hooks below keep that directory consistent:

  on_starting  - wipe stale files left behind by a previous container
  child_exit   - drop a dead worker's samples so gauges stay accurate
"""
import os
import shutil

_MULTIPROC_DIR = os.environ.get("PROMETHEUS_MULTIPROC_DIR")


def on_starting(server):
    if not _MULTIPROC_DIR:
        return
    if os.path.isdir(_MULTIPROC_DIR):
        shutil.rmtree(_MULTIPROC_DIR, ignore_errors=True)
    os.makedirs(_MULTIPROC_DIR, exist_ok=True)


def child_exit(server, worker):
    if not _MULTIPROC_DIR:
        return
    from prometheus_client import multiprocess

    multiprocess.mark_process_dead(worker.pid)
