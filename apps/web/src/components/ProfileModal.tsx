import type { AccountUser } from "@secure-chat/shared";
import { Avatar } from "./Avatar";

interface ProfileModalProps {
  user: AccountUser;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export function ProfileModal({ user, isOpen, onClose, onLogout }: ProfileModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Your Profile</h3>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="profile-body">
          <div className="profile-identity">
            <Avatar user={user} size="lg" showStatus />
            <div className="profile-names">
              <h2>{user.name}</h2>
              <p className="muted">@{user.username}</p>
            </div>
          </div>

          <div className="profile-details-list">
            <div className="detail-item">
              <span className="detail-label">Email</span>
              <span className="detail-value">{user.email}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Account Status</span>
              <span className="detail-value">
                <span className="badge-online">Active / Online</span>
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Current Phase</span>
              <span className="detail-value">Phase 1 (Core Web Chat)</span>
            </div>
          </div>

          <div className="profile-notice">
            <strong>About Phase 1:</strong>
            <p className="muted small">
              This is the foundational text communication tier. Future phases will introduce
              secure media viewing, optical anti-capture rendering, and native platform protection.
            </p>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn-danger" onClick={onLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
