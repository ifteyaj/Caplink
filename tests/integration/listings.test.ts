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
  const testApp = buildTestApp({ devCodeDelivery: true });
  apps.push(testApp);
  return testApp;
}

afterAll(() => {
  for (const app of apps) app.cleanup();
});

/** Register + verify an account, returning the verify response (session cookie). */
async function verifyAccount(testApp: TestApp, email: string, name: string) {
  const register = await request(testApp.app)
    .post("/api/auth/register")
    .send({ email, name });
  expect(register.status).toBe(200);
  const verify = await request(testApp.app)
    .post("/api/auth/verify-email")
    .send({ email, code: register.body.dev_code });
  expect(verify.status).toBe(200);
  return verify;
}

describe("listings", () => {
  it("returns an empty list for a fresh database", async () => {
    const { app } = freshApp();
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("locks contact info for anonymous visitors and unlocks it for logged-in users", async () => {
    const testApp = freshApp();
    const auth = await verifyAccount(testApp, VALID_EMAIL, "Ada");
    await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(auth))
      .send(validListingPayload);

    const anon = await request(testApp.app).get("/api/listings");
    expect(anon.status).toBe(200);
    expect(anon.body).toHaveLength(1);
    expect(anon.body[0].is_locked).toBe(true);
    expect(anon.body[0].email).toBeNull();
    expect(anon.body[0].facebook).toBeNull();

    const authed = await request(testApp.app)
      .get("/api/listings")
      .set("Cookie", sessionCookie(auth));
    expect(authed.status).toBe(200);
    expect(authed.body[0].is_locked).toBeUndefined();
    expect(authed.body[0].email).toBe(VALID_EMAIL);
  });

  it("unlocks contact info only for a valid session token, not a garbage one", async () => {
    const testApp = freshApp();
    const auth = await verifyAccount(testApp, VALID_EMAIL, "Ada");
    await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(auth))
      .send(validListingPayload);

    // A forged cookie must NOT unlock contact info (old parse-any-cookie behavior).
    const forged = await request(testApp.app)
      .get("/api/listings")
      .set("Cookie", "session={\"id\":\"hacker\"}");
    expect(forged.body[0].is_locked).toBe(true);
    expect(forged.body[0].email).toBeNull();
  });

  it("rejects unauthenticated listing creation with 401", async () => {
    const { app } = freshApp();
    const res = await request(app).post("/api/listings").send(validListingPayload);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("creates a listing for an authenticated user", async () => {
    const testApp = freshApp();
    const auth = await verifyAccount(testApp, VALID_EMAIL, "Ada");
    const res = await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(auth))
      .send(validListingPayload);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.id).toBe("string");

    const row = testApp.database.db.prepare("SELECT * FROM listings WHERE id = ?").get(res.body.id) as
      | { user_id: string; skills: string; email: string; facebook: string }
      | undefined;
    expect(row).toBeDefined();
    expect(row?.user_id).toBe(auth.body.user.id);
    expect(JSON.parse(row?.skills ?? "[]")).toEqual(validListingPayload.skills);
    expect(row?.email).toBe(VALID_EMAIL);
    expect(row?.facebook).toBe("fb.com/ada");
  });

  it("returns structured validation errors for invalid listings", async () => {
    const testApp = freshApp();
    const auth = await verifyAccount(testApp, VALID_EMAIL, "Ada");
    const res = await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(auth))
      .send({ ...validListingPayload, project_idea: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details[0].path).toBe("project_idea");
  });

  it("counts active listings in /api/stats", async () => {
    const testApp = freshApp();
    const auth = await verifyAccount(testApp, VALID_EMAIL, "Ada");
    await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(auth))
      .send({ ...validListingPayload, type: "group", slots_open: 2 });

    const res = await request(testApp.app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 1, solo: 0, groups: 1 });
  });

  it("scopes deletion to the listing owner", async () => {
    const testApp = freshApp();
    const ownerEmail = VALID_EMAIL;
    const otherEmail = "2024-9-99-999@std.ewubd.edu";

    const owner = await verifyAccount(testApp, ownerEmail, "Owner");
    const created = await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(owner))
      .send(validListingPayload);
    const listingId = created.body.id as string;

    // Anonymous deletion
    const anon = await request(testApp.app).delete(`/api/listings/${listingId}`);
    expect(anon.status).toBe(401);

    // A different verified user's deletion
    const other = await verifyAccount(testApp, otherEmail, "Other");
    const notOwner = await request(testApp.app)
      .delete(`/api/listings/${listingId}`)
      .set("Cookie", sessionCookie(other));
    expect(notOwner.status).toBe(404);

    // Owner deletion succeeds
    const deleted = await request(testApp.app)
      .delete(`/api/listings/${listingId}`)
      .set("Cookie", sessionCookie(owner));
    expect(deleted.status).toBe(200);
    const remaining = await request(testApp.app).get("/api/stats");
    expect(remaining.body.total).toBe(0);
  });

  it("returns only the authenticated user's listings from /api/my-listings", async () => {
    const testApp = freshApp();
    const owner = await verifyAccount(testApp, VALID_EMAIL, "Owner");
    await request(testApp.app)
      .post("/api/listings")
      .set("Cookie", sessionCookie(owner))
      .send(validListingPayload);

    const other = await verifyAccount(testApp, "2024-1-99-111@std.ewubd.edu", "Other");
    const res = await request(testApp.app)
      .get("/api/my-listings")
      .set("Cookie", sessionCookie(other));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
