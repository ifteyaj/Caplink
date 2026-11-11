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

Copy `.env.example` to `.env` and adjust. Validated at startup: `NODE_ENV` (development/production/test), `PORT`, `DATABASE_PATH`. In production the built `dist/` must exist (`npm run build`) or startup fails clearly.

### Checks

```sh
npm run typecheck   # strict TypeScript (same as lint)
npm test            # unit + integration tests (isolated temp databases)
npm run build       # production frontend build
```

Tests never touch the real `caplink.db`. CI runs all three checks on pull requests and pushes to `main`.

## Documentation

See [`docs/README.md`](docs/README.md) for the roadmap, implementation status, and the Phase 1 technical audit.
