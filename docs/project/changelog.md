# Changelog

All meaningful changes to Caplink. Format: dated entries, most recent first.

## 2026-11-11 — Explore page redesign (frontend-only)

- **Light theme replaces the dark glass UI.** New design tokens in `src/index.css` `@theme` (page `#F8F9FE`, surface `#FFFFFF`, primary indigo `#4938DF`, secondary purple `#7668EF`, ink `#171A3B`, muted `#747895`, border `#E8E9F4`, lavender `#F0EEFF`, soft blue `#EAF3FF`, soft green `#E9F8F1`, soft orange `#FFF2E8`); the `.glass`/`.card-gradient`/`.contact-blur` utilities are removed; a global `:focus-visible` outline and `.card`/`.input`/`.label`/`.btn-primary`/`.btn-secondary` utilities were added.
- **Sidebar navigation** (`src/components/Sidebar.tsx`, 240px) — fixed left sidebar on desktop (Explore / My Listings / Create Listing / East West University branding + "Find your people. Build your capstone." tagline) and a compact sticky top bar on mobile. "Connections" and "My Profile" are deliberately not shown — the features do not exist yet. Create Listing / My Listings open the login modal when signed out.
- **Explore page rebuilt** (`src/components/ExplorePage.tsx` + `ExploreCard.tsx`, `ListingDetailsModal.tsx`, `EmptyState.tsx`, `LoadingSkeleton.tsx`) against the supplied reference: campus-inspired hero with an accented "capstone team" heading and subtle SVG silhouette, prominent search bar with an inline Search button (Enter submits, X clears), four major chips, All/Solo/Group type filter, right-aligned Most Recent/Oldest sort, two-column card grid.
- **Horizontal discovery cards**: tinted major panel (icon + name) on the left with a colored card edge stripe (soft blue / indigo / green / orange per major), initiative (`project_idea`, line-clamped) as the main text on the right, compact Solo/Group badge, skill chips (safe JSON parse, `+N` overflow), "N members needed" (group with `slots_open` only), and an outlined View Details pill. No bookmark icon, no deadlines, no student names/photos/years.
- **`MAJORS` reduced 8 → 4 intended categories** in `src/types.ts` (`major` is a free-text column with 0 listing rows — no migration needed); the Post Listing form and filter chips were updated together.
- **My Listings now calls the real `GET /api/my-listings`** (previously derived client-side from the public feed) with delete via `DELETE /api/listings/:id` (confirm dialog, inline error notice).
- **States**: skeleton loading, "No capstone initiatives yet" empty state, "No matching initiatives found" with clear-filters action, and an error state with Retry. The PostForm `alert()` was replaced with an inline error that parses the flat `{ error, code, details }` envelope.
- **No backend changes.** All endpoints reused as-is (`GET /api/listings`, `GET /api/stats`, `POST /api/listings`, `GET /api/my-listings`, `DELETE /api/listings/:id`, auth endpoints); `is_locked` contact privacy preserved — contact details render only in the details modal when the backend unlocked them.
- Verification: strict typecheck 0 errors · 57/57 tests · build green. UI verified via typecheck/build and code review only — no browser tooling is available in this environment, so no screenshots could be captured.

## 2026-11-11 — Phase 1: Secure Student Accounts (SPEC-002)

- **Real authentication replaces the demo login.** Passwordless email OTP: `POST /api/auth/register` issues a one-time 6-digit code (HMAC-hashed, 10-min expiry, max 5 attempts, one active code per user), `POST /api/auth/verify-email` consumes it, marks the account verified, and issues an opaque server-side session. The old `POST /api/auth/login` is removed.
- **Opaque server-side sessions** — SHA-256 token hashes stored, never raw tokens; HttpOnly `SameSite=Lax` cookies (`Secure` in production); server-side logout; session rotation on re-verification. Fixes audit P0-4 (production `sameSite: "none"` removed).
- **Migration 002** — `users` gains `role`/`email_verified_at`/`updated_at`, emails lowercased (collision-safe: migration aborts and rolls back on duplicates), `email_verification_codes` + `sessions` tables with indexes. Verified against the real `caplink.db` (v1 → v2, legacy user preserved as unverified student).
- **Security controls** — domain allowlist via `EWU_ALLOWED_EMAIL_DOMAINS` config (default `std.ewubd.edu,ewu.edu.bd`); rate limits (register 20/h/IP, resend 1/60s/email+IP, verify 10/10s/IP → `429 RATE_LIMITED`); CSRF origin check on unsafe methods (`403 CSRF_REJECTED`); `AUTH_SECRET` required in production with fail-fast startup.
- **Email sender port** — production sending fails loudly (`EMAIL_NOT_CONFIGURED`) until a provider is configured (deliberate Phase 5 decision); development returns `dev_code` in the API response; codes/tokens/secrets never logged.
- **Avatars** — locally generated SVG data-URIs replace third-party avatar calls (closes audit P2-6).
- **Codebase** — `server.ts` split into `server/app.ts` (factory) + `server/index.ts` (bootstrap); listings routes moved verbatim to `server/modules/projects/project.routes.ts` with a hardened contact-unlock (valid sessions only — forged cookies no longer unlock); new middleware (`rateLimit`, `csrf`, `requireAuth`).
- **Frontend** — 2-step login modal (email → code) with 60s resend cooldown and a dev-only `dev_code` hint; `User` type extended with `role`/`email_verified`; added `src/vite-env.d.ts`.
- **Tests** — 29 → 57 green: OTP lifecycle, invalid/expired/consumed/attempt-cap codes, rotation, logout, rate limits, CSRF, migration 002 semantics (extend/lowercase/collision rollback), production contracts.
- Verification: strict typecheck 0 errors · 57/57 tests · build green · real-DB migration + live API checks.

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
