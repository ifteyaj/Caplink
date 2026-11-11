import request, { type Response } from "supertest";
import { expect } from "vitest";
import { createApp } from "../../server/app";
import type { AuthRouteLimits } from "../../server/modules/auth/auth.routes";
import { createTestDatabase, type TestDatabase } from "./test-database";
import type { VerificationCodeMessage, VerificationCodeSender } from "../../server/shared/email";

/** Fixed pepper for verification-code hashing in tests (>= 16 chars). */
export const TEST_AUTH_SECRET = "test-auth-secret-0123456789abcdef";

export interface CapturingSender extends VerificationCodeSender {
  /** Every code the auth service tried to deliver, in order. */
  messages: VerificationCodeMessage[];
}

function createCapturingSender(): CapturingSender {
  const messages: VerificationCodeMessage[] = [];
  return {
    messages,
    send(message: VerificationCodeMessage): void {
      messages.push(message);
    },
  };
}

export interface TestApp {
  app: ReturnType<typeof createApp>;
  database: TestDatabase;
  sender: CapturingSender;
  cleanup: () => void;
}

export interface BuildTestAppOptions {
  /** Return the code in the API response (dev_code), like development mode. */
  devCodeDelivery?: boolean;
  allowedDomains?: string[];
  /** Small rate limits so 429 paths are testable in milliseconds. */
  limits?: Partial<AuthRouteLimits>;
  isProduction?: boolean;
  /** Override the default capturing sender (e.g. the production failure sender). */
  sender?: CapturingSender;
}

/** App backed by a fresh, migrated temp database — never caplink.db. */
export function buildTestApp(options: BuildTestAppOptions = {}): TestApp {
  const database = createTestDatabase();
  const sender = options.sender ?? createCapturingSender();
  const isProduction = options.isProduction ?? false;
  const app = createApp({
    db: database.db,
    auth: {
      authSecret: TEST_AUTH_SECRET,
      allowedDomains: options.allowedDomains ?? ["std.ewubd.edu", "ewu.edu.bd"],
      sender,
      isProduction,
      devCodeDelivery: options.devCodeDelivery ?? false,
    },
    limits: options.limits,
  });
  return { app, database, sender, cleanup: database.cleanup };
}

export function sessionCookie(res: Response): string {
  const raw = res.headers["set-cookie"];
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("expected a session cookie in the response");
  }
  return raw[0].split(";")[0];
}

/** Most recently captured code for an address. */
export function lastCodeFor(sender: CapturingSender, email: string): string {
  for (let i = sender.messages.length - 1; i >= 0; i -= 1) {
    if (sender.messages[i].to === email) return sender.messages[i].code;
  }
  throw new Error(`no verification code was captured for ${email}`);
}

/**
 * Register + verify an email end-to-end through the captured code.
 * Returns the verify response (which carries the session cookie).
 */
export async function verifiedSession(
  testApp: TestApp,
  email: string = VALID_EMAIL,
  name?: string,
): Promise<Response> {
  const register = await request(testApp.app)
    .post("/api/auth/register")
    .send(name ? { email, name } : { email });
  expect(register.status).toBe(200);
  const verify = await request(testApp.app)
    .post("/api/auth/verify-email")
    .send({ email, code: lastCodeFor(testApp.sender, email) });
  expect(verify.status).toBe(200);
  return verify;
}

export const VALID_EMAIL = "2024-1-12-345@std.ewubd.edu";

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
