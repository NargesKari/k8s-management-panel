# Observability

Metrics, dashboards and alerting for the Kari Panel backend, built on the
VictoriaMetrics stack.

The task deliberately rules out installing the full `victoria-metrics-k8s-stack`
Helm chart. Instead only the **operator** is installed with Helm, and every
component it manages (VMSingle, VMAgent, VMAlert, Alertmanager) is declared
here as an explicit CRD manifest. That way each piece of the pipeline is
visible and version-controlled instead of hidden behind chart values.

---

## 1. The five application metrics

All five live in [`../backend/kari_backend/metrics.py`](../backend/kari_backend/metrics.py)
and are exposed on the same `/metrics` endpoint as the stock
`django-prometheus` metrics.

| Metric | Type | Labels | Question it answers |
|---|---|---|---|
| `hamamooz_kubernetes_operations_total` | counter | `resource`, `operation`, `outcome` | How many Kubernetes operations ended in each outcome? |
| `hamamooz_kubernetes_operation_duration_seconds` | histogram | `resource`, `operation`, `outcome` | How long did each Kubernetes operation take? |
| `hamamooz_backup_jobs_total` | counter | `outcome` | How many backup jobs reached each terminal outcome? |
| `hamamooz_backup_duration_seconds` | histogram | – | How long did backup work take? |
| `hamamooz_backups_in_progress` | gauge | – | How many backups are running right now? |

Label values follow the spec exactly:

- `resource`: `cluster` \| `namespace` \| `app`
- `operation`: `create` \| `list` \| `update` \| `delete`
- `outcome` (operations): `success` \| `error`
- `outcome` (backups): `completed` \| `failed`

### What each metric is actually observing

**`kubernetes_operations_total` + `kubernetes_operation_duration_seconds`**
These wrap every call the backend makes *outward to the Kubernetes API* on a
user's behalf — creating a namespace, listing apps, patching a deployment,
deleting one. Instrumentation is a context manager
(`track_kubernetes_operation`) that sets `outcome=error` automatically if the
block raises and re-raises the exception, so no existing error handling had
to change.

Together they are the classic RED signals for the panel's core job:
the counter gives **rate** and **errors**, the histogram gives **duration**.
A rising error ratio means the cluster is rejecting our calls (bad token,
missing RBAC, API server down); a rising p95 means the API server is slow
or overloaded, which users experience as a panel that hangs.

**`backup_jobs_total` + `backup_duration_seconds` + `backups_in_progress`**
These cover the asynchronous Celery side, which has no HTTP request to hang
a metric off. The counter tracks terminal outcomes, the histogram tracks how
long the tar-and-store work takes, and the gauge tracks concurrency.

The gauge is the interesting one: the backup exercise specifically asks what
to do about backups stuck in `pending`/`running` forever. `backups_in_progress`
being non-zero while `backup_jobs_total` stops increasing is exactly that
failure — a wedged queue or a dead worker — and there's an alert for that
combination (`BackupsStuck`) in [`manifests/33-vmrules.yaml`](manifests/33-vmrules.yaml).

### A note on the Celery worker

The web process and the Celery worker are **separate processes**, so backup
metrics recorded in the worker are not visible on the web app's `/metrics`.
[`../backend/kari_backend/worker_metrics.py`](../backend/kari_backend/worker_metrics.py)
starts a small HTTP server inside the worker on port `9101`, and
[`manifests/21-vmservicescrape-celery.yaml`](manifests/21-vmservicescrape-celery.yaml)
scrapes it as a second target.

---

## 2. Pipeline architecture

```
  Django backend  ──/metrics──┐
  (kari-panel ns)             │
                              ├──▶ VMAgent ──remote_write──▶ VMSingle
  Celery worker   ──/metrics──┤    (scrapes)                 (stores + serves
  (kari-panel ns)             │                               PromQL queries)
                              │                                    │
  VMSingle / VMAgent self ────┘                       ┌────────────┴────────────┐
                                                      ▼                         ▼
                                                  Grafana                    VMAlert
                                              (dashboards)              (evaluates VMRule)
                                                                              │
                                                                              ▼
                                                                        Alertmanager
                                                                              │
                                                                              ▼
                                                                     webhook receiver
                                                                       (alert-sink)
```

Which CRD does what:

- **VMSingle** — the metrics database. Single-node is right here: one small
  cluster, one team. VMCluster's sharded read/write/store split would be
  overhead with no benefit at this size.
- **VMAgent** — the collector. Discovers targets through `VMServiceScrape`
  CRDs and remote-writes into VMSingle. Nothing is scraped by VMSingle
  directly; the agent owns collection.
- **VMServiceScrape** — one per target: the backend, the Celery worker, and
  the VM components themselves (the last one is what makes the community
  VMSingle/VMAgent dashboards work).
- **VMAlert** — evaluates `VMRule` CRDs against VMSingle and pushes firing
  alerts to Alertmanager. It also remote-writes its own `ALERTS` series back
  into VMSingle so alert history is queryable, and remote-reads on startup so
  a restart doesn't reset a long-pending alert.
- **VMAlertmanager** — groups, deduplicates and routes alerts to a receiver.

---

## 3. Deploying to the cluster

Everything below runs on the control-plane node.

### 3.1 Install the operator (Helm)

```bash
helm repo add vm https://victoriametrics.github.io/helm-charts/
helm repo update

helm upgrade --install vm-operator vm/victoria-metrics-operator \
  --namespace monitoring-system \
  --create-namespace
```

Wait for it, then confirm the CRDs the operator added:

```bash
kubectl get pods -n monitoring-system -w
kubectl get crd | grep victoriametrics
```

You should see `vmsingles`, `vmagents`, `vmalerts`, `vmalertmanagers`,
`vmservicescrapes`, `vmrules` and friends. Those CRDs are what the manifests
in this folder use.

### 3.2 Grafana admin credentials

```bash
cd manifests
cp 05-grafana-secret.example.yaml 05-grafana-secret.yaml
# edit 05-grafana-secret.yaml and set a real password
kubectl apply -f 05-grafana-secret.yaml
```

`05-grafana-secret.yaml` is gitignored, so the real password never lands in
the repo.

### 3.3 Deploy the pipeline

```bash
kubectl apply -f manifests/00-namespace.yaml
kubectl apply -f manifests/10-vmsingle.yaml
kubectl apply -f manifests/11-vmagent.yaml

# wait for VMSingle and VMAgent to be running before adding scrape configs
kubectl get pods -n monitoring-system -w

kubectl apply -f manifests/20-vmservicescrape-backend.yaml
kubectl apply -f manifests/21-vmservicescrape-celery.yaml
kubectl apply -f manifests/22-vmservicescrape-vm-components.yaml
```

### 3.4 Deploy alerting

```bash
kubectl apply -f manifests/32-alert-sink.yaml
kubectl apply -f manifests/31-alertmanager.yaml
kubectl apply -f manifests/30-vmalert.yaml
kubectl apply -f manifests/33-vmrules.yaml
```

### 3.5 Deploy Grafana + dashboards

```bash
# build the dashboard ConfigMap from the JSON files, then deploy Grafana
kubectl create configmap grafana-dashboards \
  --namespace monitoring-system \
  --from-file=dashboards/ \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f manifests/40-grafana.yaml
kubectl apply -f manifests/41-grafana-ingress.yaml
```

Grafana is then reachable at **http://kari.osdl.ir/grafana**.

### 3.6 Secure the pipeline (iteration 2)

```bash
kubectl apply -f manifests/50-networkpolicies.yaml
```

See the comments in that file — on stock k3s (flannel CNI) NetworkPolicy is
not enforced, so verify before relying on it.

---

## 4. Verifying it works

### Metrics are being collected

```bash
# the backend is exposing them
kubectl exec -n kari-panel deployment/backend -- \
  python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/metrics').read().decode()[:400])"

# VMAgent has healthy targets
kubectl port-forward -n monitoring-system svc/vmagent-kari-vmagent 8429:8429
# then open http://localhost:8429/targets

# VMSingle has the data
kubectl port-forward -n monitoring-system svc/vmsingle-kari-vmsingle 8428:8429
# then: http://localhost:8428/vmui  and query  hamamooz_kubernetes_operations_total
```

`vmui` is VictoriaMetrics' own built-in query UI — the simplest visualization
path that ships with VM itself, with no Grafana required.

### Generate some traffic to see non-zero data

```bash
for i in $(seq 1 20); do curl -s http://kari.osdl.ir/backend/cluster > /dev/null; done
curl -s "http://kari.osdl.ir/backend/namespace?cluster_id=2" > /dev/null
```

Then re-query `hamamooz_kubernetes_operations_total` — the `list` operations
should now have counts.

### The alerting pipeline end to end

The `AlwaysFiring` rule (`expr: vector(1) > 0`) exists purely to prove
delivery. Follow it through each hop:

```bash
# 1. VMAlert knows about the rule and it is firing
kubectl port-forward -n monitoring-system svc/vmalert-kari-vmalert 8080:8080
# open http://localhost:8080/vmalert/alerts

# 2. Alertmanager received it
kubectl port-forward -n monitoring-system svc/vmalertmanager-kari-alertmanager 9093:9093
# open http://localhost:9093

# 3. The receiver actually got the notification
kubectl logs -n monitoring-system deployment/alert-sink -f
# expect lines like: ALERT [firing] AlwaysFiring :: Pipeline smoke test...
```

Step 3 is the one that matters — it proves the notification left
Alertmanager and arrived at a receiver, rather than just sitting in a UI.

---

## 5. Community dashboards for VMSingle and VMAgent

`22-vmservicescrape-vm-components.yaml` makes VictoriaMetrics scrape itself,
which is the prerequisite for the official dashboards. Import them in
Grafana (Dashboards → New → Import) by ID:

| Dashboard | grafana.com ID |
|---|---|
| VictoriaMetrics – single node | `10229` |
| VictoriaMetrics – vmagent | `12683` |
| VictoriaMetrics – vmalert | `14950` |

Pick the `VictoriaMetrics` datasource when prompted. If the cluster has no
egress to grafana.com, download the JSON on a machine that does, drop it
into `dashboards/`, and re-run `scripts/apply-dashboards.sh`.

---

## 6. Docker fallback

If the cluster is unavailable, the same pipeline runs locally with Compose
(the task explicitly allows this):

```bash
cd docker
docker compose up -d
```

| Service | URL |
|---|---|
| Grafana | http://localhost:3000 (admin / kari-admin-123) |
| VictoriaMetrics + vmui | http://localhost:8428/vmui |
| Alertmanager | http://localhost:9093 |

It expects the Django backend on `host.docker.internal:8000` — i.e. the
`backend/docker-compose.yml` stack running alongside it.

---

## 7. Layout

```
observability/
├── manifests/
│   ├── 00-namespace.yaml
│   ├── 05-grafana-secret.example.yaml   # copy -> 05-grafana-secret.yaml (gitignored)
│   ├── 10-vmsingle.yaml                 # metrics database
│   ├── 11-vmagent.yaml                  # collector
│   ├── 20-vmservicescrape-backend.yaml
│   ├── 21-vmservicescrape-celery.yaml
│   ├── 22-vmservicescrape-vm-components.yaml
│   ├── 30-vmalert.yaml                  # rule evaluation
│   ├── 31-alertmanager.yaml             # routing
│   ├── 32-alert-sink.yaml               # webhook receiver for verification
│   ├── 33-vmrules.yaml                  # alert rules (incl. AlwaysFiring)
│   ├── 40-grafana.yaml
│   ├── 41-grafana-ingress.yaml          # /grafana on the shared domain
│   └── 50-networkpolicies.yaml          # iteration 2: lock the pipeline down
├── dashboards/
│   └── kari-app-metrics.json            # one panel per hamamooz_* metric
├── docker/                              # Compose fallback for the whole stack
└── scripts/
    └── apply-dashboards.sh
```
