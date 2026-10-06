import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { Socket } from "socket.io-client";

interface MessageComposerProps {
  conversationId: string;
  socket?: Socket;
  onSent?: () => void;
}

export function MessageComposer({ conversationId, socket, onSent }: MessageComposerProps) {
  const [text, setText] = useState("");
  const typingTimer = useRef<number>();

  const emitTyping = (isTyping: boolean) => {
    socket?.emit("typing", { conversationId, isTyping });
  };

  const handleChange = (val: string) => {
    setText(val);
    emitTyping(val.length > 0);

    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      emitTyping(false);
    }, 1200);
  };

  const handleSend = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = text.trim();
    if (!cleanText) return;

    socket?.emit(
      "message:send",
      { conversationId, text: cleanText },
      (res: { error?: string }) => {
        if (res?.error) {
          alert(`Could not send message: ${res.error}`);
        } else {
          onSent?.();
        }
      }
    );

    setText("");
    window.clearTimeout(typingTimer.current);
    emitTyping(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <form className="composer-container" onSubmit={handleSend}>
      <input
        type="text"
        className="composer-input"
        placeholder="Type a message…"
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={4000}
      />
      <button
        type="submit"
        className="btn-primary composer-send-btn"
        disabled={!text.trim()}
        title="Send message"
      >
        Send
      </button>
    </form>
  );
}

export function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="typing-indicator-container">
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
      <span className="typing-text">{name} is typing…</span>
    </div>
  );
}
