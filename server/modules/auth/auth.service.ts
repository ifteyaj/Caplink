import crypto from "crypto";
import type { DB } from "../../config/database";
import { AppError } from "../../shared/errors";
import type { VerificationCodeSender } from "../../shared/email";
import {
  generateNumericCode,
  generateOpaqueToken,
  hashToken,
  hmacVerificationCode,
  initialsAvatar,
} from "../../shared/security";

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthConfig {
  db: DB;
  authSecret: string;
  allowedDomains: string[];
  sender: VerificationCodeSender;
  isProduction: boolean;
  /** Non-production only: return the code in the API response for local testing. */
  devCodeDelivery: boolean;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string;
  role: string;
  email_verified: boolean;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmailDomainAllowed(email: string, allowedDomains: string[]): void {
  const domain = email.split("@")[1] ?? "";
  if (!allowedDomains.includes(domain)) {
    throw new AppError(
      "INVALID_EMAIL_DOMAIN",
      `Only university addresses (${allowedDomains.join(", ")}) can register`,
      400,
    );
  }
}

function publicUser(row: {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string;
  email_verified_at: string | null;
}): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email.split("@")[0],
    avatar_url: row.avatar_url ?? initialsAvatar(row.email),
    role: row.role,
    email_verified: row.email_verified_at !== null,
  };
}

export interface RegisterResult {
  email: string;
  code: string;
}

/**
 * Register or re-request a verification code. Creates/reuses the account,
 * invalidates previous pending codes, and issues a fresh one. The response to
 * the client is generic (no account enumeration); the plaintext code exists
 * only transiently and is never stored or logged.
 */
export async function registerOrResendCode(
  config: AuthConfig,
  input: { email: string; name?: string },
): Promise<RegisterResult> {
  const { db } = config;
  const email = normalizeEmail(input.email);
  assertEmailDomainAllowed(email, config.allowedDomains);

  const nowIso = new Date().toISOString();
  const selectUser = db.prepare(
    "SELECT id, email, name, avatar_url, role, email_verified_at FROM users WHERE email = ?",
  );
  let row = selectUser.get(email) as
    | { id: string; email: string; name: string | null; avatar_url: string | null; role: string; email_verified_at: string | null }
    | undefined;

  if (!row) {
    const id = email.replace(/[^a-z0-9]/g, "");
    const displayName =
      typeof input.name === "string" && input.name.trim().length >= 2
        ? input.name.trim()
        : email.split("@")[0];
    db.prepare(
      "INSERT INTO users (id, email, name, avatar_url, role) VALUES (?, ?, ?, ?, 'student')",
    ).run(id, email, displayName, initialsAvatar(displayName));
    row = selectUser.get(email) as NonNullable<typeof row>;
  } else if (!row.email_verified_at && typeof input.name === "string" && input.name.trim().length >= 2) {
    // Only unverified users may still set their name; verified identity is
    // profile territory (Phase 2).
    db.prepare("UPDATE users SET name = ?, avatar_url = ?, updated_at = ? WHERE id = ?").run(
      input.name.trim(),
      initialsAvatar(input.name.trim()),
      nowIso,
      row.id,
    );
    row = selectUser.get(email) as NonNullable<typeof row>;
  }

  // A user has at most one active (unconsumed, unexpired) code — re-issuing
  // invalidates previous pending codes.
  db.prepare(
    "UPDATE email_verification_codes SET consumed_at = ? WHERE user_id = ? AND consumed_at IS NULL",
  ).run(nowIso, row.id);

  const code = generateNumericCode(6);
  db.prepare(
    "INSERT INTO email_verification_codes (id, user_id, code_hash, expires_at) VALUES (?, ?, ?, ?)",
  ).run(
    crypto.randomUUID(),
    row.id,
    hmacVerificationCode(config.authSecret, row.id, code),
    new Date(Date.now() + CODE_TTL_MS).toISOString(),
  );

  await config.sender.send({ to: email, code });
  return { email, code };
}

/**
 * Verify a one-time code. Wrong codes increment attempt_count; reaching the
 * attempt cap consumes the code. On success the code is consumed, the account
 * is marked verified, and all previous sessions are rotated into a fresh one.
 */
export function verifyEmail(
  config: AuthConfig,
  input: { email: string; code: string },
): { user: SessionUser; token: string; expiresAt: string } {
  const { db } = config;
  const email = normalizeEmail(input.email);
  const nowIso = new Date().toISOString();

  const user = db
    .prepare("SELECT id, email, name, avatar_url, role, email_verified_at FROM users WHERE email = ?")
    .get(email) as
    | { id: string; email: string; name: string | null; avatar_url: string | null; role: string; email_verified_at: string | null }
    | undefined;

  const invalid = new AppError("INVALID_CODE", "Invalid or expired verification code", 400);
  // Generic failure for unknown emails too — no account enumeration.
  if (!user) throw invalid;

  const active = db
    .prepare(
      "SELECT id, code_hash, attempt_count FROM email_verification_codes WHERE user_id = ? AND consumed_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
    )
    .get(user.id, nowIso) as { id: string; code_hash: string; attempt_count: number } | undefined;

  if (active && active.attempt_count >= CODE_MAX_ATTEMPTS) {
    db.prepare("UPDATE email_verification_codes SET consumed_at = ? WHERE id = ?").run(nowIso, active.id);
  }
  if (!active || active.attempt_count >= CODE_MAX_ATTEMPTS) throw invalid;

  if (hmacVerificationCode(config.authSecret, user.id, input.code) !== active.code_hash) {
    const attempts = active.attempt_count + 1;
    db.prepare("UPDATE email_verification_codes SET attempt_count = ?, consumed_at = ? WHERE id = ?").run(
      attempts,
      attempts >= CODE_MAX_ATTEMPTS ? nowIso : null,
      active.id,
    );
    throw invalid;
  }

  db.prepare("UPDATE email_verification_codes SET consumed_at = ? WHERE id = ?").run(nowIso, active.id);
  db.prepare(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
  ).run(nowIso, nowIso, user.id);

  const fresh = db
    .prepare("SELECT id, email, name, avatar_url, role, email_verified_at FROM users WHERE id = ?")
    .get(user.id) as NonNullable<typeof user>;

  // Session rotation: any existing session for this account is invalidated and
  // a fresh opaque token is issued (product spec §10).
  destroyAllSessions(config.db, user.id);
  const token = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
  ).run(crypto.randomUUID(), user.id, hashToken(token), expiresAt);

  return { user: publicUser(fresh), token, expiresAt };
}

/** Resolve a session cookie token to a verified user, or null. */
export function resolveSession(db: DB, token: unknown): SessionUser | null {
  if (typeof token !== "string" || token.length === 0) return null;
  const row = db
    .prepare(
      "SELECT u.id, u.email, u.name, u.avatar_url, u.role, u.email_verified_at, s.id AS session_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
    )
    .get(hashToken(token)) as
    | { session_id: string; expires_at: string; id: string; email: string; name: string | null; avatar_url: string | null; role: string; email_verified_at: string | null }
    | undefined;
  if (!row) return null;
  const nowIso = new Date().toISOString();
  if (row.expires_at <= nowIso) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(row.session_id);
    return null;
  }
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso, row.session_id);
  return publicUser(row);
}

export function destroySession(db: DB, token: unknown): void {
  if (typeof token !== "string" || token.length === 0) return;
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
}

export function destroyAllSessions(db: DB, userId: string): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}
