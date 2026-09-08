"""
Custom application metrics exposed on /metrics alongside the default
django-prometheus ones.

Naming and label conventions follow the observability task spec:

  hamamooz_kubernetes_operations_total          counter
  hamamooz_kubernetes_operation_duration_seconds histogram
  hamamooz_backup_jobs_total                    counter
  hamamooz_backup_duration_seconds              histogram
  hamamooz_backups_in_progress                  gauge

What each one is for
--------------------
* kubernetes_operations_total / _duration_seconds
  Every call this backend makes *to the Kubernetes API* on behalf of a user
  (creating a namespace, listing apps, patching a deployment, deleting
  something) is recorded here. The counter answers "how many operations
  ended in success vs error, broken down by which resource and which verb",
  which is the availability/error-rate signal for the panel. The histogram
  answers "how long did those calls take", which is the latency signal -
  it makes a slow or flaky API server visible before users complain.

* backup_jobs_total / backup_duration_seconds / backups_in_progress
  These cover the asynchronous Celery side. The counter tracks terminal
  outcomes (completed vs failed), the histogram tracks how long the actual
  tar-and-store work takes, and the gauge tracks concurrency right now.
  Together they answer "is the backup subsystem healthy, is it getting
  slower, and is work piling up in the worker?" - the gauge in particular
  is what would reveal backups stuck in `running` (the exact failure mode
  the backup exercise asks us to handle).
"""
import time
from contextlib import contextmanager

from prometheus_client import Counter, Histogram, Gauge

# --- Kubernetes API operations -------------------------------------------

KUBERNETES_OPERATIONS_TOTAL = Counter(
    "hamamooz_kubernetes_operations_total",
    "Total Kubernetes operations performed by the backend, by outcome.",
    ["resource", "operation", "outcome"],
)

KUBERNETES_OPERATION_DURATION_SECONDS = Histogram(
    "hamamooz_kubernetes_operation_duration_seconds",
    "Duration of Kubernetes operations performed by the backend.",
    ["resource", "operation", "outcome"],
    buckets=(0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
)


@contextmanager
def track_kubernetes_operation(resource, operation):
    """
    Wrap a block that talks to the Kubernetes API.

    `resource` is one of: cluster, namespace, app
    `operation` is one of: create, list, update, delete

    The outcome label is set automatically: "error" if the block raised,
    "success" otherwise. The exception is always re-raised, so view code
    keeps its existing error handling untouched.
    """
    start = time.perf_counter()
    outcome = "success"
    try:
        yield
    except Exception:
        outcome = "error"
        raise
    finally:
        elapsed = time.perf_counter() - start
        KUBERNETES_OPERATIONS_TOTAL.labels(
            resource=resource, operation=operation, outcome=outcome
        ).inc()
        KUBERNETES_OPERATION_DURATION_SECONDS.labels(
            resource=resource, operation=operation, outcome=outcome
        ).observe(elapsed)


# --- Backup jobs ----------------------------------------------------------

BACKUP_JOBS_TOTAL = Counter(
    "hamamooz_backup_jobs_total",
    "Total backup jobs that reached a terminal state, by outcome.",
    ["outcome"],  # completed | failed
)

BACKUP_DURATION_SECONDS = Histogram(
    "hamamooz_backup_duration_seconds",
    "Duration of backup jobs, from task start to terminal state.",
    buckets=(0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0),
)

BACKUPS_IN_PROGRESS = Gauge(
    "hamamooz_backups_in_progress",
    "Number of backup jobs currently running.",
    multiprocess_mode="livesum",
)
