# Caplink — Current Status

**One-liner:** EWU-only platform for finding capstone project teammates. **Find your people. Build your capstone.**

**Updated:** 2026-11-11

## Where the project is

- **Phase 0 (Project Foundation): ✅ COMPLETE** — migration system, env contract, login upsert fix, tests, strict TypeScript, CI, central error handling, dependency review.
- **Phase 1 (Secure Student Accounts): ✅ COMPLETE** — email OTP verification, opaque server-side sessions, rate limits, CSRF/cookie hardening (SPEC-002).
- **Phase 2 (Student Profiles): NEXT** — `student_profiles` table, reusable profile with department/year/skills.

## What works right now

- App runs with `npm run dev` (http://localhost:3000); database migrates automatically (real DB is at `user_version 2`).
- Real authentication: enter a university email → receive a one-time 6-digit code → verified session. In development the code is shown in the API response (`dev_code`) and surfaced in the login modal; production email sending fails loudly until a provider is configured.
- Sessions are opaque server-side records (hash-stored tokens, HttpOnly `SameSite=Lax` cookies); logout is server-side; re-verification rotates sessions.
- Core loop: sign in (verified account) → browse/filter listings → post → delete own listings. Anonymous visitors see locked contact info; only valid sessions unlock it.
- Full verification gate: `npm run typecheck` (strict, 0 errors) · `npm test` (57/57) · `npm run build` — all green.

## Known intentional gaps (do not treat as bugs — scheduled by phase)

- Production email provider not configured — registration fails with `EMAIL_NOT_CONFIGURED` until Phase 5 pre-pilot setup (deliberate, documented).
- The email allowlist default (`std.ewubd.edu`, `ewu.edu.bd`) must be confirmed with currently enrolled students before launch.
- Contact info visible to any verified logged-in user until the Phase 3/4 connection flow replaces it.
- Rate limits are in-memory and per-process (fine at pilot scale; revisit at deployment).
- Frontend has no router/error boundaries (audit P2 items).
- Two dev-only dependency criticals (`vitest` chain) await a planned vitest 5 upgrade.

## Commands

```sh
npm run dev        # start (runs migrations; AUTH_SECRET optional in dev)
npm run typecheck  # strict TS
npm test           # isolated-DB test suite (57 tests)
npm run build      # production frontend
```

## Read next

`docs/product-overview.md` (what/why) → `docs/specs/002-authentication.md` (Phase 1 spec) → `docs/project/implementation-status.md` (evidence) → `docs/2026-11-11-phase1-technical-audit.md` (audit) → `docs/project/roadmap.md` (phases).
