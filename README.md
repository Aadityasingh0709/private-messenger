# Private Messenger — Phase 2

A privacy-focused, one-to-one messaging platform with real-time text and media messaging (images & videos) and a custom in-app media viewer.

> **Note**: Phase 2 preserves all Phase 1 authentication, real-time text chat, presence, and conversation features. It adds secure media upload, validation, private storage, byte-range video streaming, and an in-app viewer. It does **not** yet provide end-to-end encryption, screenshot prevention, or optical anti-capture protection (scheduled for future phases).

## Technology Stack

- `apps/web`: React, TypeScript, Vite, React Router, Socket.IO client
- `apps/server`: Express, TypeScript, Socket.IO, MongoDB/Mongoose, Multer
- `packages/shared`: Shared Zod validation, MIME allowlists, and DTO contracts

## Local Setup

1. Install Node.js 20+ and ensure a local MongoDB instance is running.
2. Copy `.env.example` to `.env` (or `apps/server/.env`) and verify settings:
   ```env
   MONGODB_URI=mongodb://127.0.0.1:27017/secure_chat
   JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters
   CLIENT_ORIGIN=http://localhost:5173
   PORT=4000
   MAX_IMAGE_SIZE_BYTES=10485760
   MAX_VIDEO_SIZE_BYTES=104857600
   MEDIA_STORAGE_DIR=storage/media
   ```
3. Run `npm install`.
4. Run `npm run dev` to start both the backend API server (`http://localhost:4000`) and the web client (`http://localhost:5173`).
5. Open `http://localhost:5173` in two browser profiles (or incognito) to test two-way realtime text and media communication.

## Validation & Verification

- **Typecheck**: `npm run typecheck`
- **Build**: `npm run build`
- **End-to-End Tests**: `npm run test:e2e` (validates Phase 1 regression checks and Phase 2 media upload, streaming, security, and authorization checks).

## API & Socket Contracts

### HTTP Endpoints
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`: Cookie-authenticated sessions.
- `GET /api/me`: Authenticated user profile.
- `GET /api/users?q=...`: User search (excluding emails).
- `GET /api/conversations`: Conversation list with last-message preview (`Photo`, `Video`, or text).
- `POST /api/conversations`: Initiate or retrieve conversation with a participant.
- `GET /api/conversations/:id/messages`: Historical messages (text & media with populated metadata).
- `POST /api/conversations/:id/media`: Multipart media upload (`file`, optional `caption`).
- `GET /api/media/:mediaId` & `GET /api/conversations/:id/media/:mediaId`: Authenticated media retrieval with safe headers (`nosniff`, `CSP: default-src 'none'`) and HTTP byte-range support for video playback.

### Socket.IO Events
- Client to Server: `conversation:join`, `message:send`, `messages:read`, `typing`.
- Server to Client: `message:new` (dispatches both text and media messages in real time), `messages:read`, `typing:update`, `presence:update`.

## Media Architecture & Security

- **Supported Formats**: JPEG, PNG, WebP for images (max 10MB); MP4, WebM for videos (max 100MB).
- **Validation**: Magic byte signature inspection prevents extension/MIME spoofing. SVGs, HTML, and executables are rejected.
- **Privacy & Storage**: Files are stored outside public directories using server-generated keys. Internal storage paths are never leaked to clients.
- **Metadata Sanitization**: Location-bearing EXIF tags are stripped from images upon ingestion.
- **Streaming**: Supports HTTP Range headers (`206 Partial Content`) for video scrubbing and progressive buffering.
- **Custom Viewer**: Integrated modal component for fullscreen viewing of images and playback of videos with play/pause, seek, volume, and keyboard shortcuts (`Escape`).

## Project Documentation

- [Project Vision](docs/PROJECT_VISION.md)
- [Project Status](docs/PROJECT_STATUS.md)
