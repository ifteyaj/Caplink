# Caplink

Caplink helps university students find teammates for capstone projects.

## Run locally

Prerequisites: Node.js 20 or later.

```sh
npm install
npm run dev
```

Open http://localhost:3000. On first launch the server creates the SQLite database (default `./caplink.db`, configurable via `DATABASE_PATH`), runs any pending migrations automatically, and adopts an existing legacy database without data loss (a timestamped `.pre-migration-*` backup is created first).

### Environment

Copy `.env.example` to `.env` and adjust. Validated at startup: `NODE_ENV` (development/production/test), `PORT`, `DATABASE_PATH`, `EWU_ALLOWED_EMAIL_DOMAINS` (comma-separated university domains allowed to register), `AUTH_SECRET` (required in production — generate with `openssl rand -hex 32`; an ephemeral secret is generated in development). In production the built `dist/` must exist (`npm run build`) or startup fails clearly.

### Authentication (Phase 1)

Sign-in is passwordless email verification: enter a university email from the allowed domains → receive a one-time 6-digit code (valid 10 minutes, max 5 attempts) → get a verified session. Sessions are opaque server-side records; only their SHA-256 hashes are stored, delivered as HttpOnly `SameSite=Lax` cookies. In development the code is returned in the API response (`dev_code`) and shown in the login modal; **production email sending fails loudly until a provider is configured** (planned before pilot launch). Rate limits and cross-origin (CSRF) checks protect the auth endpoints.

### Checks

```sh
npm run typecheck   # strict TypeScript (same as lint)
npm test            # unit + integration tests (isolated temp databases)
npm run build       # production frontend build
```

Tests never touch the real `caplink.db`. CI runs all three checks on pull requests and pushes to `main`.

## Documentation

See [`docs/README.md`](docs/README.md) for the roadmap, implementation status, and the Phase 1 technical audit.
