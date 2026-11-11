# Implementation Status

**Last updated:** 2026-11-11
**Current phase:** 1 — Secure Student Accounts (complete) · Phase 2 next
**Branch:** `main`

## Phase 1 progress (SPEC-002 — [`docs/specs/002-authentication.md`](../specs/002-authentication.md))

| Deliverable | Status | Notes |
|---|---|---|
| Migration `002_authentication.sql` | ✅ done | `users` gains `role`, `email_verified_at`, `updated_at`; emails lowercased; `email_verification_codes` (HMAC hashes) + `sessions` (token hashes) with lookup indexes |
| Auth service + routes | ✅ done | register/resend/verify/logout/me; single active code per user; attempt cap 5; 10-min expiry; session rotation on verify; no account enumeration |
| Opaque server-side sessions | ✅ done | SHA-256 token hashes only; HttpOnly `SameSite=Lax` cookie (`Secure` in production); 30-day expiry with lazy deletion |
| Domain allowlist | ✅ done | `EWU_ALLOWED_EMAIL_DOMAINS` (default `std.ewubd.edu,ewu.edu.bd`); config, not code |
| Rate limiting | ✅ done | register 20/h/IP · resend 1/60s/email+IP · verify 10/10s/IP → `429 RATE_LIMITED` with `retry_after`; in-memory, per-process (documented) |
| CSRF origin check | ✅ done | Unsafe methods rejected on Origin/Host mismatch (`403 CSRF_REJECTED`); no-Origin clients pass |
| `AUTH_SECRET` handling | ✅ done | Required in production (startup fails fast); ephemeral random in dev; never logged |
| Email sender port | ✅ done | Production sending fails loudly (`EMAIL_NOT_CONFIGURED`) until a provider is configured — deliberate Phase 5 decision; dev returns `dev_code` in the API response |
| Avatars | ✅ done | Local SVG data-URIs (initials) — closes audit P2-6; no student emails leave the server |
| Listings routes moved to module | ✅ done | `server/modules/projects/project.routes.ts`, behavior verbatim; contact unlock now requires a *valid* session (forged cookies no longer unlock) |
| Old login route removed | ✅ done | Passwordless: returning students re-verify via register→OTP |
| Frontend 2-step login | ✅ done | Email→code modal, 60s resend cooldown, `dev_code` hint shown only in dev builds; `User` type extended (`role`, `email_verified`) |
| Tests | ✅ done | 57 tests green (was 29): full OTP lifecycle, wrong/expired/consumed/cap-exceeded codes, rotation, server-side logout, rate limits, CSRF, migration 002 (adopt→extend, lowercase, collision rollback), production contracts |

## Verification evidence (2026-11-11, post-implementation)

- `npm run typecheck` — passed (strict, 0 errors).
- `npm test` (`npx vitest run`) — **57 passed, 0 failed** across 5 files.
- `npm run build` — passed (production frontend).
- Real-database migration — `npm run dev` applied `002_authentication.sql` to the actual `caplink.db`: `user_version 1 → 2`; the legacy user row preserved as `role: student`, `email_verified_at: null` (no invented trust); `sessions`/`email_verification_codes` created empty; backup file created by the runner.
- Live API checks against the real server — anonymous `GET /api/auth/me` → `{user: null}`; register with `2024-1-12-345@std.ewubd.edu` → `200` with `dev_code` (dev mode); register with the legacy `gmail.com` address → `400 INVALID_EMAIL_DOMAIN` (expected: the allowlist now excludes gmail-pattern addresses).

## Deferred / known limitations

- **No email provider configured** — production registration fails with `EMAIL_NOT_CONFIGURED` by design until a provider is chosen (Phase 5 pre-pilot decision). Development delivers via `dev_code`.
- **In-memory rate limits** — per-process, reset on restart; acceptable at pilot scale, revisited at deployment.
- **Allowlist default unconfirmed** — `std.ewubd.edu` / `ewu.edu.bd` must be confirmed with currently enrolled students before launch (config-only change; open product decision).
- **Legacy gmail user** — the one existing user (`2022-1-60-002@gmail.com`) is preserved in the database but can no longer register that address; they must re-register with their real EWU address (data intact, no listings to lose).
- **`users.name`** — transitional field; moves to `student_profiles` in Phase 2.
- Email is plaintext in the API's dev response only (`dev_code`, non-production builds); codes/tokens/secrets are never logged server-side.

## Untested areas / risks

- Real SMTP/email delivery — untested (no provider yet).
- Production deployment run — not exercised in this phase; cookie `Secure` flag and startup `AUTH_SECRET` gate verified by tests/code review only.
- Multi-instance deployments would need shared rate-limit state (documented, out of scope).

## Phase 0 record (retained)

- Baseline `main` @ `317f1b6`; checks then: lint ✅, build ✅, no tests/CI.
- Phase 0 delivered: migration system with legacy adoption, env contract, `ON CONFLICT DO UPDATE` upsert fix (D4 regression test), Vitest+Supertest infra, strict TS, CI (`npm ci` → typecheck → test → build), flat error envelope `{ error, code, details }`, dependency review (25 → 9 findings; remaining criticals dev-only, vitest 3→5 upgrade deferred).
- Audit addendum: P1-1 (FK 500 prediction) was empirically falsified — SQLite checks `NO ACTION` FKs at statement level; the real defect was row recreation (rowid change, `created_at` clobber), caught deterministically by the rowid regression test.
- Phase 0 CI run 43054987008: green.
