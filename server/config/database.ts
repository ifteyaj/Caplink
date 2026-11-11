import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { AppError } from "../shared/errors";

export type DB = Database.Database;

/**
 * Open (and create if needed) the SQLite database at an explicit path.
 * Foreign key enforcement is enabled and verified on every connection.
 */
export function createDatabase(rawPath: string): DB {
  const absolutePath = path.resolve(rawPath);

  try {
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  } catch {
    throw new AppError(
      "DATABASE_PATH_UNAVAILABLE",
      `Cannot create the directory for the database at ${absolutePath}`,
    );
  }

  let db: DB;
  try {
    db = new Database(absolutePath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AppError(
      "DATABASE_OPEN_FAILED",
      `Cannot open SQLite database at ${absolutePath}: ${message}`,
    );
  }

  db.pragma("foreign_keys = ON");
  const fkEnabled = db.pragma("foreign_keys", { simple: true }) as number;
  if (fkEnabled !== 1) {
    db.close();
    throw new AppError(
      "DATABASE_FK_NOT_ENFORCED",
      "SQLite refused to enable foreign key enforcement",
    );
  }

  db.pragma("busy_timeout = 5000");
  db.pragma("journal_mode = WAL");
  return db;
}
