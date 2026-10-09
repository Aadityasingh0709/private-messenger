import { useEffect, useRef, useState } from "react";

export interface MediaViewerProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrl: string;
  mediaType: "image" | "video";
  title?: string;
  senderName?: string;
}

export function MediaViewer({
  isOpen,
  onClose,
  mediaUrl,
  mediaType,
  title,
  senderName
}: MediaViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Focus close button on open, handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(false);

    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Pause playback when closed
  useEffect(() => {
    if (!isOpen && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="media-viewer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title || "Media viewer"}
      onClick={onClose}
    >
      <div
        className="media-viewer-container"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="media-viewer-header">
          <div className="media-viewer-info">
            <span className="media-viewer-title">{title || (mediaType === "image" ? "Photo" : "Video")}</span>
            {senderName && <span className="media-viewer-sender">Sent by {senderName}</span>}
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="media-viewer-close-btn"
            onClick={onClose}
            aria-label="Close viewer"
          >
            ✕
          </button>
        </header>

        <div className="media-viewer-content">
          {loading && !error && (
            <div className="media-viewer-loading">
              <div className="spinner" />
              <span>Loading media…</span>
            </div>
          )}

          {error && (
            <div className="media-viewer-error">
              <span>⚠️ Unable to load {mediaType}. The resource may be unavailable or access was denied.</span>
            </div>
          )}

          {mediaType === "image" ? (
            <img
              src={mediaUrl}
              alt={title || "Media view"}
              className={`media-viewer-image ${loading ? "hidden" : ""}`}
              crossOrigin="use-credentials"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          ) : (
            <video
              ref={videoRef}
              src={mediaUrl}
              className={`media-viewer-video ${loading ? "hidden" : ""}`}
              crossOrigin="use-credentials"
              controls
              autoPlay
              playsInline
              onLoadedData={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setError(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
