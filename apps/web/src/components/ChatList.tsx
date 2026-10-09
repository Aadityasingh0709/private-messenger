import type { ConversationDto, MessageDto, PublicUser } from "@secure-chat/shared";
import { Avatar } from "./Avatar";

interface ChatItemProps {
  conversation: ConversationDto;
  currentUser: PublicUser;
  isSelected: boolean;
  onSelect: (c: ConversationDto) => void;
}

function formatChatTime(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatSnippet(lastMsg: MessageDto, currentUserId: string): string {
  let content = "";
  if (lastMsg.type === "image") {
    content = lastMsg.text ? `📷 ${lastMsg.text}` : "📷 Photo";
  } else if (lastMsg.type === "video") {
    content = lastMsg.text ? `🎥 ${lastMsg.text}` : "🎥 Video";
  } else {
    content = lastMsg.text || "Message";
  }

  if (lastMsg.senderId === currentUserId) {
    return `You: ${content}`;
  }
  return content;
}

export function ChatItem({
  conversation,
  currentUser,
  isSelected,
  onSelect
}: ChatItemProps) {
  const otherUser = conversation.participants.find((p) => p.id !== currentUser.id);
  if (!otherUser) return null;

  const lastMsg = conversation.lastMessage;
  const timeStr = formatChatTime(conversation.lastMessageAt ?? conversation.updatedAt);

  return (
    <button
      type="button"
      className={`chat-item-row ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(conversation)}
    >
      <Avatar user={otherUser} showStatus size="md" />
      <div className="chat-item-content">
        <div className="chat-item-top">
          <span className="chat-item-name">{otherUser.name}</span>
          {timeStr && <span className="chat-item-time">{timeStr}</span>}
        </div>
        <p className="chat-item-snippet muted">
          {lastMsg ? (
            formatSnippet(lastMsg, currentUser.id)
          ) : (
            <span className="snippet-empty">Tap to start conversation</span>
          )}
        </p>
      </div>
    </button>
  );
}

interface ChatListProps {
  conversations: ConversationDto[];
  currentUser: PublicUser;
  selectedId?: string;
  onSelectConversation: (c: ConversationDto) => void;
}

export function ChatList({
  conversations,
  currentUser,
  selectedId,
  onSelectConversation
}: ChatListProps) {
  if (conversations.length === 0) {
    return (
      <div className="chat-list-empty muted small">
        <p>No conversations yet.</p>
        <p>Use the search above to find another user and say hello.</p>
      </div>
    );
  }

  return (
    <div className="chat-list-scroll">
      {conversations.map((c) => (
        <ChatItem
          key={c.id}
          conversation={c}
          currentUser={currentUser}
          isSelected={c.id === selectedId}
          onSelect={onSelectConversation}
        />
      ))}
    </div>
  );
}
