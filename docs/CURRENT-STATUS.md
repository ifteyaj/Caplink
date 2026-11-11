# Caplink — Current Status

**One-liner:** EWU-only platform for finding capstone project teammates. **Find your people. Build your capstone.**

**Updated:** 2026-11-11

## Where the project is

- **Phase 0 (Project Foundation): ✅ COMPLETE** — migration system, env contract, login upsert fix, 29 tests, strict TypeScript, CI, central error handling, dependency review.
- **Phase 1 (Secure Student Accounts): NEXT** — opaque server-side sessions, email OTP verification, rate limits, cookie/CSRF hardening.

## What works right now

- App runs with `npm run dev` (http://localhost:3000); database migrates automatically and adopts legacy databases safely.
- Core loop: login (demo mechanism) → browse/filter listings → post → delete own listings.
- Full verification gate: `npm run typecheck` (strict) · `npm test` (29/29) · `npm run build` — all green at commit `eb74dd7`.

## Known intentional gaps (do not treat as bugs — scheduled by phase)

- Auth is the demo JSON-cookie session — **insecure by design until Phase 1**; never trust it for real students.
- Contact info visible to any logged-in user until the Phase 3/4 connection flow replaces it.
- Frontend has no router/error boundaries (audit P2 items).
- Two dev-only dependency criticals (`vitest` chain) await a planned vitest 5 upgrade.

## Commands

```sh
npm run dev        # start (runs migrations)
npm run typecheck  # strict TS
npm test           # isolated-DB test suite
npm run build      # production frontend
```

## Read next

`docs/product-overview.md` (what/why) → `docs/project/implementation-status.md` (evidence) → `docs/2026-11-11-phase1-technical-audit.md` (full findings) → `docs/project/roadmap.md` (phases).
