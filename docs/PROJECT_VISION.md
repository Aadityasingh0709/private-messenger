# Project Vision — Privacy-Focused Messenger

## 1. Overview and Long-Term Objective

This project is a privacy-focused one-to-one communication platform designed to enable standard messaging and protected media sharing. The platform is designed from the ground up to support high-security, sensitive communication workflows across web and native mobile clients.

## 2. Multi-Phase Roadmap

1. **Phase 1: Foundation Messaging**
   - Account registration, login, logout, and persistent session authentication.
   - User discovery and one-to-one conversation creation.
   - Real-time text messaging with Socket.IO.
   - Persistent message history in MongoDB.
   - Typing indicators, presence, and strict conversation isolation.

2. **Phase 2: Media Messaging and Custom Media Viewer (Current)**
   - Media attachments (JPEG, PNG, WebP images; MP4, WebM videos).
   - Server-side format allowlists, magic-byte inspection, and size limits.
   - Private filesystem storage outside public directories with server-generated keys.
   - Authorized media delivery with safe headers (CSP, nosniff, private cache).
   - HTTP byte-range request streaming for video scrubbing/seeking.
   - In-app custom media viewer for responsive desktop and mobile media consumption.

3. **Phase 3: Protected Viewing & Ephemeral Media**
   - View-once media attachments.
   - Configurable expiration timers for messages.
   - Server-side asset purging on view/expiry.

4. **Phase 4: Optical Anti-Capture & Client-Side Protections**
   - Software-based optical anti-capture rendering attempting to degrade unauthorized camera captures while preserving acceptable readability.
   - Operating system-level screenshot and screen-recording protections where supported.
   - Adaptive protection parameter tuning.

5. **Phase 5: Native Android Client & Protection SDK**
   - Native Android application built with Kotlin and Jetpack Compose.
   - Reusable native Android protection module/SDK.
   - Full parity with backend media and real-time APIs.

## 3. Important Research Disclaimer

Optical anti-capture techniques are an active research objective, not a mathematically guaranteed security barrier. The application makes no claim that all camera captures or recordings can be prevented under all physical circumstances.
