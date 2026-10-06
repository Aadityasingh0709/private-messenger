# Contributing to Private Messenger

Thank you for your interest in contributing! This project follows an incremental multi-phase development strategy.

## Current Project Phase: Phase 1

We are currently working on **Phase 1 ONLY (Core Web Chat Foundation)**.

Features belonging to later phases (media uploads, screenshot protection, optical anti-capture rendering, Android client, ML models) should **not** be introduced into the Phase 1 codebase.

---

## Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/Aadityasingh0709/private-messenger.git
   cd private-messenger
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure a local MongoDB server is running on `mongodb://127.0.0.1:27017/secure_chat`.

4. **Seed Demo Accounts (Optional):**
   ```bash
   npm run seed
   ```

5. **Start Development Stack:**
   ```bash
   npm run dev
   ```

---

## Verification Before Submitting a PR

Before opening a pull request, ensure all checks pass:

```bash
# 1. Typecheck all packages
npm run typecheck

# 2. Verify production build
npm run build

# 3. Run automated end-to-end integration tests (requires MongoDB)
npm run test:e2e
```

---

## Pull Request Guidelines

- Branch naming: `feat/<feature-name>`, `fix/<bug-name>`, `refactor/<target>`.
- Commit messages: Follow conventional commits (`feat: ...`, `fix: ...`, `docs: ...`).
- Never commit `.env` files or credentials.
