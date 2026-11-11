# Caplink — Phase 1 Technical Audit

**Date:** 2026-11-11
**Repo:** `/Users/ifteyajahmed/Caplink/Caplink` @ `main` (commit `317f1b6`, tree clean)
**Auditor scope:** Read-only. No files modified, no packages installed, no migrations run, no secrets exposed. Permitted side effects: `npm run build` produced gitignored `dist/`; `caplink.db` already existed from the running dev server.

---

## 1. Executive Summary

Caplink is a functional demo (Vite SPA + Express + SQLite, 616 lines total) with a **clean build/lint and a working core loop** (login → browse → post → delete). It is **not yet Phase 1-ready**, primarily because authentication is forgeable by design: the session is an unsigned JSON cookie and every user-controlled field is trusted. Three issues block real users, and the schema lacks the columns/tables needed for all four Phase 1 priorities.

**Verdict: P0 findings must be fixed before any real student data is accepted.**

| Priority | Finding count | Theme |
|---|---|---|
| **P0 — Security blockers** | 4 | Forged sessions, no email verification, PII exposure, CSRF in prod config |
| **P1 — Data integrity / correctness** | 5 | Login FK hazard, orphaned soft-delete, dead endpoint, unvalidated fields |
| **P2 — Robustness / UX** | 7 | Render crash risk, swallowed errors, no router/error boundaries |
| **P3 — Hygiene / foundations** | 6 | Unused deps, no CI, no tests, no strict TS, no migration tooling |

---

## 2. Repository Map

```
Caplink/
├── server.ts                  # Entire backend: Express API + SQLite + Vite middleware (212 lines)
├── index.html                 # SPA shell
├── vite.config.ts             # react + tailwind plugins, '@' alias
├── tsconfig.json              # ⚠ no "strict", no include list
├── metadata.json              # ⚠ AI Studio leftover ("requestFramePermissions")
├── .gitignore                 # correctly ignores caplink.db, .env*, dist
├── .github/ISSUE_TEMPLATE/    # issue template only — ⚠ no CI workflows
├── .kombai/                   # empty leftover AI tooling dirs (untracked, harmless)
├── caplink.db                 # SQLite DB (gitignored, created at runtime)
└── src/
    ├── main.tsx               # entry, StrictMode + AuthProvider
    ├── App.tsx                # entire UI in one file (613 lines): LoginModal, NavBar,
    │                          #   ListingCard, StatsBar, PostForm, browse/post/profile views
    ├── AuthContext.tsx        # React context: login/logout/refresh via /api/auth/*
    ├── types.ts               # User/Listing types, MAJORS, SKILLS, cn() helper
    └── index.css              # Tailwind v4 @theme tokens (dark theme)
```

**Architecture:** single-process dev server (`tsx server.ts`) — Express serves the API, Vite middleware serves the SPA in dev; in "production" it serves `dist/`. No router, no middleware pipeline, no service layer, no migrations, no tests, no CI. Everything is same-origin (no proxy needed).

---

## 3. Commands Run — Results

| Command | Result | Notes |
|---|---|---|
| `npm run lint` (`tsc --noEmit`) | ✅ **passed** | Weak gate: `strict` is not enabled (tsconfig.json) |
| `npm run build` (vite build) | ✅ **passed** | 2.61s, 370 KB JS / 116 KB gzip |
| Tests (`npm test`) | ⛔ **not available** | No test script, no test files exist |
| `npm audit` (read-only) | ⚠ **20 vulnerabilities** (1 critical, 12 high) | Mostly transitive; details §5 P3-7 |
| Live probes (dev server, GET only) | ✅ `/api/stats`, `/api/listings`, `/api/auth/me` respond correctly; unauth `POST /api/listings` → **401** as designed | No POSTs executed (writes to DB avoided per constraints) |

**Not run (by constraint or unavailability):** migrations (none exist), `npm audit fix` (install required), any DB write (live repro of P1-1).

---

## 4. API Endpoint Matrix

| Endpoint | Method | Auth | Validation | Notes |
|---|---|---|---|---|
| `/api/auth/login` | POST | none | regex on email only | Issues session cookie; upserts user (server.ts:65–95) |
| `/api/auth/logout` | POST | none | — | Clears cookie client-side only (server.ts:97–103) |
| `/api/auth/me` | GET | cookie (unverified) | — | Returns parsed cookie as-is (server.ts:105–107) |
| `/api/listings` | GET | optional | — | Strips email/facebook only for anonymous (server.ts:123–134) |
| `/api/listings` | POST | `requireAuth` | zod `listingSchema` | Errors return raw zod issues (server.ts:143–176) |
| `/api/listings/:id` | DELETE | `requireAuth` | — | Owner-scoped in SQL — good (server.ts:184–191) |
| `/api/my-listings` | GET | `requireAuth` | — | **Dead endpoint — frontend never calls it** (server.ts:178–182) |
| `/api/stats` | GET | none | — | Counts active listings (server.ts:136–141) |

Ownership check on DELETE is correct (`AND user_id = ?`, server.ts:187). `requireAuth` correctly 401s unauthenticated writes — verified live. **The problem is not the auth plumbing, it's what "authenticated" means (see P0-1).**

---

## 5. Findings

### P0 — Security blockers

**P0-1 · Sessions are client-forgeable JSON → full account impersonation.**
- *Evidence:* server.ts:46–54 (`getUser` = `JSON.parse(req.cookies.session)`), cookie issued unsigned at server.ts:87. `cookie-parser`'s signed-cookie support is never used; no session store, no secret, no HMAC.
- *Risk:* Any user can set `session={"id":"<victim>","email":"<victim>"}` in their browser and become any account. Since `id` is deterministically derived from the email (`email.replace(/[^a-zA-Z0-9]/g,"")`, server.ts:76), victim IDs are guessable → a forged cookie can delete other students' listings (DELETE matches only `user_id`) and harvest all contact info.
- *Fix:* Signed cookies (`res.cookie(..., { signed: true })` + `COOKIE_SECRET` from env) as the minimum; server-side session table with random opaque token as the Phase 1 target. Depends on: env-var handling (P3-2).
- *Status:* **Verified from code.**

**P0-2 · No real email verification — "EWU-only" is unenforced.**
- *Evidence:* Login accepts any string matching `/^\d{4}-\d{1,2}-\d{2,3}-\d{3}@gmail\.com$/` (server.ts:69) with no OTP, no token, no domain check. The UI literally shows "Verifying…" (src/App.tsx:77) but nothing is verified. `google-auth-library` is installed (package.json:21) but **never imported** — OAuth was scaffolded and abandoned (grep: zero usage).
- *Risk:* Anyone with a gmail address can claim to be an EWU student with an arbitrary ID number. This directly defeats priority #1.
- *Fix (decision needed):* either (a) email OTP flow — add `is_verified`, `verification_code`, `code_expires_at` to `users`, send code via an email provider, gate login on it; or (b) Google OAuth restricted to EWU accounts (the installed lib hints this was the intent). (a) is self-contained; (b) is stronger but needs OAuth consent setup.
- *Status:* **Verified from code.**

**P0-3 · Logged-in users can harvest every student's contact info.**
- *Evidence:* server.ts:128–130 — for *any* authenticated user, the full `email` + `facebook` of *every* active listing is returned in one GET. No pagination, no rate limit.
- *Risk:* One login → scrape the entire student directory's personal emails/Facebook links in one request. Combined with P0-2 (fake accounts trivially obtainable), the "login to view contact" gate (src/App.tsx:193–213) provides no real protection.
- *Fix:* Contact reveal should be an explicit, auditable per-listing action (`POST /api/listings/:id/reveal`) logged for anti-scraping; keep the list endpoint contact-free always. Depends on: request-logging foundation (priority #4).

**P0-4 · Production cookie config enables CSRF.**
- *Evidence:* server.ts:90 — `sameSite: "none"` when `NODE_ENV=production`, with no CSRF token anywhere.
- *Risk:* In production, cross-site requests carry the session cookie → third-party pages can silently POST listings or DELETE a user's listings. In dev (`lax`) this is mitigated, which hides the bug until deploy.
- *Fix:* Use `sameSite: "lax"` + `secure: true` in production (app is same-origin; `none` is only needed for embedded iframes — a leftover AI Studio assumption). Add `helmet` while touching this file.
- *Status:* Config verified from code; exploitability assumed from standard browser behavior.

### P1 — Data integrity / correctness

**P1-1 · Likely login-breaking FK interaction (verify first thing in Phase 1).**
- *Evidence:* Login upserts with `INSERT OR REPLACE INTO users` (server.ts:83). better-sqlite3 enables FK enforcement by default — **verified live**: `PRAGMA foreign_keys` = `1` on a fresh connection, and `listings.user_id REFERENCES users(id)` (server.ts:35). In SQLite, REPLACE first *deletes* the existing parent row; with child `listings` rows present and no `ON DELETE` action, the FK check should fail.
- *Predicted impact:* a returning user who has posted ≥1 listing gets an unhandled exception → HTTP 500 on login and can never sign back in (no try/catch on this route).
- *Why not verified:* reproducing requires DB writes (login POST), excluded by audit constraints.
- *Fix:* use `INSERT ... ON CONFLICT(id) DO UPDATE SET name=excluded.name` (upsert, no delete); add a try/catch on login regardless.
- *Status:* **High-confidence static analysis — explicitly unverified. Must repro in dev before/during Phase 1.**

**P1-2 · Soft-delete is designed but impossible; `is_active` is dead.**
- *Evidence:* `is_active` column (server.ts:33) is read by 3 queries (server.ts:125,137–139) and typed in src/types.ts:27, but **no code path ever sets it to 0** — DELETE is a hard delete (server.ts:187), and there is no update endpoint.
- *Risk:* Moderation ("improved listings" priority) has no mechanism; "relist/edit" UX can't exist; accidental deletes are unrecoverable.
- *Fix:* `PATCH /api/listings/:id` (owner-only) for `is_active`/edit; keep hard delete only as admin action.

**P1-3 · Contact email on listings is unvalidated against the account.**
- *Evidence:* `listingSchema.email` only checks `z.string().email()` (server.ts:119); client prefills the session email (src/App.tsx:256) but nothing prevents posting with **someone else's email**.
- *Risk:* Impersonation/spoofed contact info — harmful once real students use the platform.
- *Fix:* In `POST /api/listings`, force `email = user.email` server-side (ignore the body field) — the schema keeps the column for legacy, but trust only the session.

**P1-4 · Server-side validation gaps in `listingSchema`.**
- *Evidence:* server.ts:111–121 — `slots_open: z.number().nullable()` with **no min/max** (client limits 1–10 only in HTML, src/App.tsx:354–355 → negative/0/huge values accepted); `skills: z.array(z.string())` unbounded (empty arrays OK, arbitrary strings, not restricted to the SKILLS list); no length caps on `name/course/major/project_idea`; `major` free-text (MAJORS list enforced only in UI).
- *Fix:* `.int().min(1).max(10)` on slots, `.max(15).min(0)` on skills with per-string caps, `.max(300)` on text fields, and decide whether `major` is a DB-level enum.

**P1-5 · DB created relative to CWD; no indexes; no migration story.**
- *Evidence:* `new Database("caplink.db")` (server.ts:9) — path depends on process CWD (breaks under `npm --prefix`, Docker, service managers). Only PKs exist; no index on `listings.user_id`, `is_active`, `course`, `major`. Schema is one-shot `CREATE TABLE IF NOT EXISTS` (server.ts:12–37) — no migration framework.
- *Fix (dependency for priorities 1–4):* adopt a migration runner (even a numbered `.sql` + `user_version` pragma script) **before** adding auth/profile/connection tables; absolute-path the DB via env; add `user_id` + `is_active` indexes. Not done during the audit (constraint).

### P2 — Robustness / UX

| # | Finding | Evidence | Risk / Fix |
|---|---|---|---|
| P2-1 | `JSON.parse(listing.skills)` unguarded in render — one malformed row crashes the entire browse grid | src/App.tsx:148 | Parse defensively or trust a typed API response; add an error boundary |
| P2-2 | Failed listing creation shows generic `alert('Failed to post listing')`; server's zod `details` (server.ts:172) are discarded | src/App.tsx:272–273 | Surface field errors; same for NaN slots (empty input → `parseInt('')` → NaN → 400) src/App.tsx:357 |
| P2-3 | `handleDelete` ignores failures; 401/404 silently do nothing | src/App.tsx:478–482 | Show result; refresh session on 401 |
| P2-4 | No router — views are `useState` (src/App.tsx:440); back button, deep links, refresh-on-`/profile` all unsupported | src/App.tsx:440,496,584,591 | Phase 1: accept, or add react-router with a catch-all (prod SPA fallback already exists, server.ts:204) |
| P2-5 | Auth data race: `fetchData` depends on `[user]` but fetches `/api/listings` immediately — locked vs unlocked cards can render before `/api/auth/me` resolves on first paint | src/App.tsx:449–467, AuthContext.tsx:18–32 | Gate initial fetch on `loading` from AuthContext |
| P2-6 | Any user's avatar renders `api.dicebear.com?seed=<student email>` — leaks student emails to a third-party service on every page view | server.ts:79, src/App.tsx:112 | Generate avatars locally (e.g., initials) or hash the seed |
| P2-7 | Modal a11y: no focus trap, no Escape-to-close, icon-only delete button unlabeled; `confirm()`/`alert()` native dialogs | src/App.tsx:32,216–223,273,479 | Standard focus management + aria-labels; part of "profiles" UX work |

(No XSS risk found: no `dangerouslySetInnerHTML`; `avatar_url`/`facebook`/`skills` render as text or `img src` with server-controlled values. React escaping holds throughout App.tsx.)

### P3 — Hygiene / foundations

1. **Dead dependencies:** `google-auth-library` (package.json:21) and `dotenv` (:19) are declared but never imported (grep-verified). Dead supply-chain surface; also documents the abandoned OAuth path (P0-2).
2. **No environment contract:** no `.env.example`; only `NODE_ENV` is read (server.ts:89–90,196). Nothing sets `NODE_ENV` — a prod deployment of `tsx server.ts` would serve dev Vite middleware and insecure cookies. Add `engines`, `.env.example`, and explicit `NODE_ENV` handling.
3. **No CI:** `.github/` has only an issue template — no workflow to run `lint`/`build`. (Trivial to add once decisions land.)
4. **No tests at all:** zero test files; nothing to inherit for Phase 1 regression safety. Recommend: API tests for auth + listings before rewriting auth (P0-1/P0-2).
5. **Weak type gate:** tsconfig.json lacks `"strict"`; server runtime via `tsx`/esbuild does no type checking at all, so `tsc --noEmit` is the only gate (and it passed). Enable `strict` — cheap now, harder later.
6. **AI Studio leftovers:** `metadata.json` (`requestFramePermissions`), empty `.kombai/` dirs, unused `.contact-blur` class (index.css:35 vs src/App.tsx:193). Cosmetic cleanup.
7. **npm audit:** 20 vulns (1 critical: `proxy-addr` via express; 12 high incl. `vite` dev-server file-read, `zod` memory exhaustion reachable from `POST /api/listings` validation, `path-to-regexp` ReDoS). Mostly transitive/dev-surface; `npm audit fix` not run (would modify package-lock). Re-audit after Phase 1 dep changes.

---

## 6. Database Audit (read-only inspection)

**Tables (verified live via `.schema`):**

- `users(id PK, email UNIQUE NOT NULL, name, avatar_url, created_at)` — no `is_verified`, no credentials, no EWU metadata (blocking priority #1).
- `listings(id PK, user_id FK→users, type CHECK('solo'|'group'), name, course, major, project_idea, skills TEXT-as-JSON, slots_open, email, facebook, is_active, created_at)` — FK **is** enforced (better-sqlite3 default, verified `PRAGMA foreign_keys = 1`), but see P1-1 for the REPLACE hazard.
- **Missing for Phase 1:** `verification` fields on users; a `profiles` table (priority #2); `connection_requests` table with status enum (priority #4); indexes (P1-5); any migration mechanism.
- Current DB state: **empty** (0 users, 0 listings — verified via `/api/stats`).

**Schema strength:** reasonable for a demo — `CHECK` on `type`, UNIQUE email, FK present. Main gaps are evolvability (P1-5) and the JSON-in-TEXT `skills` column (acceptable short-term; normalize only if Phase 1 adds skill-based search).

---

## 7. Verified vs. Assumed

**Verified (code + live checks):** all findings in §5 with file:line refs; lint/build pass; 401 on unauth POST; empty DB; FK pragma on; unused deps; no CI; no tests; no strict mode; dead `/api/my-listings`; `is_active` never written; audit counts.

**Assumptions / explicitly unverified:**
1. **P1-1 (login 500 on re-login with listings)** — high-confidence from SQLite REPLACE+FK semantics; not reproduced because it requires a DB write. *Verify with: login → post listing → logout → login again.*
2. **P0-4 CSRF exploitability** — standard browser behavior inference; no cross-site test was run.
3. **Production behavior** (`NODE_ENV` paths, static serving, cookie flags) — code-read only; no production-mode process was started.
4. **No secrets exist to leak** — no `.env` files present (checked); only `NODE_ENV` is consulted.
5. EWU email format is *actually* `YYYY-#-##-###@gmail.com` — taken from the code/UI copy; worth confirming against the real student-ID scheme before building verification on it.

---

## 8. Recommended Phase 1 Sequence

1. **Foundation (unblocks everything):** migration runner + `.env.example` + CI + first API tests → then fix **P1-1** (upsert) since it may already break returning users.
2. **Auth (priority #1):** P0-1 signed/server-side sessions → P0-2 verification (choose OTP vs OAuth) → P0-4 cookie flags → P3-1 dependency cleanup.
3. **Profiles (priority #2):** new `profiles` table + migration; `users.name` currently doubles as display name with no update path.
4. **Listings (priority #3):** P1-2 (edit/soft-delete) → P1-3/P1-4 validation hardening → P2-1/P2-2 UI error handling → P0-3 contact-reveal flow (designed together with #4).
5. **Connections (priority #4):** `connection_requests` table depends on the contact-reveal audit log from step 4 — build these as one unit.
