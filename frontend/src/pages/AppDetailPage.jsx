import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import api, { extractErrorMessage } from "../api/client.js";
import { LoadingRow, ErrorBanner } from "../components/StateViews.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";

export default function AppDetailPage() {
  const { appId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { clusterId, namespaceId, clusterName, namespaceName } = location.state || {};

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchApp = (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError("");
    api
      .getApp(appId)
      .then((data) => {
        setApp(data);
        setForm({
          image: data.image,
          replicas: data.replicas,
          cpu: data.cpu,
          memory: data.memory,
        });
      })
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => (isRefresh ? setRefreshing(false) : setLoading(false)));
  };

  useEffect(fetchApp, [appId]);

  const handleSave = (e) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    api
      .updateApp(appId, { ...form, replicas: Number(form.replicas) })
      .then((data) => {
        setApp(data);
        setEditing(false);
      })
      .catch((e) => setFormError(extractErrorMessage(e)))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    setDeleting(true);
    api
      .deleteApp(appId)
      .then(() => {
        if (clusterId && namespaceId) {
          navigate(`/clusters/${clusterId}/namespaces/${namespaceId}`, {
            state: { clusterName, namespaceName },
          });
        } else {
          navigate("/");
        }
      })
      .catch((e) => {
        setError(extractErrorMessage(e));
        setConfirmDelete(false);
      })
      .finally(() => setDeleting(false));
  };

  const namespaceLink =
    clusterId && namespaceId ? `/clusters/${clusterId}/namespaces/${namespaceId}` : null;

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Clusters", to: "/" },
          ...(clusterId
            ? [{ label: clusterName || `Cluster #${clusterId}`, to: `/clusters/${clusterId}` }]
            : []),
          {
            label: namespaceName || app?.namespace || "Namespace",
            to: namespaceLink,
          },
          { label: app?.name || `App #${appId}` },
        ]}
      />

      {loading ? (
        <LoadingRow label="Loading app details..." />
      ) : !app ? (
        <ErrorBanner message={error || "App not found."} />
      ) : (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {app.name}
                <StatusBadge status={app.status} />
              </h1>
              <p className="page-subtitle">
                Running in namespace <strong style={{ color: "var(--text-primary)" }}>{app.namespace}</strong>
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn" onClick={() => fetchApp(true)} disabled={refreshing}>
                {refreshing ? <span className="spinner" /> : "↻ Refresh"}
              </button>
              <button className="btn" onClick={() => setEditing((s) => !s)}>
                {editing ? "Cancel edit" : "Edit"}
              </button>
              <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </div>
          </div>

          <ErrorBanner message={error} />

          {editing && (
            <form className="form-panel" onSubmit={handleSave}>
              <h3 className="form-panel-title">Edit app configuration</h3>
              <ErrorBanner message={formError} />
              <div className="form-grid">
                <div className="field">
                  <label>Image</label>
                  <input
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Replicas</label>
                  <input
                    type="number"
                    min={1}
                    value={form.replicas}
                    onChange={(e) => setForm({ ...form, replicas: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>CPU</label>
                  <input
                    value={form.cpu}
                    onChange={(e) => setForm({ ...form, cpu: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Memory</label>
                  <input
                    value={form.memory}
                    onChange={(e) => setForm({ ...form, memory: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : "Save changes"}
                </button>
              </div>
            </form>
          )}

          <div className="detail-grid">
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 14 }}>
                Pods
              </h3>
              {app.pods && app.pods.length > 0 ? (
                <div className="pod-list">
                  {app.pods.map((pod) => (
                    <div key={pod.name} className="pod-row">
                      <span className="pod-name">{pod.name}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{pod.phase}</span>
                        <StatusBadge status={pod.ready ? "Ready" : "Not Ready"} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  No pods found yet — they may still be scheduling.
                </p>
              )}
            </div>

            <div className="card">
              <h3 className="card-title" style={{ marginBottom: 14 }}>
                Configuration
              </h3>
              <div className="stat-row">
                <span className="stat-label">Image</span>
                <span className="stat-value">{app.image}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Replicas</span>
                <span className="stat-value">{app.replicas}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">CPU</span>
                <span className="stat-value">{app.cpu}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Memory</span>
                <span className="stat-value">{app.memory}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">App ID</span>
                <span className="stat-value">#{app.id}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Delete app"
        description={`This will permanently delete "${app?.name}" from Kubernetes and from the panel's database. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        loading={deleting}
      />
    </div>
  );
}
