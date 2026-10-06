import type { MessageDto } from "@secure-chat/shared";

interface MessageBubbleProps {
  message: MessageDto;
  isMine: boolean;
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function MessageBubble({ message, isMine }: MessageBubbleProps) {
  const time = formatMessageTime(message.createdAt);

  return (
    <div className={`message-row ${isMine ? "row-mine" : "row-theirs"}`}>
      <div className={`message-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}>
        <div className="bubble-text">{message.text}</div>
        <div className="bubble-meta">
          <span className="bubble-time">{time}</span>
          {isMine && (
            <span className={`bubble-status status-${message.status}`} title={`Status: ${message.status}`}>
              {message.status === "read" && "✓✓"}
              {message.status === "delivered" && "✓✓"}
              {message.status === "sent" && "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
