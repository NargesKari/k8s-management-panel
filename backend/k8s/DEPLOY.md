# Deploying kari-backend to Kubernetes

Run everything below **on ha1** (the control-plane node), after `git pull`.

## 0. Prerequisites (one-time)

```bash
# log in to GitHub Container Registry
echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u <your-github-username> --password-stdin
```

## 1. Build and push the image

```bash
cd backend   # or kari-backend, depending on what you renamed it to
docker build -t ghcr.io/NargesKari/kari-backend:latest .
docker push ghcr.io/NargesKari/kari-backend:latest
```

Remember to make the package **public** on GitHub the first time
(GitHub profile → Packages → kari-backend → Package settings → Change
visibility), otherwise Kubernetes will get `ImagePullBackOff`.

## 2. Create the namespace

```bash
kubectl apply -f k8s/00-namespace.yaml
```

## 3. Create the secret (NOT committed to git)

```bash
cp k8s/06-secret.example.yaml k8s/06-secret.yaml
# edit k8s/06-secret.yaml and set real values for POSTGRES_PASSWORD and DJANGO_SECRET_KEY
kubectl apply -f k8s/06-secret.yaml
```

## 4. Apply the config map, storage, and Postgres/Redis

```bash
kubectl apply -f k8s/05-configmap.yaml
kubectl apply -f k8s/10-postgres-pvc.yaml
kubectl apply -f k8s/11-postgres.yaml
kubectl apply -f k8s/12-redis.yaml
```

Wait until both are running:
```bash
kubectl get pods -n kari-panel -w
```

## 5. Run database migrations (one-off Job)

```bash
kubectl apply -f k8s/15-migrate-job.yaml
kubectl logs -n kari-panel job/backend-migrate -f
```

If you need to re-run it later (e.g. after adding new migrations):
```bash
kubectl delete job backend-migrate -n kari-panel
kubectl apply -f k8s/15-migrate-job.yaml
```

## 6. Deploy the backend and Celery

```bash
kubectl apply -f k8s/21-backups-pvc.yaml
kubectl apply -f k8s/20-backend.yaml
kubectl apply -f k8s/22-celery-worker.yaml
kubectl apply -f k8s/23-celery-beat.yaml
```

## 7. Check everything is up

```bash
kubectl get all -n kari-panel
kubectl logs -n kari-panel deployment/backend
```

## 8. After pushing a new image (`:latest` tag)

Kubernetes will not automatically notice a new `:latest` image was pushed.
After every `docker push`, restart the relevant deployment(s):

```bash
kubectl rollout restart deployment/backend -n kari-panel
kubectl rollout restart deployment/celery-worker -n kari-panel
kubectl rollout restart deployment/celery-beat -n kari-panel
```

## 9. Ingress

The Ingress connecting `api.kari.osdl.ir` to `backend-service` is added in a
later step, once the DNS record for `api.kari.osdl.ir` is confirmed to be
propagated and the frontend is ready to go alongside it.
