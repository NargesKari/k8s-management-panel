# k8s-management-panel

A self-service admin panel for Kubernetes: a Django API that creates real namespaces and Deployments on a target cluster, a React frontend to drive it, and a full VictoriaMetrics observability stack watching the whole thing.

## What it does

- Manages a hierarchy of **Cluster → Namespace → App**, where "App" means a real Kubernetes Deployment (image, replicas, CPU/memory requests) that the backend creates, patches, and deletes through the `kubernetes` Python client.
- Runs backups as async Celery jobs: a `POST /backup` returns immediately with a `pending` status while the actual work (an `exec` + `tar czf` inside the target pod, streamed to disk) happens in a worker. A periodic task sweeps and fails any backup stuck `pending`/`running` for 24 hours.
- Caches live pod status per app in Redis for 60 seconds instead of hitting the Kubernetes API on every page load.
- Exposes five custom Prometheus metrics (`hamamooz_kubernetes_operations_total`, `hamamooz_kubernetes_operation_duration_seconds`, plus three backup metrics) that feed a full VictoriaMetrics + VMAgent + VMAlert + Alertmanager + Grafana pipeline, deployed as explicit CRDs rather than a bundled Helm chart.
- Ships a self-contained "chaos mode" easter egg on top of the real admin UI (creatures to click, a life counter, a Sudoku puzzle to earn 30 minutes of peace) gated behind a single React context, removable in one line.

## Why it's interesting

The backend treats **the database as the source of truth**, not the live cluster: `GET /namespace` reads only from Postgres, never from the Kubernetes API directly, so the UI stays fast and doesn't hammer the control plane on every list view. Writes go cluster-first, DB-second (create in Kubernetes, then record it; delete from Kubernetes, then remove the record), and namespace deletion uses `select_for_update()` inside a transaction so two concurrent delete requests for the same namespace resolve deterministically instead of racing.

The observability side is the more unusual piece for a student project: instead of installing the all-in-one `victoria-metrics-k8s-stack` Helm chart, only the operator is installed via Helm and every component (VMSingle, VMAgent, VMAlert, Alertmanager) is declared as its own versioned CRD manifest, so the whole pipeline is inspectable in git instead of hidden behind chart values. The metrics themselves are split across two processes that don't share memory — the Django web process and the Celery worker — so the worker runs its own tiny metrics HTTP server on port 9101 that gets scraped as a second target. There's also a dedicated `backups_in_progress` gauge specifically to catch a wedged queue: non-zero and flat while the completed-jobs counter stops moving means a dead worker, and there's an alert rule for exactly that combination.

## Tech stack

**Backend:** Django 5 + Django REST Framework, PostgreSQL (SQLite fallback for local dev), Celery + Redis, `django-celery-beat` for cron-style schedules, `kubernetes` Python client, `django-prometheus`, Gunicorn.

**Frontend:** React 18 (hooks, no class components), Vite, React Router v6, Axios, hand-written CSS with a design-token system (no Tailwind/Bootstrap/component library).

**Observability:** VictoriaMetrics operator (VMSingle, VMAgent, VMAlert, VMAlertmanager as CRDs), Grafana, with a Docker Compose fallback for local runs.

**Infra:** Docker (multi-stage builds for both services), Kubernetes manifests for every component, Nginx serving the frontend build with SPA fallback routing.

## Getting started

Backend, without Docker (uses SQLite):

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Celery-backed endpoints (backups) need Redis: `docker run -p 6379:6379 redis`, or use the full stack below.

Everything together with Docker Compose:

```bash
cd backend
docker compose up --build
docker compose exec backend python manage.py migrate
```

This starts the backend (`:8000`), Postgres, Redis, a Celery worker, and Celery beat.

Frontend (needs the backend reachable at `localhost:8000`):

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. In dev, Vite proxies `/backend/*` to the Django server; in production both services sit behind the same domain via a Traefik middleware that strips the `/backend` prefix, so there's no CORS setup anywhere.

Observability stack (requires a real cluster with the VictoriaMetrics operator installed via Helm, or `cd observability/docker && docker compose up -d` for a local fallback) — see `observability/README.md` for the full deploy sequence and how to verify the alert pipeline end to end.

## Architecture

Three independently-deployable pieces share one Kubernetes cluster: the Django API (plus its Postgres, Redis, and Celery worker/beat pods), the React SPA served by Nginx, and the VictoriaMetrics observability stack in its own `monitoring-system` namespace. The backend never exposes long-running work over HTTP — anything that touches a live pod (backups) goes through Celery so the request/response cycle stays fast — and every write to Kubernetes is wrapped in a metrics context manager that records outcome and duration without changing the underlying error handling.

<!-- add screenshot/demo here -->
