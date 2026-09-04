const STATUS_MAP = {
  Ready: "success",
  Running: "success",
  active: "success",
  "Not Ready": "warning",
  Pending: "pending",
  pending: "pending",
  Failed: "danger",
  failed: "danger",
  delete_failed: "danger",
  completed: "success",
  running: "warning",
  deleting: "pending",
};

export default function StatusBadge({ status }) {
  const variant = STATUS_MAP[status] || "pending";
  return (
    <span className={`badge badge-${variant}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}
