import type { ReactNode } from "react";

export function LoadingSpinner({ text = "Loading…" }: { text?: string }) {
  return (
    <div className="center-state">
      <div className="spinner" />
      <p className="muted">{text}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">💬</div>
      <h3>{title}</h3>
      {description && <p className="muted">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export function ErrorBanner({
  message,
  onDismiss
}: {
  message: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div className="error-banner">
      <span>{message}</span>
      {onDismiss && (
        <button className="error-banner-close" onClick={onDismiss} type="button">
          ×
        </button>
      )}
    </div>
  );
}
