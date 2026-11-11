import { z } from "zod";
import type { Express } from "express";
import type { AuthConfig } from "./auth.service";
import { destroySession, registerOrResendCode, resolveSession, SESSION_TTL_MS, verifyEmail } from "./auth.service";
import { createRateLimiter, ipAndEmailKey, type RateLimiter } from "../../middleware/rateLimit";

export interface AuthRouteLimits {
  register: { windowMs: number; max: number };
  resend: { windowMs: number; max: number };
  verify: { windowMs: number; max: number };
}

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(2).max(80).optional(),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
});

const GENERIC_SEND_MESSAGE = "If the address is eligible, a verification code has been sent.";

type CookieSetter = Parameters<(res: import("express").Response) => void>[0];

function setSessionCookie(res: CookieSetter, token: string, isProduction: boolean): void {
  res.cookie("session", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function registerAuthRoutes(
  app: Express,
  deps: { config: AuthConfig; limits?: Partial<AuthRouteLimits> },
): void {
  const { config } = deps;

  const limiters: { register: RateLimiter; resend: RateLimiter; verify: RateLimiter } = {
    register: createRateLimiter(deps.limits?.register ?? { windowMs: 60 * 60 * 1000, max: 20 }),
    resend: createRateLimiter(deps.limits?.resend ?? { windowMs: 60 * 1000, max: 1 }, ipAndEmailKey),
    verify: createRateLimiter(deps.limits?.verify ?? { windowMs: 10 * 1000, max: 10 }),
  };

  const requestCode = async (req: import("express").Request, res: CookieSetter) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = registerSchema.parse(body);
    const result = await registerOrResendCode(config, { email: parsed.email, name: parsed.name });
    res.json({
      success: true,
      message: GENERIC_SEND_MESSAGE,
      ...(config.devCodeDelivery ? { dev_code: result.code } : {}),
    });
  };

  app.post("/api/auth/register", limiters.register.middleware, (req, res, next) => {
    requestCode(req, res).catch(next);
  });

  app.post("/api/auth/resend-code", limiters.resend.middleware, (req, res, next) => {
    requestCode(req, res).catch(next);
  });

  app.post("/api/auth/verify-email", limiters.verify.middleware, (req, res, next) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = verifySchema.parse(body);
    const result = verifyEmail(config, { email: parsed.email, code: parsed.code });
    setSessionCookie(res, result.token, config.isProduction);
    res.json({ success: true, user: result.user });
  });

  app.post("/api/auth/logout", (req, res) => {
    destroySession(config.db, (req.cookies as { session?: unknown })?.session);
    res.clearCookie("session", {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: "lax",
      path: "/",
    });
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: resolveSession(config.db, (req.cookies as { session?: unknown })?.session) });
  });
}
