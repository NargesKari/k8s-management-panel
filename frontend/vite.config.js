import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, requests to /backend are proxied to the local Django server so
// the frontend can be developed without CORS or a second domain.
// In production, "/backend" is served by the same origin through the
// Kubernetes Ingress + Traefik middleware (see backend/k8s/31-ingress-backend.yaml),
// so no proxy is needed there - the browser just calls "/backend" directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/backend": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/backend/, ""),
      },
    },
  },
});
