import { z } from "zod";
import crypto from "crypto";
import type { Express, RequestHandler } from "express";
import type { DB } from "../../config/database";
import { resolveSession } from "../auth/auth.service";

const listingSchema = z.object({
  type: z.enum(["solo", "group"]),
  name: z.string().min(2),
  course: z.string().min(2),
  major: z.string().min(2),
  project_idea: z.string().min(10),
  skills: z.array(z.string()),
  slots_open: z.number().nullable(),
  email: z.string().email(),
  facebook: z.string().optional(),
});

/**
 * Listings routes, migrated verbatim from the legacy server.ts via server/app.ts.
 * Behavior is unchanged; the model is redesigned in Phase 3.
 */
export function registerProjectRoutes(
  app: Express,
  deps: { db: DB; requireAuth: RequestHandler },
): void {
  const { db, requireAuth } = deps;

  app.get("/api/listings", (req, res) => {
    // Contact info unlocks only for a valid (verified) session.
    const user = resolveSession(db, (req.cookies as { session?: unknown })?.session);
    const listings = db
      .prepare("SELECT * FROM listings WHERE is_active = 1 ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];

    const sanitized = listings.map((listing) => {
      if (user) return listing;
      const { email, facebook, ...rest } = listing;
      return { ...rest, email: null, facebook: null, is_locked: true };
    });

    res.json(sanitized);
  });

  app.get("/api/stats", (_req, res) => {
    const total = db.prepare("SELECT COUNT(*) as count FROM listings WHERE is_active = 1").get() as {
      count: number;
    };
    const solo = db
      .prepare("SELECT COUNT(*) as count FROM listings WHERE type = 'solo' AND is_active = 1")
      .get() as { count: number };
    const groups = db
      .prepare("SELECT COUNT(*) as count FROM listings WHERE type = 'group' AND is_active = 1")
      .get() as { count: number };
    res.json({ total: total.count, solo: solo.count, groups: groups.count });
  });

  app.post("/api/listings", requireAuth, (req, res) => {
    const data = listingSchema.parse(req.body);
    const user = (req as any).user;
    const id = crypto.randomUUID();

    const stmt = db.prepare(`
      INSERT INTO listings (id, user_id, type, name, course, major, project_idea, skills, slots_open, email, facebook)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      user.id,
      data.type,
      data.name,
      data.course,
      data.major,
      data.project_idea,
      JSON.stringify(data.skills),
      data.slots_open,
      data.email,
      data.facebook || null,
    );

    res.json({ success: true, id });
  });

  app.get("/api/my-listings", requireAuth, (req, res) => {
    const user = (req as any).user;
    const listings = db
      .prepare("SELECT * FROM listings WHERE user_id = ? ORDER BY created_at DESC")
      .all(user.id);
    res.json(listings);
  });

  app.delete("/api/listings/:id", requireAuth, (req, res) => {
    const user = (req as any).user;
    const { id } = req.params;
    const stmt = db.prepare("DELETE FROM listings WHERE id = ? AND user_id = ?");
    const result = stmt.run(id, user.id);
    if (result.changes === 0)
      return res.status(404).json({ error: "Not found or unauthorized", code: "NOT_FOUND" });
    res.json({ success: true });
  });
}
