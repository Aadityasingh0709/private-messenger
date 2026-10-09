import { useState, useRef, type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";
import type { Socket } from "socket.io-client";
import { ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from "@secure-chat/shared";
import { api } from "../api";
import { ErrorBanner } from "./States";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

interface MessageComposerProps {
  conversationId: string;
  socket?: Socket;
  onSent?: () => void;
}

export function MessageComposer({ conversationId, socket, onSent }: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFileName, setUploadFileName] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
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
    if (sending || uploading) return;
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
          setText((current) => (current === cleanText ? "" : current));
          emitTyping(false);
          onSent?.();
        }
      }
    );
  };

  const handleFileClick = () => {
    if (uploading || sending) return;
    setError("");
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be picked again if desired
    e.target.value = "";

    const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
    const isVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(file.type);

    if (!isImage && !isVideo) {
      setError("Unsupported format. Allowed formats: JPEG, PNG, WebP for images, MP4, WebM for videos.");
      return;
    }

    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
    const maxMb = isImage ? 10 : 100;
    if (file.size > maxSize) {
      setError(`File is too large. Maximum size for ${isImage ? "images" : "videos"} is ${maxMb}MB.`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadFileName(file.name);
      setError("");

      const currentCaption = text.trim();
      await api.uploadMedia(conversationId, file, currentCaption || undefined, (pct) => {
        setUploadProgress(pct);
      });

      // Clear text if it was used as a caption
      setText("");
      emitTyping(false);
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Media upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadFileName("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="composer-wrapper">
      {uploading && (
        <div className="upload-progress-banner">
          <div className="upload-progress-info">
            <span className="upload-progress-text">Uploading {uploadFileName} ({uploadProgress}%)…</span>
          </div>
          <div className="upload-progress-track">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      <form className="composer-container" onSubmit={handleSend}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
          onChange={handleFileChange}
          disabled={uploading || sending}
        />

        <button
          type="button"
          className="btn-attach"
          onClick={handleFileClick}
          disabled={uploading || sending}
          title="Attach photo or video"
          aria-label="Attach photo or video"
        >
          📎
        </button>

        <input
          type="text"
          className="composer-input"
          placeholder={uploading ? "Uploading media…" : "Type a message…"}
          value={text}
          disabled={sending || uploading}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={4000}
        />

        <button
          type="submit"
          className="btn-primary composer-send-btn"
          disabled={!text.trim() || sending || uploading}
          title="Send message"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
      {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}
    </div>
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
