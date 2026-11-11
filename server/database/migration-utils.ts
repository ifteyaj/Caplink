import fs from "fs";
import type { DB } from "../config/database";

export interface TableSchemaInfo {
  name: string;
  sql: string | null;
}

export function getUserTables(db: DB): TableSchemaInfo[] {
  return db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as TableSchemaInfo[];
}

/**
 * Normalize a CREATE TABLE statement so that a migration file and the same
 * schema as stored in sqlite_master compare equal. Strips comments, the
 * IF NOT EXISTS clause, redundant whitespace, and casing.
 */
export function normalizeDdl(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/if\s+not\s+exists/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;$/, "")
    .toLowerCase();
}

export function getForeignKeyViolations(db: DB): unknown[] {
  return db.pragma("foreign_key_check") as unknown[];
}

export function getUserVersion(db: DB): number {
  return db.pragma("user_version", { simple: true }) as number;
}

export function setUserVersion(db: DB, version: number): void {
  db.pragma(`user_version = ${version}`);
}

/** Flush WAL pages into the main file so a file copy is complete. */
export function checkpointWal(db: DB): void {
  db.pragma("wal_checkpoint(TRUNCATE)");
}

/** Copy the database file before adopting an existing database. Returns "" when the file is absent. */
export function backupDatabaseFile(dbPath: string): string {
  if (!fs.existsSync(dbPath)) return "";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.pre-migration-${stamp}`;
  fs.copyFileSync(dbPath, backupPath);
  return backupPath;
}
