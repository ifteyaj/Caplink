-- 001_initial_schema.sql
-- Baseline schema, adopted verbatim from the legacy server.ts initialization.
-- This migration must stay structurally identical to the legacy schema so that
-- existing databases are adopted (version-stamped) instead of rebuilt.

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('solo', 'group')) NOT NULL,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    major TEXT NOT NULL,
    project_idea TEXT NOT NULL,
    skills TEXT NOT NULL, -- JSON array
    slots_open INTEGER,
    email TEXT NOT NULL,
    facebook TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
