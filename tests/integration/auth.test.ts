import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import {
  VALID_EMAIL,
  buildTestApp,
  sessionCookie,
  validListingPayload,
  type TestApp,
} from "../setup/test-app";

const apps: TestApp[] = [];

function freshApp(): TestApp {
  const testApp = buildTestApp();
  apps.push(testApp);
  return testApp;
}

afterAll(() => {
  for (const app of apps) app.cleanup();
});

describe("auth", () => {
  it("returns a null user for anonymous /api/auth/me", async () => {
    const { app } = freshApp();
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
  });

  it("rejects a non-university email", async () => {
    const { app } = freshApp();
    const res = await request(app).post("/api/auth/login").send({ email: "student@gmail.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Only university accounts are allowed");
    expect(res.body.code).toBe("INVALID_EMAIL");
  });

  it("responds with INVALID_JSON for a malformed JSON body", async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JSON");
  });

  it("logs in and issues a session cookie", async () => {
    const { app } = freshApp();
    const res = await request(app).post("/api/auth/login").send({ email: VALID_EMAIL, name: "Ada" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe(VALID_EMAIL);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("clears the session cookie on logout", async () => {
    const { app } = freshApp();
    const res = await request(app).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const raw = res.headers["set-cookie"] as unknown;
    expect(Array.isArray(raw) ? raw.join("") : raw).toContain("session=;");
  });

  // D4 regression — SPEC-001 Workstream D.
  // Fails with the previous INSERT OR REPLACE upsert (FOREIGN KEY constraint
  // failed); passes with the corrected ON CONFLICT DO UPDATE upsert.
  it("lets a returning user with listings log in repeatedly, preserving id, created_at and listings", async () => {
    const { app, database } = freshApp();

    const first = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_EMAIL, name: "Ada Lovelace" });
    expect(first.status).toBe(200);
    const userId = first.body.user.id as string;

    const created = await request(app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(first))
      .send(validListingPayload);
    expect(created.status).toBe(200);

    const userAfterFirstLogin = database.db
      .prepare("SELECT created_at, rowid FROM users WHERE email = ?")
      .get(VALID_EMAIL) as { created_at: string; rowid: number };

    // Simulate a brand-new unauthenticated request (no cookies carried over).
    const second = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID_EMAIL, name: "Ada Lovelace" });
    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(userId);

    // User record identity preserved: one row, same physical row (rowid),
    // original created_at untouched. The legacy INSERT OR REPLACE deletes and
    // recreates the row, which changes the rowid and clobbers created_at —
    // so this assertion fails under the old destructive upsert.
    const users = database.db
      .prepare("SELECT id, email, created_at, rowid FROM users WHERE email = ?")
      .all(VALID_EMAIL);
    expect(users).toHaveLength(1);
    const userAfterSecondLogin = users[0] as { created_at: string; rowid: number };
    expect(userAfterSecondLogin.rowid).toBe(userAfterFirstLogin.rowid);
    expect(userAfterSecondLogin.created_at).toBe(userAfterFirstLogin.created_at);

    // The listing survived repeated login and still joins to its owner.
    const mine = await request(app)
      .get("/api/my-listings")
      .set("Cookie", sessionCookie(second));
    expect(mine.status).toBe(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].user_id).toBe(userId);

    expect(database.db.pragma("foreign_key_check")).toHaveLength(0);
    const joins = database.db
      .prepare("SELECT l.id FROM listings l JOIN users u ON u.id = l.user_id")
      .all();
    expect(joins).toHaveLength(1);
  });
});
