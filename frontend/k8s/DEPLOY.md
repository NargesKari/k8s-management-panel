# Deploying the frontend to Kubernetes

Run everything below **on ha1**, after `git pull` (make sure you've pushed
the frontend code from your local machine first).

## 1. Build and push the image

```bash
cd frontend
docker build -t ghcr.io/nargeskari/kari-frontend:latest .
docker push ghcr.io/nargeskari/kari-frontend:latest
```

Make the package **public** the first time (same as you did for
kari-backend): GitHub → your profile → Packages → kari-frontend →
Package settings → Change visibility → Public. Otherwise Kubernetes gets
`ImagePullBackOff`.

## 2. Deploy the frontend

```bash
kubectl apply -f k8s/20-frontend.yaml
```

## 3. Wire up the two routes on kari.osdl.ir

Run these from the `backend` directory (that's where the Ingress files
live, since they were created alongside the backend's own `/backend`
route):

```bash
cd ../backend
kubectl apply -f k8s/32-ingress-frontend.yaml          # "/"          -> frontend
kubectl apply -f k8s/33-ingress-frontend-alias.yaml     # "/frontend"  -> frontend (same app, alternate URL)
```

(`k8s/31-ingress-backend.yaml` for `/backend` should already be applied
from the backend deploy - if not, apply that too.)

## 4. Check everything

```bash
kubectl get all -n kari-panel
kubectl get ingress -n kari-panel
```

Then from anywhere (not just ha1):

```bash
curl -I http://kari.osdl.ir/
curl -I http://kari.osdl.ir/frontend
curl http://kari.osdl.ir/backend/cluster
```

All three should respond (200 for the first two, a JSON array for the
third) - at that point the whole thing (frontend at both `/` and
`/frontend`, backend at `/backend`) is live.

## 5. After pushing a new frontend image later

```bash
kubectl rollout restart deployment/frontend -n kari-panel
```
