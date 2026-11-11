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
  it("initializes a fresh database to the baseline version", () => {
    const { db, cleanup } = createRawDatabase();
    try {
      const result = runMigrations(db, { migrationsDir: MIGRATIONS_DIR });
      expect(result.applied).toEqual([1]);
      expect(result.toVersion).toBe(1);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
        .all()
        .map((row) => (row as { name: string }).name)
        .sort();
      expect(tables).toEqual(["listings", "users"]);
      expect(getUserVersion(db)).toBe(1);
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
      expect(result.toVersion).toBe(1);
      expect(getUserVersion(legacy.db)).toBe(1);

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
      fs.writeFileSync(
        path.join(directory, "002_doomed.sql"),
        "CREATE TABLE doomed (id INTEGER NOT NULL);\nINSERT INTO table_that_does_not_exist VALUES (1);\n",
      );

      const { db, cleanup } = createTestDatabase();
      try {
        expect(() => runMigrations(db, { migrationsDir: directory })).toThrow(/failed and was rolled back/);
        expect(getUserVersion(db)).toBe(1);
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
      expect(first.applied).toEqual([1]);
      expect(second.applied).toEqual([]);
      expect(second.toVersion).toBe(1);
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
