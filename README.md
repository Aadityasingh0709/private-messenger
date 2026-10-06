# Private Messenger — Phase 1

A web-based, one-to-one text messenger. This is the normal communication foundation for a future privacy-focused protected-media platform; Phase 1 does **not** provide end-to-end encryption, media handling, screenshot prevention, or anti-capture protection.

## Stack

- `apps/web`: React, TypeScript, Vite, React Router, Socket.IO client
- `apps/server`: Express, TypeScript, Socket.IO, MongoDB/Mongoose
- `packages/shared`: request validation and DTO contracts shared by clients and API

## Local setup

1. Install Node.js 20+ and start a local MongoDB instance.
2. Copy `.env.example` to `.env` and set a unique `JWT_SECRET` (at least 32 random characters). The server loads the root `.env` when run from the root; alternatively copy it into `apps/server/.env`.
3. Copy `apps/web/.env.example` to `apps/web/.env` if the API is not at `http://localhost:4000`.
4. Run `npm install`, then `npm run dev`.
5. Open `http://localhost:5173`. Register two independent accounts in separate browser profiles to test realtime delivery.

Use `npm run typecheck` and `npm run build` before deployment.

## API and Socket contract

Cookie-authenticated HTTP endpoints are under `/api`: auth registration/login/logout, current user, user search, conversations, and per-conversation messages. The server verifies conversation participation before returning messages.

Socket.IO authenticates from the same HttpOnly cookie. Events: `conversation:join`, `message:send` / `message:new`, `typing` / `typing:update`, and `presence:update`. Every sent message is validated and persisted before being emitted.

## Data model

- **User**: identity/profile fields, Argon2 password hash, presence and last-seen timestamp.
- **Conversation**: exactly two participants, optional latest-message reference and timestamp.
- **Message**: conversation and sender references, text, status, and a current `type: "text"` field. The type is intentionally the narrow extension point for future media message types.

## Known Phase 1 limits

- No end-to-end encryption, media uploads, push notifications, pagination, email verification, password recovery, or message deletion/editing.
- Read status is recorded when the participant loads a conversation. Socket-delivered messages show `sent`; a richer delivery/read receipt flow belongs in a later refinement.
- HttpOnly cookie auth assumes the web app and API are configured with compatible HTTPS/CORS settings in production.

## Recommended Phase 2

Build an upload pipeline with authenticated object storage, media metadata/validation, thumbnails, and a dedicated normal media viewer—keeping viewer and media-service APIs separate from the future protected viewer/protection engine.
