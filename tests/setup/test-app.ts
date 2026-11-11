import request, { type Response } from "supertest";
import { createApp } from "../../server/app";
import { createTestDatabase, type TestDatabase } from "./test-database";

export interface TestApp {
  app: ReturnType<typeof createApp>;
  database: TestDatabase;
  cleanup: () => void;
}

/** App backed by a fresh, migrated temp database — never caplink.db. */
export function buildTestApp(): TestApp {
  const database = createTestDatabase();
  const app = createApp({ db: database.db });
  return { app, database, cleanup: database.cleanup };
}

export function sessionCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("expected a session cookie in the response");
  }
  return raw[0].split(";")[0];
}

export const VALID_EMAIL = "2024-1-12-345@gmail.com";

export const validListingPayload = {
  type: "solo",
  name: "Ada Lovelace",
  course: "BSCS 3-2",
  major: "Computer Science",
  project_idea: "A capstone project exploring automated code verification.",
  skills: ["React", "SQL"],
  slots_open: null,
  email: VALID_EMAIL,
  facebook: "fb.com/ada",
} as const;
