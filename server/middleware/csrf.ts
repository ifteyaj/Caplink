import type { NextFunction, Request, Response } from "express";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origin check for state-changing requests. Browsers attach Origin to unsafe
 * requests; a mismatch with the Host header means a cross-site request and is
 * rejected (defense in depth alongside SameSite=Lax cookies). Non-browser
 * clients (curl, tests) send no Origin and pass through.
 */
export function csrfOriginCheck(req: Request, res: Response, next: NextFunction): void {
  if (!UNSAFE_METHODS.has(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (!origin) {
    next();
    return;
  }
  let originHost: string | undefined;
  try {
    originHost = new URL(origin).host;
  } catch {
    originHost = undefined;
  }
  if (originHost && originHost === req.headers.host) {
    next();
    return;
  }
  res.status(403).json({ error: "Cross-origin request rejected", code: "CSRF_REJECTED" });
}
