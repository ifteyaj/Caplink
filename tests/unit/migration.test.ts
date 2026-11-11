import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { runMigrations } from "../../server/database/migrate";
import { getUserVersion } from "../../server/database/migration-utils";
import type { DB } from "../../server/config/database";
import { MIGRATIONS_DIR, createLegacyDatabase, createRawDatabase, createTestDatabase } from "../setup/test-database";
import { VALID_EMAIL } from "../setup/test-app";

function seedLegacyData(db: DB): void {
  db.prepare("INSERT INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)").run(
    "u1",
    VALID_EMAIL,
    "Legacy User",
    "https://avatar/u1",
  );
  db.prepare(
    "INSERT INTO listings (id, user_id, type, name, course, major, project_idea, skills, slots_open, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("l1", "u1", "solo", "Legacy Listing", "BSCS 3-2", "Computer Science", "Legacy capstone idea.", "[]", null, VALID_EMAIL);
}

describe("migration runner", () => {
  it("initializes a fresh database to the current version", () => {
    const { db, cleanup } = createRawDatabase();
    try {
      const result = runMigrations(db, { migrationsDir: MIGRATIONS_DIR });
      expect(result.applied).toEqual([1, 2]);
      expect(result.toVersion).toBe(2);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((row) => (row as { name: string }).name)
        .sort();
      expect(tables).toEqual(["email_verification_codes", "listings", "sessions", "users"]);
      expect(getUserVersion(db)).toBe(2);
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("adopts an existing legacy database without data loss", () => {
    const legacy = createLegacyDatabase(seedLegacyData);
    try {
      expect(getUserVersion(legacy.db)).toBe(0);

      const result = runMigrations(legacy.db, {
        migrationsDir: MIGRATIONS_DIR,
        databasePath: legacy.filePath,
      });

      expect(result.adoptedLegacy).toBe(true);
      expect(result.toVersion).toBe(2);
      expect(getUserVersion(legacy.db)).toBe(2);

      const user = legacy.db
        .prepare("SELECT id, email, name FROM users WHERE id = ?")
        .get("u1") as { id: string; email: string; name: string };
      expect(user.email).toBe(VALID_EMAIL);

      const listing = legacy.db.prepare("SELECT id, user_id FROM listings WHERE id = ?").get("l1") as {
        id: string;
        user_id: string;
      };
      expect(listing.user_id).toBe("u1");

      expect(legacy.db.pragma("foreign_key_check")).toHaveLength(0);
      const backupCreated = fs
        .readdirSync(legacy.directory)
        .some((file) => file.startsWith("legacy.db.pre-migration-"));
      expect(backupCreated).toBe(true);
    } finally {
      legacy.cleanup();
    }
  });

  it("aborts on an unrecognized schema without stamping", () => {
    const { db, cleanup } = createRawDatabase();
    try {
      db.exec("CREATE TABLE mystery (id INTEGER PRIMARY KEY)");
      expect(() => runMigrations(db, { migrationsDir: MIGRATIONS_DIR })).toThrow(
        /unrecognized schema/,
      );
      expect(getUserVersion(db)).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("rolls back a failed migration atomically and stops", () => {
    const directory = fs.mkdtempSync(path.join(process.cwd(), ".migration-test-"));
    try {
      fs.copyFileSync(
        path.join(MIGRATIONS_DIR, "001_initial_schema.sql"),
        path.join(directory, "001_initial_schema.sql"),
      );
      fs.copyFileSync(
        path.join(MIGRATIONS_DIR, "002_authentication.sql"),
        path.join(directory, "002_authentication.sql"),
      );
      fs.writeFileSync(
        path.join(directory, "003_doomed.sql"),
        "CREATE TABLE doomed (id INTEGER NOT NULL);\nINSERT INTO table_that_does_not_exist VALUES (1);\n",
      );

      const { db, cleanup } = createTestDatabase();
      try {
        expect(() => runMigrations(db, { migrationsDir: directory })).toThrow(/failed and was rolled back/);
        expect(getUserVersion(db)).toBe(2);
        const doomed = db
          .prepare("SELECT name FROM sqlite_master WHERE name = 'doomed'")
          .get();
        expect(doomed).toBeUndefined();
      } finally {
        cleanup();
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("is idempotent — repeated runs are safe no-ops", () => {
    const { db, cleanup } = createRawDatabase();
    try {
      const first = runMigrations(db, { migrationsDir: MIGRATIONS_DIR });
      const second = runMigrations(db, { migrationsDir: MIGRATIONS_DIR });
      expect(first.applied).toEqual([1, 2]);
      expect(second.applied).toEqual([]);
      expect(second.toVersion).toBe(2);
    } finally {
      cleanup();
    }
  });

  it("enforces foreign keys on the connection", () => {
    const { db, cleanup } = createTestDatabase();
    try {
      expect(() => {
        db.prepare(
          "INSERT INTO listings (id, user_id, type, name, course, major, project_idea, skills, slots_open, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run("bad", "ghost-user", "solo", "N", "BSCS", "CS", "Orphaned listing.", "[]", null, "x@gmail.com");
      }).toThrow(/FOREIGN KEY/);
    } finally {
      cleanup();
    }
  });
});

describe("migration 002 (authentication)", () => {
  it("extends an adopted v1 database with auth columns and tables, preserving data", () => {
    const legacy = createLegacyDatabase(seedLegacyData);
    try {
      const result = runMigrations(legacy.db, {
        migrationsDir: MIGRATIONS_DIR,
        databasePath: legacy.filePath,
      });
      // Adoption stamps v1, then 002 applies on top.
      expect(result.applied).toEqual([2]);
      expect(result.toVersion).toBe(2);

      // Existing user becomes an unverified student — no invented trust.
      const user = legacy.db
        .prepare("SELECT id, email, role, email_verified_at FROM users WHERE id = ?")
        .get("u1") as { id: string; email: string; role: string; email_verified_at: string | null };
      expect(user.role).toBe("student");
      expect(user.email_verified_at).toBeNull();

      // Listing untouched, still joins to its owner.
      expect(
        legacy.db.prepare("SELECT user_id FROM listings WHERE id = 'l1'").get(),
      ).toEqual({ user_id: "u1" });

      // New tables and their lookup indexes exist.
      const tables = legacy.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((row) => (row as { name: string }).name)
        .sort();
      expect(tables).toContain("email_verification_codes");
      expect(tables).toContain("sessions");
      const indexNames = legacy.db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'")
        .all()
        .map((row) => (row as { name: string }).name)
        .sort();
      expect(indexNames).toEqual(
        expect.arrayContaining(["idx_verification_codes_user_id", "idx_sessions_user_id"]),
      );

      expect(legacy.db.pragma("foreign_key_check")).toHaveLength(0);
    } finally {
      legacy.cleanup();
    }
  });

  it("normalizes existing emails to lowercase", () => {
    const legacy = createLegacyDatabase((db) => {
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "u2",
        "Mixed.Case@Std.ewubd.edu",
        "Case User",
      );
    });
    try {
      runMigrations(legacy.db, { migrationsDir: MIGRATIONS_DIR });
      const row = legacy.db.prepare("SELECT email FROM users WHERE id = 'u2'").get() as {
        email: string;
      };
      expect(row.email).toBe("mixed.case@std.ewubd.edu");
    } finally {
      legacy.cleanup();
    }
  });

  it("aborts (and rolls back) when lowercasing collides two emails", () => {
    const legacy = createLegacyDatabase((db) => {
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "u2",
        "User.A@Std.ewubd.edu",
        "Upper",
      );
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(
        "u3",
        "user.a@std.ewubd.edu",
        "Lower",
      );
    });
    try {
      expect(() =>
        runMigrations(legacy.db, { migrationsDir: MIGRATIONS_DIR }),
      ).toThrow(/failed and was rolled back/);

      // Adoption stamped v1; 002 was rolled back — original mixed-case data intact.
      expect(getUserVersion(legacy.db)).toBe(1);
      const emails = legacy.db
        .prepare("SELECT email FROM users WHERE id IN ('u2', 'u3') ORDER BY id")
        .all()
        .map((row) => (row as { email: string }).email);
      expect(emails).toEqual(["User.A@Std.ewubd.edu", "user.a@std.ewubd.edu"]);
    } finally {
      legacy.cleanup();
    }
  });
});
