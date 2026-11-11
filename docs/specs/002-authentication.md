# SPEC-002: Authentication

**Project:** Caplink · **Phase:** 1 — Secure Student Accounts · **Version:** 1.0 · **Status:** Approved for implementation (autonomous mode per product spec §17 and owner directive)
**Priority:** P0 · **Depends on:** SPEC-001 (Phase 0 complete @ `f58a027`)

## 1. Objective

Replace the demo forgeable JSON-cookie session with verified-account authentication so that **only verified, eligible EWU student accounts can access protected functionality**. This is the phase exit condition.

## 2. Locked decisions (inherited, not reopened)

- University email **OTP** verification (no OAuth in Phase 1).
- **Opaque random server-side sessions**; only SHA-256 token hashes stored.
- HttpOnly cookies; `SameSite=Lax` always (fixes audit P0-4 — the production `sameSite:"none"` is removed); `Secure` in production.
- Email **domain allowlist via configuration**; a student-ID pattern is never proof of ownership.
- Mutually shared contact details after accepted connection — Phase 4, out of scope here.

## 3. Scope

**In:** migration 002 (auth tables + user columns), register/verify/resend/logout/me API, session lifecycle with rotation and server-side logout, attempt limits + code expiry, rate limiting, CSRF origin checks, dev-mode code delivery, frontend 2-step login modal, tests, docs.
**Out:** email provider integration (deliberate — production sends fail clearly until a provider is configured in Phase 5 pre-pilot; document choice), student profiles (Phase 2), admin routes (role column reserved), listing/contact model changes (Phase 3), password flows (none — passwordless).

## 4. Data model — migration `002_authentication.sql`

- `users`: add `role TEXT NOT NULL DEFAULT 'student'`, `email_verified_at DATETIME`, `updated_at DATETIME`; normalize existing `email` to lowercase (abort migration on case-collision duplicates — manual review). `name` stays on `users` as a **transitional** field until `student_profiles` (Phase 2). `id` stays email-derived (guessability is no longer an auth risk once sessions are server-side; documented).
- `email_verification_codes`: `id`, `user_id` FK, `code_hash` (HMAC-SHA256 with `AUTH_SECRET` pepper — never plaintext), `expires_at`, `consumed_at`, `attempt_count`, `created_at`; index on `user_id`.
- `sessions`: `id`, `user_id` FK, `token_hash` UNIQUE, `expires_at`, `created_at`, `last_seen_at`; index on `user_id`.

## 5. API

| Route | Behavior |
|---|---|
| `POST /api/auth/register` `{email, name?}` | Normalize + lowercase email; allowlist check → `400 INVALID_EMAIL_DOMAIN`; create user (or reuse), accept `name` only for new/unverified users; invalidate previous pending codes; create code (6-digit `crypto.randomInt`, HMAC-hashed, 10-min expiry); **response is generic** (no account enumeration); dev mode only: include `dev_code`. Rate limit: 20/h per IP. |
| `POST /api/auth/verify-email` `{email, code}` | Find latest active code (unconsumed, unexpired); max 5 attempts (exceeding consumes the code); on match: consume code, set `email_verified_at` if unset, touch `updated_at`, **rotate sessions** (delete all user sessions, issue new opaque token), set cookie. Rate limit: 10/10s per IP. |
| `POST /api/auth/resend-code` `{email}` | Same as register with stricter limits (60s cooldown per email+IP). |
| `POST /api/auth/logout` | Delete session row server-side; clear cookie. Always 200. |
| `GET /api/auth/me` | Resolve session (hash lookup + expiry); return `{user: {id, email, name, avatar_url, role, email_verified}}`; update `last_seen_at`. Expired/unknown → `{user: null}`. |
| `POST /api/auth/login` | **Removed** — passwordless: returning students re-verify via register→OTP. |

**Protected endpoints** (`requireAuth`): resolve session; sessions exist only for verified users by construction; expired/unknown → 401 `UNAUTHORIZED`.

**Avatars:** replaced with locally generated SVG data-URIs (initials) — closes audit P2-6 (no student emails to third-party services).

## 6. Security controls

- **Rate limiting** (in-memory sliding window, per-process; documented limitation for MVP): register 20/h/IP; resend 1/60s per email+IP; verify 10/10s/IP → `429 RATE_LIMITED` with `retry_after`.
- **CSRF**: origin-check middleware on unsafe methods — reject when `Origin` host ≠ `Host` (`403 CSRF_REJECTED`); absent Origin (non-browser clients) allowed; combined with `SameSite=Lax`.
- **Code policy**: 6 digits, HMAC-hashed, 10-min expiry, max 5 attempts, single active code per user, invalidated on re-issue.
- **Secrets**: `AUTH_SECRET` required in production (fail fast), ephemeral random in dev if unset; never logged. `EWU_ALLOWED_EMAIL_DOMAINS` defaults to `std.ewubd.edu,ewu.edu.bd` — **must be confirmed with enrolled students before real launch** (open product decision, config-only change).
- **Dev code delivery**: no provider configured → production registration returns a clear failure; development returns `dev_code` in the response (gated on `NODE_ENV !== 'production'`, documented — never logged server-side). A `VerificationCodeSender` port exists so tests capture codes deterministically.
- **Never log** codes, tokens, or secrets.

## 7. Acceptance criteria

- [ ] Unverified accounts cannot reach protected endpoints (register without verifying → `POST /api/listings` → 401).
- [ ] Wrong/expired/consumed/exceeded-attempt codes → 400 `INVALID_CODE`; attempt counter enforced.
- [ ] Successful verification issues an HttpOnly `SameSite=Lax` cookie; session row stores a hash, never the token.
- [ ] Re-authentication rotates sessions (old token dead); logout invalidates server-side.
- [ ] Cross-origin unsafe requests → 403; rate-limit breaches → 429.
- [ ] Non-allowlisted domain → 400; allowlist is configuration, not code.
- [ ] Existing users/listings preserved by migration 002; emails lowercased; migration idempotent.
- [ ] Frontend completes register→verify→session loop against the real API.
- [ ] typecheck (strict) + full test suite + build + CI green.

## 8. Risks / decisions

- **Email provider unchosen** — production sending intentionally fails loudly until configured (Phase 5 pre-pilot decision with the owner).
- **In-memory rate limits** reset on restart / are per-process — acceptable for pilot scale; revisit with deployment (Phase 5).
- **Allowlist default unconfirmed** — configuration placeholder pending the enrolled-student confirmation; blocking for launch, not for development.
- **users.name transitional** — moves to `student_profiles` in Phase 2.
