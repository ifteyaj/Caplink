# Changelog

All meaningful changes to Caplink. Format: dated entries, most recent first.

## 2026-11-11 — Documentation closeout & Phase 1 readiness

- Pushed Phase 0 to `origin/main` (first CI run triggered on push).
- Added `docs/product-overview.md` — plain-language product explanation (what it is, who it's for, what it does and will do).
- Added `docs/CURRENT-STATUS.md` — one-page orientation consumed at session start.
- Updated docs index and this changelog.

## 2026-11-11 — Phase 0: Project Foundation

Implemented per SPEC-001 (approved). Verified: typecheck (strict) ✅ · 29/29 tests ✅ · build ✅ · real-database migration adoption ✅.

### Added
- SQLite migration system: numbered SQL migrations, `PRAGMA user_version` tracking, transactional execution, legacy-database adoption with schema fingerprint verification and automatic backup, hard abort on unrecognized schemas (`server/database/`).
- Environment contract: `.env.example`, validated `NODE_ENV`/`PORT`/`DATABASE_PATH` with fail-fast startup errors (`server/config/env.ts`).
- SQLite connection factory with verified foreign-key enforcement, busy timeout, and WAL (`server/config/database.ts`).
- Central API error handling: flat backward-compatible envelope `{ error, code, details }`, mapped Zod/body-parser/SQLite errors, JSON 404 for unknown `/api` routes (`server/middleware/errorHandler.ts`, `server/shared/errors.ts`).
- Test infrastructure: Vitest + Supertest, isolated temp-database setup, 29 unit/integration tests covering migrations, auth (incl. returning-user regression), listings, and database behavior (`tests/`, `vitest.config.ts`).
- CI: GitHub Actions workflow running `npm ci` → typecheck → tests → build on PRs and `main` (`.github/workflows/ci.yml`).
- Documentation: `docs/` index, roadmap, implementation status, dependency review, changelog.

### Changed
- Returning-user login upsert: `INSERT OR REPLACE` (which deleted and recreated the user row, resetting `created_at` and changing rowid) replaced with `INSERT ... ON CONFLICT(id) DO UPDATE`. Proven by a regression test that fails red against the legacy SQL.
- Backend restructured from single `server.ts` into `server/app.ts` (factory) + `server/index.ts` (bootstrap); `npm run dev` now runs `tsx server/index.ts`.
- TypeScript `strict` mode enabled; explicit `include`; 0 errors across `src/`, `server/`, `tests/`.
- Dependencies: non-forced `npm audit fix` reduced findings 25 → 9 (all high + `proxy-addr` critical resolved). Remaining findings documented in `docs/project/dependency-review.md`.
- `.gitignore`: `caplink.db*` (covers WAL sidecars) and `data/`.

### Fixed
- Returning users with listings can log in repeatedly without the row being recreated (`docs/2026-11-11-phase1-technical-audit.md` P1-1, corrected in the addendum: no FK 500 occurs, but row recreation was real).

### Notes
- The demo JSON-cookie session is intentionally unchanged until Phase 1 and remains insecure by design.
- Remaining audit criticals (`vitest`, `tinypool`) are dev-only and deferred to a dedicated semver-major upgrade of vitest.
