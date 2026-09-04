import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { extractErrorMessage } from "../api/client.js";
import { LoadingRow, ErrorBanner, EmptyState } from "../components/StateViews.jsx";
import DodgeButton from "../chaos/DodgeButton.jsx";

export default function ClustersPage() {
  const navigate = useNavigate();
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", token: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchClusters = () => {
    setLoading(true);
    setError("");
    api
      .listClusters()
      .then(setClusters)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(fetchClusters, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.address || !form.token) {
      setFormError("All fields are required.");
      return;
    }
    setSubmitting(true);
    api
      .createCluster(form)
      .then(() => {
        setForm({ name: "", address: "", token: "" });
        setShowForm(false);
        fetchClusters();
      })
      .catch((e) => setFormError(extractErrorMessage(e)))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Clusters</h1>
          <p className="page-subtitle">
            Kubernetes clusters registered with this panel. Select one to manage its namespaces.
          </p>
        </div>
        <DodgeButton className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New cluster"}
        </DodgeButton>
      </div>

      {showForm && (
        <form className="form-panel" onSubmit={handleSubmit}>
          <h3 className="form-panel-title">Register a new cluster</h3>
          <ErrorBanner message={formError} />
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input
                placeholder="production-cluster"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>API server address</label>
              <input
                placeholder="95.38.190.240:6443"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Service account token</label>
              <input
                type="password"
                placeholder="eyJhbGciOi..."
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : "Create cluster"}
            </button>
          </div>
        </form>
      )}

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingRow label="Loading clusters..." />
      ) : clusters.length === 0 ? (
        <EmptyState
          icon="🗂️"
          title="No clusters yet"
          description="Register your first cluster's API address and service account token to get started."
        />
      ) : (
        <div className="grid">
          {clusters.map((c) => (
            <div
              key={c.id}
              className="card card-link"
              onClick={() => navigate(`/clusters/${c.id}`, { state: { clusterName: c.name } })}
            >
              <div className="card-header">
                <h3 className="card-title">{c.name}</h3>
              </div>
              <div className="card-meta">
                <div className="card-meta-row mono">{c.address}</div>
              </div>
              <div className="card-footer">
                <span style={{ fontSize: 12.5, color: "var(--text-tertiary)" }}>
                  Cluster #{c.id}
                </span>
                <span style={{ fontSize: 13, color: "var(--accent)" }}>View namespaces →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
