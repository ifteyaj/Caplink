# Implementation Status

**Last updated:** 2026-11-11
**Current phase:** 0 — Project Foundation
**Branch:** `main` @ `317f1b6` at baseline

## Verified baseline (recorded 2026-11-11, before Phase 0 changes)

- Git: `main` @ `317f1b6`, clean tree except untracked `docs/`.
- Runtime: Node v22.18.0, npm 10.9.3.
- Locked versions: express 4.22.1, better-sqlite3 12.6.2, zod 4.3.6, vite 6.4.1, typescript 5.8.3, tsx 4.21.0.
- Checks at baseline: `npm run lint` ✅ passed, `npm run build` ✅ passed, **no tests existed**, no CI existed.
- Database: `caplink.db` at repo root, `user_version 0`, tables `users` + `listings`, **1 user row, 0 listings** (non-empty — legacy adoption path is live).
- Known bugs at baseline: forgeable JSON session cookies (Phase 1 scope), `INSERT OR REPLACE` returning-user upsert hazard (fixed in Phase 0), no email verification, full contact exposure for logged-in users (Phase 1/3 scope). Full detail: [technical audit](../2026-11-11-phase1-technical-audit.md).

## Phase 0 progress

| Workstream | Status | Notes |
|---|---|---|
| A — Repository baseline | ✅ done | Baseline recorded; docs established; dev server stopped before DB work |
| B — SQLite migration system | ✅ done | `PRAGMA user_version` runner; legacy adoption verified against the real database |
| C — Environment configuration | ✅ done | `.env.example` + validated `server/config/env.ts`; production requires built `dist/` |
| D — Returning-user login bug | ✅ done | Reproduced red in isolated DB, fixed with `ON CONFLICT DO UPDATE`, regression test green |
| E — Testing infrastructure | ✅ done | Vitest + Supertest; isolated temp DBs; 15 tests green |
| F — TypeScript strict mode | ✅ done | `strict: true`; typecheck passes for `src/`, `server/`, `tests/` |
| G — CI pipeline | ✅ done | GitHub Actions: `npm ci` → typecheck → test → build on PRs and `main` |
| H — Central error handling | ✅ done | Flat backward-compatible envelope `{ error, code, details }` |
| I — Dependency & security review | ✅ done | All 20 baseline findings classified; see dependency-review.md |

## Verification evidence (2026-11-11, post-implementation)

- `npm run typecheck` — passed (strict mode on).
- `npm test` — 15 passed, 0 failed.
- `npm run build` — passed.
- Migration adoption on the real `caplink.db` — `user_version 0 → 1`, user row preserved, backup file created, `PRAGMA foreign_key_check` clean.
- D4 regression — failed with old `INSERT OR REPLACE` SQL (FOREIGN KEY constraint failed), passes with the corrected upsert.

## Deferred / known limitations

- Authentication is still the demo JSON-cookie session — intentionally unchanged until Phase 1. Tests document its current behavior only; they do not certify security.
- `src/` frontend is untouched in Phase 0 (no router, no error boundaries, listing validation gaps remain — see audit P2 items).
- No seed script (not required by SPEC-001 deliverables).
- Zod details shape changed from raw `issues` to `{ path, message }` entries in `POST /api/listings` error responses — frontend does not consume `details`, so no behavioral break.

## Untested areas / risks

- Production mode (`NODE_ENV=production`) verified by code review only — no production deployment run in this phase.
- CI verified locally by reproducing its steps; first GitHub Actions run pending on next push.
