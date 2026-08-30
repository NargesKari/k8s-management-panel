# kari-backend

Django backend for managing Cluster / Namespace / App resources on
Kubernetes, plus an immediate and scheduled Backup feature built on Celery.

## Tech stack

- Django + Django REST Framework (plain `APIView`s, no ViewSets/routers)
- PostgreSQL (SQLite fallback for local development without Docker)
- Celery + Redis (async task execution, periodic scheduling via
  `django-celery-beat`)
- `kubernetes` Python client (talks to the target cluster using the
  address/token stored on each `Cluster` record)

## Project layout

```
backend/
├── kari_backend/     # project settings, urls, celery app, kube client helper
├── clusters/         # Cluster CRUD (DB-only, no Kubernetes connection)
├── namespaces/       # Namespace CRUD (real Kubernetes connection)
├── k8sapps/          # App CRUD (Deployment management + live pod status)
├── backups/          # Immediate + scheduled Backup via Celery
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Running locally (no Docker)

```bash
python -m venv venv
source venv/bin/activate      
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

This uses SQLite, so you can test the Cluster/Namespace/App endpoints with
Postman right away. Celery-dependent endpoints (backups) need a running
Redis instance - either start one locally (`docker run -p 6379:6379 redis`)
or use the full Docker Compose setup below.

## Running everything together with Docker Compose

```bash
docker compose up --build
docker compose exec backend python manage.py migrate
```

Services:
- `backend`        → http://localhost:8000
- `db`             → PostgreSQL
- `redis`          → Redis (Celery broker + App status cache)
- `celery-worker`  → executes the actual backup work
- `celery-beat`    → triggers scheduled (cron) backups

## API overview

### Cluster (`clusters` app)
| Method | Path | Notes |
|---|---|---|
| POST | `/cluster` | Stores the cluster in the DB only. Does **not** connect to Kubernetes. |
| GET | `/cluster` | Returns all clusters. `token` is never included in the response. |

### Namespace (`namespaces` app)
| Method | Path | Notes |
|---|---|---|
| POST | `/namespace` | `{cluster_id, name}`. Creates the namespace in Kubernetes, then records it in the DB. Returns 409 if it already exists, 404 if the cluster is unknown, 502 if Kubernetes is unreachable. |
| GET | `/namespace?cluster_id=<id>` | Reads only from the database (Source of Truth = Database), not from Kubernetes directly. |
| DELETE | `/namespace/<id>` | Deletes from Kubernetes, then from the DB. Handles concurrent deletes (see below). |

### App (`k8sapps` app)
| Method | Path | Notes |
|---|---|---|
| POST | `/app` | `{namespace_id, name, image, replicas, cpu, memory}`. Creates a real Deployment. |
| GET | `/app?namespace_id=<id>` | Lists Apps in a namespace, each with a live pod status fetched from Kubernetes (cached in Redis for 60s). |
| GET | `/app/<id>` | Detail view, same live status logic. |
| PUT | `/app/<id>` | Updates image/replicas/cpu/memory and patches the Deployment. |
| DELETE | `/app/<id>` | Deletes the Deployment from Kubernetes, then the DB record. |

### Backup (`backups` app)
| Method | Path | Notes |
|---|---|---|
| POST | `/backup` | `{app_id, source_path}` → immediate backup, returns `{backup_id, status: "pending"}` right away and runs the actual work in a Celery task. `{app_id, source_path, schedule}` (cron string) → registers a recurring schedule via `django-celery-beat` instead; every trigger creates its own independent Backup record. |
| GET | `/backup/<backup_id>` | Returns `{backup_id, app_id, status}`. |
| GET | `/backup?app_id=<id>` | Lists all backups for an app with `{backup_id, status}`. |

## Notable implementation details

- **Token security**: `ClusterListSerializer` deliberately excludes `token`
  so it can never appear in a response, and it is never logged anywhere.
- **Source of Truth = Database**: `NamespaceListCreateView.get` only reads
  from the DB, never directly from the live cluster state.
- **Namespace delete race condition**: handled with `select_for_update()`
  inside a DB transaction in `NamespaceDeleteView`. Whichever request
  arrives first wins; the second request finds no row left and gets a 404.
- **Backup response is decoupled from execution**: `BackupListCreateView.post`
  only creates a `pending` row and calls `run_backup_task.delay(...)`; the
  HTTP request does not wait for the backup to finish.
- **Stuck backups**: the periodic task `mark_stale_backups_as_failed` (needs
  to be scheduled, e.g. every 15 minutes, via Django Admin → Periodic Tasks)
  marks any backup still `pending`/`running` after 24 hours as `failed`.
- **Redis status cache (bonus)**: implemented in `k8sapps/k8s_helpers.py`
  with a 60-second TTL, scoped only to App status, not to core backup data.

## Known limitations / things to verify against a real cluster

- `run_backup_task` uses `kubernetes.stream.stream` to `exec` a `tar czf`
  command inside a running pod and stream the bytes to a local file. This
  needs to be tested against a real pod; you may need to grant the backend's
  service account RBAC permissions for `pods/exec` (`get`, `list`, `create`).
- The service account the backend uses to talk to Kubernetes needs
  sufficient RBAC permissions to create/delete namespaces and deployments.
