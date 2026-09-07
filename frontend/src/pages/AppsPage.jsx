import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Rocket, Plus, X, ArrowRight, Box, Container, Cpu, MemoryStick, Layers } from "lucide-react";
import api, { extractErrorMessage } from "../api/client.js";
import { LoadingRow, ErrorBanner, EmptyState } from "../components/StateViews.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import DodgeButton from "../chaos/DodgeButton.jsx";

const emptyForm = { name: "", image: "", replicas: 1, cpu: "250m", memory: "256Mi" };

export default function AppsPage() {
  const { clusterId, namespaceId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [clusterName] = useState(location.state?.clusterName || "");
  const [namespaceName, setNamespaceName] = useState(location.state?.namespaceName || "");

  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchApps = () => {
    setLoading(true);
    setError("");
    api
      .listApps(namespaceId)
      .then(setApps)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApps();
    if (!namespaceName) {
      api
        .listNamespaces(clusterId)
        .then((list) => {
          const found = list.find((n) => String(n.id) === String(namespaceId));
          if (found) setNamespaceName(found.name);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namespaceId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.image.trim()) {
      setFormError("Name and image are required.");
      return;
    }
    setSubmitting(true);
    api
      .createApp({ ...form, namespace_id: Number(namespaceId), replicas: Number(form.replicas) })
      .then(() => {
        setForm(emptyForm);
        setShowForm(false);
        fetchApps();
      })
      .catch((e) => setFormError(extractErrorMessage(e)))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Clusters", to: "/" },
          { label: clusterName || `Cluster #${clusterId}`, to: `/clusters/${clusterId}` },
          { label: namespaceName || `Namespace #${namespaceId}` },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Apps</h1>
          <p className="page-subtitle">
            deployments in {namespaceName || `namespace #${namespaceId}`}
          </p>
        </div>
        <DodgeButton className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "New app"}
        </DodgeButton>
      </div>

      {showForm && (
        <form className="form-panel" onSubmit={handleSubmit}>
          <h3 className="form-panel-title">
            <Rocket size={14} /> Deploy a new app
          </h3>
          <ErrorBanner message={formError} />
          <div className="form-grid">
            <div className="field">
              <label>App name</label>
              <input
                placeholder="my-api"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Image</label>
              <input
                placeholder="nginx:latest"
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
                placeholder="250m"
                value={form.cpu}
                onChange={(e) => setForm({ ...form, cpu: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Memory</label>
              <input
                placeholder="256Mi"
                value={form.memory}
                onChange={(e) => setForm({ ...form, memory: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : "Deploy app"}
            </button>
          </div>
        </form>
      )}

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingRow label="Loading apps..." />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Rocket}
          title="No apps deployed yet"
          description="Deploy your first app to this namespace using the form above."
        />
      ) : (
        <div className="grid">
          {apps.map((app) => {
            const readyPods = app.pods?.filter((p) => p.ready).length || 0;
            return (
              <div
                key={app.id}
                className="card card-link"
                onClick={() =>
                  navigate(`/apps/${app.id}`, {
                    state: { clusterId, namespaceId, clusterName, namespaceName },
                  })
                }
              >
                <div className="card-header">
                  <h3 className="card-title">
                    <Box size={17} color="var(--accent-3)" />
                    {app.name}
                  </h3>
                  <StatusBadge status={app.status} />
                </div>
                <div className="card-meta">
                  <div className="card-meta-row">
                    <Container size={13} />
                    {app.image}
                  </div>
                  <div className="card-meta-row">
                    <Layers size={13} />
                    {readyPods}/{app.pods?.length ?? 0} pods · {app.replicas} replica(s)
                  </div>
                  <div className="card-meta-row">
                    <Cpu size={13} />
                    {app.cpu}
                    <MemoryStick size={13} style={{ marginLeft: 6 }} />
                    {app.memory}
                  </div>
                </div>
                <div className="card-footer">
                  <span style={{ color: "var(--text-tertiary)" }}>App #{app.id}</span>
                  <span className="go">
                    manage <ArrowRight size={13} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
