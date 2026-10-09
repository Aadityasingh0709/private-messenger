# Project Status — Phase 2: Media Messaging & Custom Media Viewer

## Current Status: Phase 2 Complete

Phase 2 builds directly upon the Phase 1 text messaging foundation. All Phase 1 capabilities have been preserved and verified against automated regression tests.

---

## 1. What Phase 1 Implemented (Preserved)

- Cookie-based authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/me`) with Argon2 password hashing.
- One-to-one conversation management (`/api/conversations`) with participant uniqueness constraints.
- Real-time text messaging over Socket.IO (`message:send` / `message:new`).
- Message history persistence in MongoDB (`/api/conversations/:id/messages`).
- Typing indicators (`typing` / `typing:update`) and presence tracking (`presence:update`).
- Strict participant-level authorization checks on all conversation resources.

---

## 2. What Phase 2 Added

### A. Media Data Model & Storage
- **`MediaAsset` Model**: Dedicated metadata collection tracking `uploaderId`, `conversationId`, `storageKey` (unexposed by default), `mimeType`, `size`, `originalName`, `mediaKind`, and optional `width`, `height`, and `duration`.
- **Extended `Message` Model**: Supports `type: "text" | "image" | "video"` (defaulting to `"text"` for backward compatibility), with optional `mediaAssetId` referencing the stored asset.
- **Private Storage Architecture**:
  - Implemented `LocalStorageAdapter` conforming to a clean `StorageAdapter` interface for future S3/cloud storage compatibility.
  - Stored media files reside completely outside publicly exposed directories (defaulting to `storage/media`).
  - Server-generated, cryptographically random storage keys prevent direct path guessing or exposure.
  - Cleaned up partial/orphaned files upon database or validation failure.
  - Media directory added to `.gitignore`.

### B. Validation & Security Pipeline
- **Strict Format Allowlist**:
  - Images: JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`).
  - Videos: MP4 (`video/mp4`), WebM (`video/webm`).
  - Disallowed: SVGs, HTML files, executable files, arbitrary documents.
- **Magic Byte / Signature Inspection**:
  - Validates real byte headers before storage to prevent file extension/MIME spoofing.
- **Configurable Limits**:
  - Maximum image size: 10 MB (configurable via `MAX_IMAGE_SIZE_BYTES`).
  - Maximum video size: 100 MB (configurable via `MAX_VIDEO_SIZE_BYTES`).
- **Sanitization**:
  - Original filenames stripped of directory traversal characters and unsafe control characters.
  - Automatic EXIF metadata stripping for JPEG and PNG images to protect user geolocation and device metadata.

### C. Authorized Media API & Streaming
- `POST /api/conversations/:id/media`: Multipart file upload with conversation participant verification and Socket.IO emission to recipients.
- `GET /api/media/:mediaId` & `GET /api/conversations/:id/media/:mediaId`:
  - Verified conversation membership before serving media content.
  - Safe security headers: `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`.
  - HTTP byte-range request support (`206 Partial Content`, `Range: bytes=start-end`) enabling seeking and progressive video playback.

### D. Frontend Interface & Custom Viewer
- **Message Composer**:
  - Media attachment button (📎) with file picker filtered to permitted image and video formats.
  - Client-side size and format pre-validation with clear feedback.
  - Upload progress bar reporting upload completion percentages.
  - Duplicate submission lockout while uploads are in flight.
- **Message Bubbles**:
  - Scaled inline image preview with loading skeleton, error fallback, and aspect ratio preservation.
  - Video preview card with play badge and filesize display.
  - Support for optional captions.
- **Conversation List**:
  - Displays meaningful previews (`📷 Photo`, `🎥 Video`) for recent media messages.
- **Custom In-App Media Viewer**:
  - Dedicated `MediaViewer` modal component with responsive screen fitting and aspect ratio preservation.
  - Image viewer with fit-to-screen scaling.
  - Video player with play/pause, seek, volume, and fullscreen controls.
  - Closes with Escape key or close button; automatically pauses video playback and releases resources on close.
  - Accessible dialog semantics (`role="dialog"`, `aria-modal="true"`).

---

## 3. Automated Test Results

Automated test suite (`npm run test:e2e` via `apps/server/src/e2e-test.ts`) executed against active server and MongoDB instance:

| # | Test Category | Check | Result |
|---|---|---|---|
| 1 | Auth | User registration (Alice, Bob, Mallory) | PASS |
| 2 | Discovery | User search without leaking email addresses | PASS |
| 3 | Conversations | Concurrent conversation creation deduplication | PASS |
| 4 | Real-time | Socket.IO authentication and room isolation | PASS |
| 5 | Phase 1 Regression | Real-time text message exchange between Alice & Bob | PASS |
| 6 | Phase 2 Functional | Alice uploads valid PNG image with caption | PASS |
| 7 | Phase 2 Functional | Bob receives image message via Socket.IO in real time | PASS |
| 8 | Phase 2 Functional | Alice uploads valid MP4 video | PASS |
| 9 | Phase 2 Functional | Bob receives video message via Socket.IO in real time | PASS |
| 10 | Security | Storage keys and server paths not leaked in API responses or sockets | PASS |
| 11 | Phase 2 Retrieval | Bob retrieves media with correct headers (CSP, nosniff, PNG mime) | PASS |
| 12 | Video Streaming | HTTP byte-range requests return 206 Partial Content with Content-Range | PASS |
| 13 | Authorization | Mallory (unauthorized) cannot upload media to conversation | PASS (404/403) |
| 14 | Authorization | Mallory cannot access Alice and Bob's private media | PASS (404/403) |
| 15 | Error Handling | Non-existent media ID returns safe 404 | PASS |
| 16 | File Validation | Spoofed file signature (HTML disguised as JPEG) rejected | PASS (400) |
| 17 | Format Allowlist | Disallowed file format (SVG) rejected | PASS (400) |
| 18 | Persistence | MongoDB persists text, image, and video history in order | PASS |
| 19 | UI Continuity | Conversation list reflects latest media message ("video") | PASS |

- **Typecheck**: `npm run typecheck` passed (0 errors across `packages/shared`, `apps/server`, `apps/web`).
- **Build**: `npm run build` passed (0 errors; production bundle built cleanly).

---

## 4. Known Development Limitations

- **Storage**: Local filesystem storage adapter is suitable for single-node development and staging. Production environments will use an S3/GCS-compatible object storage adapter conforming to the `StorageAdapter` interface.
- **Transcoding**: No video transcoding or multi-resolution thumbnail pipeline is present in Phase 2; clients render native browser-supported video codecs (H.264/MP4, WebM).
- **Protection**: Optical anti-capture, screenshot blocking, and view-once features are scheduled for subsequent phases and are intentionally not present in Phase 2.

---

## 5. Next Step: Phase 3

- Implement view-once and expiring media controls.
- Implement server-side automated purging upon expiration/view completion.
- Begin preparations for Phase 4 optical anti-capture rendering modules.
