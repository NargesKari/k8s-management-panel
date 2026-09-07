import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { FolderTree, Plus, X, ArrowRight, Trash2, FolderPlus } from "lucide-react";
import api, { extractErrorMessage } from "../api/client.js";
import { LoadingRow, ErrorBanner, EmptyState } from "../components/StateViews.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Breadcrumb from "../components/Breadcrumb.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import DodgeButton from "../chaos/DodgeButton.jsx";

export default function NamespacesPage() {
  const { clusterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [clusterName, setClusterName] = useState(location.state?.clusterName || "");
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNamespaces = () => {
    setLoading(true);
    setError("");
    api
      .listNamespaces(clusterId)
      .then(setNamespaces)
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchNamespaces();
    if (!clusterName) {
      api
        .listClusters()
        .then((list) => {
          const found = list.find((c) => String(c.id) === String(clusterId));
          if (found) setClusterName(found.name);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Namespace name is required.");
      return;
    }
    setSubmitting(true);
    api
      .createNamespace({ cluster_id: Number(clusterId), name: name.trim() })
      .then(() => {
        setName("");
        setShowForm(false);
        fetchNamespaces();
      })
      .catch((e) => setFormError(extractErrorMessage(e)))
      .finally(() => setSubmitting(false));
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    api
      .deleteNamespace(deleteTarget.id)
      .then(() => {
        setDeleteTarget(null);
        fetchNamespaces();
      })
      .catch((e) => setError(extractErrorMessage(e)))
      .finally(() => setDeleting(false));
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Clusters", to: "/" },
          { label: clusterName || `Cluster #${clusterId}` },
        ]}
      />

      <div className="page-header">
        <div>
          <h1 className="page-title">Namespaces</h1>
          <p className="page-subtitle">
            managed by this panel inside {clusterName || `cluster #${clusterId}`}
          </p>
        </div>
        <DodgeButton className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? "Cancel" : "New namespace"}
        </DodgeButton>
      </div>

      {showForm && (
        <form className="form-panel" onSubmit={handleSubmit}>
          <h3 className="form-panel-title">
            <FolderPlus size={14} /> Create a namespace
          </h3>
          <ErrorBanner message={formError} />
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input placeholder="staging" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="spinner" /> : "Create namespace"}
            </button>
          </div>
        </form>
      )}

      <ErrorBanner message={error} />

      {loading ? (
        <LoadingRow label="Loading namespaces..." />
      ) : namespaces.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No namespaces yet"
          description="Create a namespace to start deploying apps into this cluster."
        />
      ) : (
        <div className="grid">
          {namespaces.map((ns) => (
            <div key={ns.id} className="card">
              <div
                className="card-link"
                onClick={() =>
                  navigate(`/clusters/${clusterId}/namespaces/${ns.id}`, {
                    state: { clusterName, namespaceName: ns.name },
                  })
                }
              >
                <div className="card-header">
                  <h3 className="card-title">
                    <FolderTree size={17} color="var(--accent-2)" />
                    {ns.name}
                  </h3>
                  <StatusBadge status={ns.status} />
                </div>
                <div className="card-meta">
                  <div className="card-meta-row">namespace #{ns.id}</div>
                </div>
              </div>
              <div className="card-actions">
                <button
                  className="btn btn-sm"
                  onClick={() =>
                    navigate(`/clusters/${clusterId}/namespaces/${ns.id}`, {
                      state: { clusterName, namespaceName: ns.name },
                    })
                  }
                >
                  apps <ArrowRight size={12} />
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(ns)}>
                  <Trash2 size={12} /> delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete namespace"
        description={`This will permanently delete "${deleteTarget?.name}" from Kubernetes and from the panel's database. This cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
