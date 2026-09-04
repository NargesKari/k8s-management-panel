export function LoadingRow({ label = "Loading..." }) {
  return (
    <div className="loading-row">
      <span className="spinner spinner-lg" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="error-banner">
      <span>⚠️</span>
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon = "📦", title, description }) {
  return (
    <div className="state-box">
      <div className="state-icon">{icon}</div>
      <div className="state-title">{title}</div>
      {description && <div className="state-desc">{description}</div>}
    </div>
  );
}
