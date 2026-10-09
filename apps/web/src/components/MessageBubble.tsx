import { useState } from "react";
import type { MessageDto } from "@secure-chat/shared";
import { api } from "../api";

interface MessageBubbleProps {
  message: MessageDto;
  isMine: boolean;
  onOpenMedia?: (url: string, type: "image" | "video", title?: string) => void;
}

function formatMessageTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageBubble({ message, isMine, onOpenMedia }: MessageBubbleProps) {
  const time = formatMessageTime(message.createdAt);
  const mediaId = message.mediaAssetId || message.media?.id;
  const mediaUrl = mediaId ? api.getMediaUrl(mediaId, message.conversationId) : "";
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);

  const isImage = message.type === "image" && Boolean(mediaUrl);
  const isVideo = message.type === "video" && Boolean(mediaUrl);

  const handleMediaClick = () => {
    if (!mediaUrl || mediaError) return;
    if (isImage) {
      onOpenMedia?.(mediaUrl, "image", message.media?.originalName || "Photo");
    } else if (isVideo) {
      onOpenMedia?.(mediaUrl, "video", message.media?.originalName || "Video");
    }
  };

  return (
    <div className={`message-row ${isMine ? "row-mine" : "row-theirs"}`}>
      <div className={`message-bubble ${isMine ? "bubble-mine" : "bubble-theirs"} ${isImage || isVideo ? "bubble-media" : ""}`}>
        {isImage && (
          <div className="bubble-media-wrapper" onClick={handleMediaClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleMediaClick()}>
            {!imageLoaded && !mediaError && (
              <div className="media-placeholder">
                <span className="spinner small" />
              </div>
            )}
            {mediaError ? (
              <div className="media-load-error">
                <span>⚠️ Image failed to load</span>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt={message.media?.originalName || "Attached photo"}
                className={`bubble-image-preview ${imageLoaded ? "loaded" : "loading"}`}
                crossOrigin="use-credentials"
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setMediaError(true)}
              />
            )}
            <div className="media-overlay-hint">
              <span>Click to view</span>
            </div>
          </div>
        )}

        {isVideo && (
          <div className="bubble-media-wrapper bubble-video-wrapper" onClick={handleMediaClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && handleMediaClick()}>
            {mediaError ? (
              <div className="media-load-error">
                <span>⚠️ Video failed to load</span>
              </div>
            ) : (
              <>
                <video
                  src={mediaUrl}
                  className="bubble-video-preview"
                  crossOrigin="use-credentials"
                  preload="metadata"
                  onError={() => setMediaError(true)}
                />
                <div className="video-play-badge">
                  <span className="play-icon">▶</span>
                  {message.media?.size && (
                    <span className="video-size-label">{formatFileSize(message.media.size)}</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {message.text && (
          <div className="bubble-text">{message.text}</div>
        )}

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
