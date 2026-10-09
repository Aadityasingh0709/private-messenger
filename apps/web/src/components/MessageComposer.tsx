import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import type { Socket } from "socket.io-client";
import { ErrorBanner } from "./States";

interface MessageComposerProps {
  conversationId: string;
  socket?: Socket;
  onSent?: () => void;
}

export function MessageComposer({ conversationId, socket, onSent }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
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
    if (sending) return;
    if (!socket?.connected) {
      setError("Not connected. Your message has not been sent.");
      return;
    }

    setError("");
    setSending(true);
    window.clearTimeout(typingTimer.current);
    socket.timeout(5000).emit(
      "message:send",
      { conversationId, text: cleanText },
      (timeoutError: Error | null, res?: { error?: string }) => {
        setSending(false);
        if (timeoutError || res?.error || !res) {
          setError(res?.error ?? "Message could not be sent. Please try again.");
        } else {
          setText((current) => current === cleanText ? "" : current);
          emitTyping(false);
          onSent?.();
        }
      }
    );
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
        disabled={sending}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        maxLength={4000}
      />
      <button
        type="submit"
        className="btn-primary composer-send-btn"
        disabled={!text.trim() || sending}
        title="Send message"
      >
        {sending ? "Sending…" : "Send"}
      </button>
      {error && <ErrorBanner message={error} />}
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
