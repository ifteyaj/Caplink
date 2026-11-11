-- Legacy schema fixture: an exact copy of the pre-migration database schema that
-- server.ts created with CREATE TABLE IF NOT EXISTS on first launch. Used by
-- migration tests to simulate an existing (possibly non-empty) legacy database.

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE listings (
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
