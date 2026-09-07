import { AlertTriangle, Inbox } from "lucide-react";

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
      <AlertTriangle size={17} />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description }) {
  return (
    <div className="state-box">
      <div className="state-icon">
        <Icon size={38} strokeWidth={1.4} />
      </div>
      <div className="state-title">{title}</div>
      {description && <div className="state-desc">{description}</div>}
    </div>
  );
}
