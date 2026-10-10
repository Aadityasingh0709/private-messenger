# Project Status — Phase 2: Media Messaging & Custom Media Viewer

## Current Status: Phase 2 Verified & Ready to Freeze

Phase 2 builds directly upon the Phase 1 text messaging foundation. An exhaustive verification audit was conducted to test Phase 1 regressions, Phase 2 functional flows, security boundaries, stream handling, and build health. All Phase 1 and Phase 2 capabilities have been verified against an expanded 27-check automated test suite and production builds.

---

## 1. What Phase 1 Implemented (Preserved & Verified)

- Cookie-based authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/me`) with Argon2 password hashing.
- Duplicate email/username registration rejection with 409 Conflict.
- Invalid login credentials rejected with 401 Unauthorized.
- User search without sensitive attribute exposure (emails omitted).
- One-to-one conversation management (`/api/conversations`) with participant uniqueness constraints and concurrent creation deduplication.
- Real-time text messaging over Socket.IO (`message:send` / `message:new`).
- Message history persistence in MongoDB (`/api/conversations/:id/messages`) preserving strict chronological ordering.
- Typing indicators (`typing` / `typing:update`) and presence tracking (`presence:update`).
- Strict participant-level authorization checks on all conversation resources.
- Clean session termination on logout invalidating subsequent protected requests.

---

## 2. What Phase 2 Added & Verified

### A. Media Data Model & Storage
- **`MediaAsset` Model**: Dedicated metadata collection tracking `uploaderId`, `conversationId`, `storageKey` (unexposed by default), `mimeType`, `size`, `originalName`, `mediaKind`, and optional `width`, `height`, and `duration`.
- **Extended `Message` Model**: Supports `type: "text" | "image" | "video"` (defaulting to `"text"` for backward compatibility), with optional `mediaAssetId` referencing the stored asset.
- **Private Storage Architecture**:
  - Implemented `LocalStorageAdapter` conforming to a clean `StorageAdapter` interface for future S3/cloud storage compatibility.
  - Stored media files reside completely outside publicly exposed directories (defaulting to `storage/media`).
  - Server-generated, cryptographically random storage keys prevent direct path guessing or exposure.
  - Partial or failed uploads trigger immediate storage cleanup to avoid orphaned files.
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
- **Sanitization & Privacy**:
  - Original filenames stripped of directory traversal characters and unsafe control characters.
  - Automatic EXIF metadata stripping for JPEG and PNG images to protect user geolocation and device metadata. Verified in tests that location-bearing EXIF markers are stripped before persistence.

### C. Authorized Media API & Streaming
- `POST /api/conversations/:id/media`: Multipart file upload with conversation participant verification and Socket.IO emission to recipients.
- `GET /api/media/:mediaId` & `GET /api/conversations/:id/media/:mediaId`:
  - Verified conversation membership before serving media content.
  - Verified URL conversation ID matches asset's actual `conversationId` preventing cross-conversation ID tampering.
  - Safe security headers: `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`.
  - HTTP byte-range request support (`206 Partial Content`, `Range: bytes=start-end`) including RFC 7233 suffix ranges (`bytes=-N`) and `416 Range Not Satisfiable` for out-of-bounds ranges.
  - Client stream abort handler (`res.on("close")`) ensures immediate cleanup of readable file streams.

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
  - Modal close stops video playback, unloads source, and resets states cleanly.
  - Accessible dialog semantics (`role="dialog"`, `aria-modal="true"`).

---

## 3. Verification Audit & Fixes Applied

During the verification audit, several edge cases were identified and hardened:
1. **Cross-Conversation Media URL Tampering**:
   - *Observation*: While user membership in the route conversation was verified, `serveMedia` did not previously check that the requested `mediaId` actually belonged to the URL's `conversationId`.
   - *Fix*: Added `expectedConversationId` validation in `serveMedia`. If a caller attempts to request media belonging to another conversation via the URL path, the server rejects the request with 404.
2. **RFC 7233 Suffix Byte-Range Streaming**:
   - *Observation*: Video players (Safari/Chrome/AVPlayer) frequently issue suffix byte-range requests (e.g., `Range: bytes=-1000`) to inspect metadata atoms at the end of MP4 files.
   - *Fix*: Extended byte-range parser in `routes.ts` to support negative/suffix ranges cleanly, calculating `start = Math.max(0, fileSize - suffixLength)` and returning a proper `206 Partial Content`.
3. **Stream Descriptor Cleanup on Aborted Connections**:
   - *Observation*: Aborted video requests could leave open file descriptors until garbage collected.
   - *Fix*: Added `res.on("close", () => stream.destroy())` to release file handles immediately upon connection drop.
4. **MediaViewer State & Resource Lifecycle**:
   - *Observation*: Changing media items without closing the modal did not reset image load/error states.
   - *Fix*: Added `mediaUrl` to `MediaViewer` dependency tracking and ensured cleanup stops video playback and nullifies sources on unmount.

---

## 4. Automated Verification Test Suite (27 Checks)

Automated test suite (`npm run test:e2e` via `apps/server/src/e2e-test.ts`) executed against an active server and MongoDB instance with 100% pass rate:

| # | Category | Verification Check | Status |
|---|---|---|---|
| 1 | Auth | User registration (Alice, Bob, Mallory) | PASS |
| 2 | Auth | Duplicate email registration rejection (409 Conflict) | PASS |
| 3 | Auth | Invalid login credentials rejection (401 Unauthorized) | PASS |
| 4 | Auth | Session persistence verification (`/api/me`) via cookies | PASS |
| 5 | Discovery | User search without leaking email addresses | PASS |
| 6 | Conversations | Concurrent conversation creation deduplication | PASS |
| 7 | Real-time | Socket.IO authentication and unauthorized room join rejection | PASS |
| 8 | Regression | Phase 1 real-time text message exchange between Alice & Bob | PASS |
| 9 | Functional | Upload PNG image with caption & real-time delivery | PASS |
| 10 | Security | Upload JPEG with EXIF metadata & verify EXIF stripping | PASS |
| 11 | Functional | Upload WebP image with validation | PASS |
| 12 | Functional | Upload MP4 video & real-time delivery | PASS |
| 13 | Functional | Upload WebM video with validation | PASS |
| 14 | Streaming | Standard HTTP byte-range request (`bytes=0-15` -> 206) | PASS |
| 15 | Streaming | Suffix HTTP byte-range request (`bytes=-10` -> 206) | PASS |
| 16 | Streaming | Out-of-bounds byte-range request (`bytes=1000-2000` -> 416) | PASS |
| 17 | Security | Unauthenticated media request rejection (401 Unauthorized) | PASS |
| 18 | Security | Unauthorized third-party (Mallory) denied access to media (404) | PASS |
| 19 | Security | Unauthorized third-party denied upload to foreign conversation (404) | PASS |
| 20 | Security | Cross-conversation media ID mismatch in URL path denied (404) | PASS |
| 21 | Security | Media response headers verified (`nosniff`, `CSP: default-src 'none'`) | PASS |
| 22 | Validation | Spoofed file signature (HTML disguised as JPEG) rejected (400) | PASS |
| 23 | Validation | Disallowed file format (SVG vector graphic) rejected (400) | PASS |
| 24 | Validation | Missing / empty file upload rejected (400) | PASS |
| 25 | Persistence | MongoDB persists text, image, and video history in order | PASS |
| 26 | UI Preview | Conversation list correctly reflects latest media message ("video") | PASS |
| 27 | Auth | Logout session invalidation (subsequent requests return 401) | PASS |

- **Typecheck**: `npm run typecheck` passed (0 errors across `packages/shared`, `apps/server`, `apps/web`).
- **Build**: `npm run build` passed (0 errors; production bundle built cleanly).

---

## 5. Known Limitations & Architecture Notes

- **Storage**: Local filesystem storage adapter is suitable for single-node development and staging. Production environments will use an S3/GCS-compatible object storage adapter conforming to the `StorageAdapter` interface.
- **Transcoding**: No video transcoding or multi-resolution thumbnail pipeline is present in Phase 2; clients render native browser-supported video codecs (H.264/MP4, WebM).
- **Future Protections**: Screenshot blocking, screen-recording protection, optical anti-capture, and view-once features are scheduled for subsequent phases (starting Phase 3) and are intentionally not present in Phase 2.

---

## 6. Phase Decision: READY TO FREEZE

Phase 2 satisfies all functional, architectural, and security acceptance criteria. Phase 1 features remain 100% operational. The codebase is ready to freeze and proceed to Phase 3.
