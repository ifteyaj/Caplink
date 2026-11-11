import type { RequestHandler } from "express";
import type { DB } from "../config/database";
import { resolveSession } from "../modules/auth/auth.service";

/**
 * Session-backed authentication. Sessions are issued only to verified accounts,
 * so reaching any requireAuth route implies a verified, eligible account
 * (Phase 1 exit condition). Expired sessions are lazily removed.
 */
export function createRequireAuth(db: DB): RequestHandler {
  return (req, res, next) => {
    const user = resolveSession(db, (req.cookies as { session?: unknown })?.session);
    if (!user) {
      res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
      return;
    }
    (req as any).user = user;
    next();
  };
}
