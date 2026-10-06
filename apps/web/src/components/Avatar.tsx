import type { PublicUser } from "@secure-chat/shared";

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

interface AvatarProps {
  user: Pick<PublicUser, "name" | "online">;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
}

export function Avatar({ user, size = "md", showStatus = false }: AvatarProps) {
  return (
    <div className={`avatar-container avatar-${size}`}>
      <span className="avatar">{initials(user.name)}</span>
      {showStatus && (
        <span
          className={`status-badge ${user.online ? "online" : "offline"}`}
          title={user.online ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
