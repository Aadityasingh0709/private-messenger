import type { PublicUser } from "@secure-chat/shared";
import { Avatar } from "./Avatar";

interface NavigationProps {
  currentUser: PublicUser;
  onOpenProfile: () => void;
  onLogout: () => void;
}

export function Navigation({ currentUser, onOpenProfile, onLogout }: NavigationProps) {
  return (
    <header className="sidebar-navigation">
      <div className="nav-profile-trigger" onClick={onOpenProfile} role="button" tabIndex={0}>
        <Avatar user={currentUser} size="sm" showStatus />
        <div className="nav-user-text">
          <span className="nav-user-name">{currentUser.name}</span>
          <span className="nav-user-status muted small">Online</span>
        </div>
      </div>

      <div className="nav-actions">
        <button
          type="button"
          className="btn-icon"
          onClick={onOpenProfile}
          title="Account profile & settings"
          aria-label="Profile"
        >
          ⚙️
        </button>
        <button
          type="button"
          className="btn-icon-subtle"
          onClick={onLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
