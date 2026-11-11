import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createDefaultCodeSender } from "../../server/shared/email";
import {
  VALID_EMAIL,
  buildTestApp,
  lastCodeFor,
  sessionCookie,
  validListingPayload,
  type CapturingSender,
  type TestApp,
} from "../setup/test-app";
import { CODE_MAX_ATTEMPTS } from "../../server/modules/auth/auth.service";

const apps: TestApp[] = [];

function freshApp(options: Parameters<typeof buildTestApp>[0] = {}): TestApp {
  const testApp = buildTestApp(options);
  apps.push(testApp);
  return testApp;
}

afterAll(() => {
  for (const app of apps) app.cleanup();
});

describe("registration", () => {
  it("issues a code for an allowlisted address; dev_code only in development mode", async () => {
    const dev = freshApp({ devCodeDelivery: true });
    const res = await request(dev.app)
      .post("/api/auth/register")
      .send({ email: VALID_EMAIL, name: "Ada Lovelace" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toContain("verification code");
    expect(res.body.dev_code).toMatch(/^\d{6}$/);

    expect(dev.sender.messages).toHaveLength(1);
    expect(dev.sender.messages[0].to).toBe(VALID_EMAIL);
    expect(dev.sender.messages[0].code).toBe(res.body.dev_code);

    // Without devCodeDelivery (production-like), the code is never in the
    // response — it only exists via the sender port.
    const silent = freshApp();
    const quiet = await request(silent.app)
      .post("/api/auth/register")
      .send({ email: VALID_EMAIL });
    expect(quiet.status).toBe(200);
    expect(quiet.body.dev_code).toBeUndefined();
    expect(silent.sender.messages).toHaveLength(1);
  });

  it("rejects non-allowlisted domains without creating an account", async () => {
    const { app, database } = freshApp();
    const res = await request(app).post("/api/auth/register").send({ email: "student@gmail.com" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_EMAIL_DOMAIN");
    expect((database.db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c).toBe(0);
  });

  it("responds generically for new and existing accounts (no enumeration)", async () => {
    const { app, database } = freshApp({ devCodeDelivery: true });
    const first = await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    const second = await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // Same envelope shape, same message — the response does not reveal whether
    // the account already existed.
    expect(Object.keys(second.body).sort()).toEqual(Object.keys(first.body).sort());
    expect(second.body.message).toBe(first.body.message);
    expect((database.db.prepare("SELECT COUNT(*) AS c FROM users").get() as { c: number }).c).toBe(1);
  });

  it("accepts a name for new and unverified accounts only", async () => {
    const { app, database, sender } = freshApp({ devCodeDelivery: true });
    const nameOf = () =>
      (database.db.prepare("SELECT name FROM users WHERE email = ?").get(VALID_EMAIL) as {
        name: string;
      }).name;

    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL, name: "Ada" });
    expect(nameOf()).toBe("Ada");

    // Still unverified — renaming is allowed.
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL, name: "Ada Lovelace" });
    expect(nameOf()).toBe("Ada Lovelace");

    // Verify.
    const verify = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: VALID_EMAIL, code: lastCodeFor(sender, VALID_EMAIL) });
    expect(verify.status).toBe(200);

    // Verified identity — name updates from register are ignored (profile is Phase 2).
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL, name: "Someone Else" });
    expect(nameOf()).toBe("Ada Lovelace");
  });

  it("responds with INVALID_JSON for a malformed JSON body", async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JSON");
  });
});

describe("verification", () => {
  it("marks the account verified and issues an HttpOnly SameSite=Lax cookie", async () => {
    const { app, database } = freshApp({ devCodeDelivery: true });
    const register = await request(app)
      .post("/api/auth/register")
      .send({ email: VALID_EMAIL, name: "Ada" });
    const verify = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: VALID_EMAIL, code: register.body.dev_code });
    expect(verify.status).toBe(200);
    expect(verify.body.user).toMatchObject({
      email: VALID_EMAIL,
      name: "Ada",
      role: "student",
      email_verified: true,
    });

    const raw = (verify.headers["set-cookie"] as unknown as string[]).join(";");
    expect(raw).toContain("HttpOnly");
    expect(raw).toContain("SameSite=Lax");
    expect(raw).toContain("Path=/");

    // The session row stores a hash, never the raw token.
    const token = sessionCookie(verify).slice("session=".length);
    const session = database.db.prepare("SELECT token_hash FROM sessions").get() as {
      token_hash: string;
    };
    expect(session.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(session.token_hash).not.toBe(token);

    const user = database.db
      .prepare("SELECT email_verified_at, updated_at FROM users WHERE email = ?")
      .get(VALID_EMAIL) as { email_verified_at: string | null; updated_at: string | null };
    expect(user.email_verified_at).not.toBeNull();
    expect(user.updated_at).not.toBeNull();
  });

  it("rejects a wrong code and enforces the attempt cap", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app, database } = testApp;
    const realCode = await registerAndIssueCode(testApp);

    for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt += 1) {
      const wrong = await request(app)
        .post("/api/auth/verify-email")
        .send({ email: VALID_EMAIL, code: "000000" });
      expect(wrong.status).toBe(400);
      expect(wrong.body.code).toBe("INVALID_CODE");
    }

    // The cap is reached: even the real code no longer works and no session exists.
    const exhausted = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: VALID_EMAIL, code: realCode });
    expect(exhausted.status).toBe(400);
    expect((await request(app).get("/api/auth/me")).body.user).toBeNull();

    const codeRow = database.db
      .prepare(
        "SELECT attempt_count, consumed_at FROM email_verification_codes ORDER BY created_at DESC LIMIT 1",
      )
      .get() as { attempt_count: number; consumed_at: string | null };
    expect(codeRow.attempt_count).toBe(CODE_MAX_ATTEMPTS);
    expect(codeRow.consumed_at).not.toBeNull();
  });

  it("rejects an expired code", async () => {
    const { app, database } = freshApp({ devCodeDelivery: true });
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    database.db
      .prepare("UPDATE email_verification_codes SET expires_at = ?")
      .run(new Date(Date.now() - 1000).toISOString());
    const res = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CODE");
  });

  it("rejects verification for an unknown email (generic failure)", async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: "2024-9-99-999@std.ewubd.edu", code: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_CODE");
  });

  it("invalidates the previous code when a new one is issued", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app } = testApp;
    await registerAndIssueCode(testApp);
    const oldCode = lastCodeFor(testApp.sender, VALID_EMAIL);

    const resend = await request(app).post("/api/auth/resend-code").send({ email: VALID_EMAIL });
    expect(resend.status).toBe(200);
    const newCode = lastCodeFor(testApp.sender, VALID_EMAIL);
    expect(newCode).not.toBe(oldCode);

    const stale = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code: oldCode });
    expect(stale.status).toBe(400);

    const fresh = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code: newCode });
    expect(fresh.status).toBe(200);
  });

  it("consumes a code after successful verification (no replay)", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app } = testApp;
    const register = await request(app)
      .post("/api/auth/register")
      .send({ email: VALID_EMAIL });
    const code = register.body.dev_code as string;

    const first = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code });
    expect(first.status).toBe(200);
    const replay = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code });
    expect(replay.status).toBe(400);
    expect(replay.body.code).toBe("INVALID_CODE");
  });

  it("rotates sessions when a verified account re-verifies", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app } = testApp;

    const first = await verifiedRegisterVerify(testApp);
    const oldCookie = sessionCookie(first);
    const second = await verifiedRegisterVerify(testApp);
    const newCookie = sessionCookie(second);

    const oldMe = await request(app).get("/api/auth/me").set("Cookie", oldCookie);
    expect(oldMe.body.user).toBeNull();

    const newMe = await request(app).get("/api/auth/me").set("Cookie", newCookie);
    expect(newMe.body.user?.email).toBe(VALID_EMAIL);
  });
});

describe("sessions", () => {
  it("returns a null user for anonymous /api/auth/me and unknown tokens", async () => {
    const { app } = freshApp();
    expect((await request(app).get("/api/auth/me")).body).toEqual({ user: null });
    expect(
      (await request(app).get("/api/auth/me").set("Cookie", "session=totally-made-up")).body,
    ).toEqual({ user: null });
  });

  it("returns the public user shape from /api/auth/me", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const verify = await verifiedRegisterVerify(testApp, "Ada Lovelace");
    const me = await request(testApp.app).get("/api/auth/me").set("Cookie", sessionCookie(verify));
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual({
      id: expect.any(String),
      email: VALID_EMAIL,
      name: "Ada Lovelace",
      avatar_url: expect.stringContaining("data:image/svg"),
      role: "student",
      email_verified: true,
    });
  });

  it("logs out server-side: cookie cleared and session row deleted", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app, database } = testApp;
    const verify = await verifiedRegisterVerify(testApp);
    const cookie = sessionCookie(verify);

    const out = await request(app).post("/api/auth/logout").set("Cookie", cookie);
    expect(out.status).toBe(200);
    expect(out.body.success).toBe(true);
    const raw = (out.headers["set-cookie"] as unknown as string[]).join(";");
    expect(raw).toContain("session=;");

    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).body.user).toBeNull();
    expect(
      (database.db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c,
    ).toBe(0);
  });

  it("blocks unverified accounts from protected endpoints", async () => {
    const { app } = freshApp({ devCodeDelivery: true });
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    const res = await request(app).post("/api/listings").send(validListingPayload);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("expires sessions past their lifetime (lazy deletion)", async () => {
    const testApp = freshApp({ devCodeDelivery: true });
    const { app, database } = testApp;
    const verify = await verifiedRegisterVerify(testApp);
    database.db.prepare("UPDATE sessions SET expires_at = ?").run(
      new Date(Date.now() - 1000).toISOString(),
    );
    expect((await request(app).get("/api/auth/me").set("Cookie", sessionCookie(verify))).body.user).toBeNull();
    // The expired row was removed.
    expect(
      (database.db.prepare("SELECT COUNT(*) AS c FROM sessions").get() as { c: number }).c,
    ).toBe(0);
  });
});

describe("rate limits", () => {
  it("rate-limits registration per IP", async () => {
    const { app } = freshApp({ limits: { register: { windowMs: 60_000, max: 2 } } });
    for (let i = 0; i < 2; i += 1) {
      const ok = await request(app)
        .post("/api/auth/register")
        .send({ email: `2024-1-1-00${i}@std.ewubd.edu` });
      expect(ok.status).toBe(200);
    }
    const limited = await request(app)
      .post("/api/auth/register")
      .send({ email: "2024-1-1-999@std.ewubd.edu" });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
    expect(limited.body.retry_after).toBeGreaterThan(0);
  });

  it("enforces the resend cooldown per email+IP but not across addresses", async () => {
    const { app } = freshApp({ devCodeDelivery: true, limits: { resend: { windowMs: 60_000, max: 1 } } });
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    expect((await request(app).post("/api/auth/resend-code").send({ email: VALID_EMAIL })).status).toBe(200);
    expect((await request(app).post("/api/auth/resend-code").send({ email: VALID_EMAIL })).status).toBe(429);
    // A different address has its own bucket.
    expect(
      (await request(app).post("/api/auth/resend-code").send({ email: "2024-9-1-111@std.ewubd.edu" }))
        .status,
    ).toBe(200);
  });

  it("rate-limits verification attempts per IP", async () => {
    const testApp = freshApp({ devCodeDelivery: true, limits: { verify: { windowMs: 60_000, max: 3 } } });
    const { app } = testApp;
    await registerAndIssueCode(testApp);
    for (let i = 0; i < 3; i += 1) {
      const wrong = await request(app)
        .post("/api/auth/verify-email")
        .send({ email: VALID_EMAIL, code: "111111" });
      expect(wrong.status).toBe(400);
    }
    const limited = await request(app)
      .post("/api/auth/verify-email")
      .send({ email: VALID_EMAIL, code: "222222" });
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMITED");
  });
});

describe("CSRF", () => {
  it("rejects cross-origin unsafe requests", async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post("/api/auth/register")
      .set("Origin", "https://evil.example")
      .send({ email: VALID_EMAIL });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("CSRF_REJECTED");
  });

  it("allows same-origin unsafe requests", async () => {
    const { app } = freshApp();
    const res = await request(app)
      .post("/api/auth/register")
      .set("Host", "caplink.test")
      .set("Origin", "https://caplink.test")
      .send({ email: VALID_EMAIL });
    expect(res.status).toBe(200);
  });

  it("allows requests with no Origin header (non-browser clients)", async () => {
    const { app } = freshApp();
    const res = await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    expect(res.status).toBe(200);
  });
});

describe("production email contract", () => {
  it("fails loudly in production when no email provider is configured", async () => {
    const base = createDefaultCodeSender(true);
    const failingSender: CapturingSender = {
      messages: [],
      send: (message) => {
        base.send(message);
      },
    };
    const { app } = freshApp({
      isProduction: true,
      sender: failingSender,
    });
    const res = await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("EMAIL_NOT_CONFIGURED");
    // And no dev_code ever leaks in production mode.
    expect(res.body.dev_code).toBeUndefined();
  });

  it("marks the session cookie Secure in production", async () => {
    const testApp = freshApp({ isProduction: true });
    const { app } = testApp;
    await request(app).post("/api/auth/register").send({ email: VALID_EMAIL });
    const code = lastCodeFor(testApp.sender, VALID_EMAIL);
    const verify = await request(app).post("/api/auth/verify-email").send({ email: VALID_EMAIL, code });
    expect(verify.status).toBe(200);
    const raw = (verify.headers["set-cookie"] as unknown as string[]).join(";");
    expect(raw).toContain("Secure");
    expect(raw).toContain("SameSite=Lax");
  });
});

/** Helper: register an email and return its captured verification code. */
async function registerAndIssueCode(testApp: TestApp): Promise<string> {
  await request(testApp.app).post("/api/auth/register").send({ email: VALID_EMAIL });
  return lastCodeFor(testApp.sender, VALID_EMAIL);
}

/** Helper: full register→verify cycle, returning the verify response. */
async function verifiedRegisterVerify(testApp: TestApp, name?: string) {
  const register = await request(testApp.app)
    .post("/api/auth/register")
    .send(name ? { email: VALID_EMAIL, name } : { email: VALID_EMAIL });
  expect(register.status).toBe(200);
  const code = register.body.dev_code as string | undefined ?? lastCodeFor(testApp.sender, VALID_EMAIL);
  const verify = await request(testApp.app)
    .post("/api/auth/verify-email")
    .send({ email: VALID_EMAIL, code });
  expect(verify.status).toBe(200);
  return verify;
}
