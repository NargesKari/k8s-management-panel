import axios from "axios";

// In dev, Vite's proxy (see vite.config.js) forwards "/backend" to the
// local Django server. In production, the same path is served by the
// Kubernetes Ingress on the same domain, so "/backend" always works as
// a relative path - no environment-specific base URL needed.
const client = axios.create({
  baseURL: "/backend",
  headers: { "Content-Type": "application/json" },
});

function extractErrorMessage(error) {
  if (error.response?.data?.detail) return error.response.data.detail;
  if (error.response?.data) return JSON.stringify(error.response.data);
  if (error.message) return error.message;
  return "Something went wrong. Please try again.";
}

export const api = {
  // Clusters
  listClusters: () => client.get("/cluster").then((r) => r.data),
  createCluster: (data) => client.post("/cluster", data).then((r) => r.data),

  // Namespaces
  listNamespaces: (clusterId) =>
    client.get("/namespace", { params: { cluster_id: clusterId } }).then((r) => r.data),
  createNamespace: (data) => client.post("/namespace", data).then((r) => r.data),
  deleteNamespace: (id) => client.delete(`/namespace/${id}`),

  // Apps
  listApps: (namespaceId) =>
    client.get("/app", { params: { namespace_id: namespaceId } }).then((r) => r.data),
  getApp: (id) => client.get(`/app/${id}`).then((r) => r.data),
  createApp: (data) => client.post("/app", data).then((r) => r.data),
  updateApp: (id, data) => client.put(`/app/${id}`, data).then((r) => r.data),
  deleteApp: (id) => client.delete(`/app/${id}`),
};

export { extractErrorMessage };
export default api;
