-- 002_authentication.sql
-- Phase 1 (SPEC-002): verified-account authentication foundation.
-- - users gains role, email_verified_at, updated_at; emails normalized to lowercase
-- - email_verification_codes stores HMAC hashes of one-time codes (never plaintext)
-- - sessions stores SHA-256 hashes of opaque tokens (never raw tokens)
-- Existing users become unverified students; their listings are untouched.

ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN email_verified_at DATETIME;
ALTER TABLE users ADD COLUMN updated_at DATETIME;

-- Normalize emails. If two rows collide after lowercasing, the UNIQUE constraint
-- aborts this transaction and the migration is rolled back for manual review.
UPDATE users SET email = lower(email);

CREATE TABLE email_verification_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_verification_codes_user_id ON email_verification_codes(user_id);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
