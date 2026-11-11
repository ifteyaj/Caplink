import fs from "fs";
import path from "path";
import type { DB } from "../config/database";
import { AppError } from "../shared/errors";
import {
  backupDatabaseFile,
  checkpointWal,
  getForeignKeyViolations,
  getUserTables,
  getUserVersion,
  normalizeDdl,
  setUserVersion,
} from "./migration-utils";

export interface MigrationFile {
  version: number;
  name: string;
  sql: string;
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  applied: number[];
  adoptedLegacy: boolean;
}

/** Load numbered migration files (NNN_name.sql), ordered by version, rejecting duplicates. */
export function loadMigrations(migrationsDir: string): MigrationFile[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new AppError("MIGRATIONS_DIR_MISSING", `Migrations directory not found: ${migrationsDir}`);
  }
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const seen = new Set<number>();
  const migrations = files.map((file) => {
    const match = /^(\d+)_/.exec(file);
    if (!match) {
      throw new AppError(
        "MIGRATION_NAMING",
        `Migration file must start with a numeric version prefix: ${file}`,
      );
    }
    const version = Number(match[1]);
    if (seen.has(version)) {
      throw new AppError("MIGRATION_DUPLICATE_VERSION", `Duplicate migration version ${version}`);
    }
    seen.add(version);
    return {
      version,
      name: file,
      sql: fs.readFileSync(path.join(migrationsDir, file), "utf8"),
    };
  });

  if (migrations.length === 0) {
    throw new AppError("MIGRATION_EMPTY", `No migration files found in ${migrationsDir}`);
  }
  return migrations;
}

type SchemaState = "empty" | "legacy" | "unknown";

function detectSchemaState(db: DB): SchemaState {
  const names = getUserTables(db)
    .map((table) => table.name)
    .sort();
  if (names.length === 0) return "empty";
  const expected = ["listings", "users"];
  if (names.length === expected.length && names.every((name, index) => name === expected[index])) {
    return "legacy";
  }
  return "unknown";
}

function assertForeignKeysEnabled(db: DB): void {
  const enabled = db.pragma("foreign_keys", { simple: true }) as number;
  if (enabled !== 1) {
    throw new AppError("MIGRATION_FK_DISABLED", "Foreign key enforcement is not active");
  }
}

function assertNoForeignKeyViolations(db: DB): void {
  const violations = getForeignKeyViolations(db);
  if (violations.length > 0) {
    throw new AppError(
      "MIGRATION_FK_VIOLATIONS",
      `Foreign key check reported ${violations.length} violation(s) — manual review required`,
    );
  }
}

/** Top-level statements of a migration file (our files contain no semicolons inside statements). */
function extractStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/**
 * Run pending migrations in order. Each migration runs in its own transaction
 * together with its user_version bump, so a failure leaves no partial changes.
 *
 * A version-0 database is either fresh (apply everything), a legacy database
 * matching the baseline schema (verify, back up, stamp), or unrecognized (abort).
 */
export function runMigrations(
  db: DB,
  options: { migrationsDir: string; databasePath?: string },
): MigrationResult {
  assertForeignKeysEnabled(db);
  const migrations = loadMigrations(options.migrationsDir);
  const fromVersion = getUserVersion(db);
  let adoptedLegacy = false;

  if (fromVersion === 0) {
    const state = detectSchemaState(db);
    if (state === "unknown") {
      throw new AppError(
        "MIGRATION_UNKNOWN_SCHEMA",
        "Database at version 0 has an unrecognized schema — manual review required",
      );
    }
    if (state === "legacy") {
      const baseline = migrations[0];
      const actual = getUserTables(db)
        .map((table) => normalizeDdl(table.sql ?? ""))
        .sort();
      const expected = extractStatements(baseline.sql)
        .map((statement) => normalizeDdl(statement))
        .sort();
      const matches =
        actual.length === expected.length && actual.every((sql, index) => sql === expected[index]);
      if (!matches) {
        throw new AppError(
          "MIGRATION_SCHEMA_MISMATCH",
          "Existing database does not match the migration baseline — manual review required",
        );
      }
      assertNoForeignKeyViolations(db);
      if (options.databasePath) {
        checkpointWal(db);
        const backupPath = backupDatabaseFile(options.databasePath);
        if (backupPath) console.log(`[migrate] backup created: ${backupPath}`);
      }
      db.transaction(() => {
        setUserVersion(db, baseline.version);
      })();
      adoptedLegacy = true;
      console.log(`[migrate] adopted legacy schema as version ${baseline.version}`);
    }
  }

  const applied: number[] = [];
  const current = getUserVersion(db);
  for (const migration of migrations) {
    if (migration.version <= current) continue;
    try {
      db.transaction(() => {
        db.exec(migration.sql);
        setUserVersion(db, migration.version);
      })();
      applied.push(migration.version);
      console.log(`[migrate] applied ${migration.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AppError(
        "MIGRATION_FAILED",
        `Migration ${migration.name} failed and was rolled back: ${message}`,
      );
    }
  }

  assertForeignKeysEnabled(db);
  assertNoForeignKeyViolations(db);
  const toVersion = getUserVersion(db);
  if (applied.length === 0 && !adoptedLegacy) {
    console.log("[migrate] database up to date");
  }
  return { fromVersion, toVersion, applied, adoptedLegacy };
}
