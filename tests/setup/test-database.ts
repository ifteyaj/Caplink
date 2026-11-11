import fs from "fs";
import os from "os";
import path from "path";
import { createDatabase, type DB } from "../../server/config/database";
import { runMigrations } from "../../server/database/migrate";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "server/database/migrations");
export const LEGACY_FIXTURE_PATH = path.resolve(process.cwd(), "tests/fixtures/legacy-schema.sql");

export interface TestDatabase {
  db: DB;
  filePath: string;
  directory: string;
  cleanup: () => void;
}

function removeTempDirectory(directory: string, db: DB): void {
  db.close();
  fs.rmSync(directory, { recursive: true, force: true });
}

/** Raw connection to a fresh temp database — user_version 0, no migrations run. */
export function createRawDatabase(): TestDatabase {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caplink-raw-"));
  const filePath = path.join(directory, "raw.db");
  const db = createDatabase(filePath);
  return {
    db,
    filePath,
    directory,
    cleanup: () => removeTempDirectory(directory, db),
  };
}

/** Fresh, fully migrated database in an isolated temp directory. */
export function createTestDatabase(): TestDatabase {
  const raw = createRawDatabase();
  runMigrations(raw.db, { migrationsDir: MIGRATIONS_DIR, databasePath: raw.filePath });
  return raw;
}

/** Database with the legacy (pre-migration) schema, left at user_version 0 for adoption tests. */
export function createLegacyDatabase(seed?: (db: DB) => void): TestDatabase {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caplink-legacy-"));
  const filePath = path.join(directory, "legacy.db");
  const db = createDatabase(filePath);
  db.exec(fs.readFileSync(LEGACY_FIXTURE_PATH, "utf8"));
  seed?.(db);
  return {
    db,
    filePath,
    directory,
    cleanup: () => removeTempDirectory(directory, db),
  };
}

export { MIGRATIONS_DIR };
