# kari-panel-frontend

A React + Vite admin panel for managing Kubernetes Clusters, Namespaces, and
Apps through the [kari-backend](../backend) API. Built with a dark,
modern UI and no external component library — all styling is hand-written
CSS using a small design-token system.

## Tech stack

- **React 18** with function components and hooks only
- **Vite** as the build tool / dev server
- **React Router v6** for client-side routing (the bonus requirement from
  the assignment) — URLs mirror the Cluster → Namespace → App hierarchy
- **Axios** for HTTP requests
- Plain CSS (`src/styles/index.css`) with CSS custom properties for
  colors, spacing, and radii — no Tailwind/Bootstrap/Ant Design

## Project layout

```
frontend/
├── src/
│   ├── api/
│   │   └── client.js         # axios instance + one function per endpoint
│   ├── components/
│   │   ├── Breadcrumb.jsx    # Clusters / ClusterName / NamespaceName trail
│   │   ├── ConfirmModal.jsx  # reusable "are you sure?" dialog
│   │   ├── StateViews.jsx    # LoadingRow, ErrorBanner, EmptyState
│   │   └── StatusBadge.jsx   # colored pill for Ready/Pending/Failed/etc.
│   ├── pages/
│   │   ├── ClustersPage.jsx      # "/"                                       — list + create clusters
│   │   ├── NamespacesPage.jsx    # "/clusters/:clusterId"                    — list + create + delete namespaces
│   │   ├── AppsPage.jsx          # "/clusters/:clusterId/namespaces/:namespaceId" — list + create apps
│   │   └── AppDetailPage.jsx     # "/apps/:appId"                            — view, edit, delete a single app + live pod status
│   ├── styles/
│   │   └── index.css         # design tokens + all component styles
│   ├── App.jsx                # <Routes> definitions + top bar
│   └── main.jsx                # React root, wraps <App> in <BrowserRouter>
├── index.html
├── vite.config.js
├── nginx.conf                 # SPA fallback routing for production
├── Dockerfile                 # multi-stage: node build → nginx serve
└── k8s/
    └── 20-frontend.yaml        # Deployment + Service for the cluster
```

## How each part of the assignment was implemented

| Requirement | Where |
|---|---|
| List clusters | `ClustersPage.jsx` — grid of cards, one per cluster |
| Select a cluster → see its namespaces | Clicking a cluster card navigates to `/clusters/:clusterId` |
| List namespaces (with app count `∅` shown implicitly by re-fetch) | `NamespacesPage.jsx` |
| Create a namespace, list refreshes after success | `NamespacesPage.jsx` form + `fetchNamespaces()` re-run on success |
| Delete a namespace, with confirmation | `NamespacesPage.jsx` + `ConfirmModal` |
| List apps in a namespace | `AppsPage.jsx` |
| Create an app (name, image, replicas, CPU, memory) | `AppsPage.jsx` form |
| App detail page | `AppDetailPage.jsx` |
| Show app status (Running/Pending/Not Ready/Failed) with a badge | `StatusBadge.jsx`, used on cluster/namespace/app cards and on each pod row |
| Show per-pod status if the backend provides it | `AppDetailPage.jsx` "Pods" panel — one row per pod with phase + ready badge |
| Edit an app (image/replicas/CPU/memory), UI updates after save | `AppDetailPage.jsx` inline edit form |
| Delete an app, with confirmation, list updates after | `AppDetailPage.jsx` + `ConfirmModal`, navigates back to the app list on success |
| Loading and error states | `StateViews.jsx` (`LoadingRow`, `ErrorBanner`) used on every page |
| Empty states | `EmptyState` in `StateViews.jsx` — shown when a cluster/namespace/app list is empty |
| Componentized, reusable UI | `Breadcrumb`, `ConfirmModal`, `StatusBadge`, `StateViews` are shared across all four pages |
| React Router bonus | Implemented — see routes below |

## Routes

```
/                                                  → Clusters list
/clusters/:clusterId                               → Namespaces of that cluster
/clusters/:clusterId/namespaces/:namespaceId       → Apps in that namespace
/apps/:appId                                       → App detail (view / edit / delete)
```

Navigating from one page to the next passes the parent's name (e.g. cluster
name, namespace name) via React Router's `location.state`, so breadcrumbs
render instantly without an extra request. If a page is opened directly by
URL (no `state`, e.g. a bookmark or page refresh), it falls back to
fetching the parent list and looking up the name by id — so every route
also works standalone.

## How it talks to the backend

`src/api/client.js` creates a single axios instance with `baseURL: "/backend"`.
That's it — no environment variable to configure per environment, because:

- **In development**, `vite.config.js` proxies any request to `/backend/*`
  to `http://localhost:8000/*` (stripping the `/backend` prefix), so the
  Django dev server can run locally exactly as documented in the backend's
  own README.
- **In production**, the app is served from the same domain as the backend
  (`kari.osdl.ir`). A Traefik `Middleware` + `Ingress` pair
  (`backend/k8s/30-backend-middleware.yaml` and `31-ingress-backend.yaml`)
  strips the `/backend` prefix at the cluster's edge before forwarding to
  `backend-service`, so the browser only ever needs to know about
  `/backend` as a same-origin path — no CORS configuration needed anywhere.

## Running locally

Requires the backend to be reachable at `http://localhost:8000` (e.g. via
`docker compose up` in `../backend`).

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Building for production

```bash
npm run build
```

Output goes to `dist/`. The Dockerfile does this automatically as part of
the image build (see below) — you normally don't need to run this by hand.

## Building and deploying the Docker image

```bash
docker build -t ghcr.io/nargeskari/kari-frontend:latest .
docker push ghcr.io/nargeskari/kari-frontend:latest
```

The image is a two-stage build: Node builds the static Vite bundle, then an
Nginx image serves it. `nginx.conf` includes a SPA fallback
(`try_files $uri $uri/ /index.html`) so that client-side routes like
`/clusters/5/namespaces/3` don't 404 on a hard refresh.

## Deploying to the cluster

```bash
kubectl apply -f k8s/20-frontend.yaml
kubectl apply -f ../backend/k8s/32-ingress-frontend.yaml   # routes "/" on kari.osdl.ir to this service
```

After that, the whole app is reachable at a single address:

- `http://kari.osdl.ir/` → this frontend
- `http://kari.osdl.ir/backend/...` → the Django API

## "Chaos mode" (an easter egg)

Because a plain admin panel is boring, this build ships with a small,
self-contained set of playful UI behaviors, all under `src/chaos/`:

- **`Creature.jsx`** — an original cute blob-creature (see `CreatureSvg.jsx`;
  it is *not* a reproduction of any copyrighted character) peeks out from a
  random edge of the screen roughly every 7–13 seconds, wiggles for a
  couple of seconds, then retreats.
- **`DodgeButton.jsx`** — wraps the three main "+ New ..." buttons
  (create cluster / namespace / app). Whenever the cursor gets close, the
  button jumps to a random nearby spot. Because the jump target is random
  rather than deliberately pointer-avoiding, it occasionally lands right
  under the cursor — which is the only moment it can actually be clicked.
- **`ChaosButton.jsx` + `SudokuModal.jsx`** — a red 🛑 button fixed to the
  bottom-right corner opens a classic 9×9 Sudoku. Solving it calls
  `disableChaos(30)`, which pauses the creature and the dodging buttons for
  30 minutes (persisted in `localStorage`, so it survives a page refresh).

All of this is gated by a single `ChaosContext` (`chaos/ChaosContext.jsx`),
so disabling or removing the whole feature is a one-line change: drop
`<ChaosProvider>` from `main.jsx` and the `<Creature />` / `<ChaosButton />`
tags from `App.jsx`.

## Design notes


The UI uses a single dark theme defined entirely with CSS custom properties
at the top of `src/styles/index.css` (`--bg-*`, `--text-*`, `--accent*`,
status colors, radii, shadows). Changing the look and feel — e.g. swapping
the accent gradient or moving to a light theme — only requires editing
that `:root` block; no component file needs to change.
