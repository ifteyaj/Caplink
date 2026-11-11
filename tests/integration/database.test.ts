import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../server/config/database";
import { AppError } from "../../server/shared/errors";

describe("createDatabase", () => {
  it("enables foreign keys and WAL journaling", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caplink-db-"));
    try {
      const db = createDatabase(path.join(directory, "db.sqlite"));
      expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
      db.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates missing parent directories", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caplink-db-"));
    try {
      const nested = path.join(directory, "a", "b", "caplink.db");
      const db = createDatabase(nested);
      expect(fs.existsSync(nested)).toBe(true);
      db.close();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("fails clearly when the path cannot be opened", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "caplink-db-"));
    try {
      const blocker = path.join(directory, "occupied");
      fs.mkdirSync(blocker); // a directory where a file would need to be
      expect(() => createDatabase(blocker)).toThrow(AppError);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
