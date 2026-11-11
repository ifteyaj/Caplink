import crypto from "crypto";
import type { Request } from "express";

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
}

export interface RateLimiter {
  middleware: (req: Request, res: import("express").Response, next: import("express").NextFunction) => void;
  reset: () => void;
}

export function ipKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

/**
 * Minimal in-memory sliding-window rate limiter. Per-process state (resets on
 * restart) — acceptable for the single-process MVP, revisited at deployment.
 */
export function createRateLimiter(
  options: RateLimiterOptions,
  keyFrom: (req: Request) => string = ipKey,
): RateLimiter {
  const hits = new Map<string, number[]>();

  function middleware(
    req: Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) {
    const key = keyFrom(req);
    const now = Date.now();
    const windowStart = now - options.windowMs;
    const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
    if (recent.length >= options.max) {
      const retryAfter = Math.max(1, Math.ceil((recent[0] + options.windowMs - now) / 1000));
      res.status(429).json({
        error: "Too many requests — try again later",
        code: "RATE_LIMITED",
        retry_after: retryAfter,
      });
      return;
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  }

  return { middleware, reset: () => hits.clear() };
}

/** Combined key for per-account + per-IP limits (e.g., resend cooldown). */
export function ipAndEmailKey(req: Request): string {
  const body = (req.body ?? {}) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.toLowerCase() : "anonymous";
  return `${ipKey(req)}:${email}`;
}
