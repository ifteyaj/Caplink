import express from "express";
import cookieParser from "cookie-parser";
import { z } from "zod";
import crypto from "crypto";
import type { DB } from "./config/database";
import { apiNotFoundHandler, errorHandler } from "./middleware/errorHandler";

export interface CreateAppOptions {
  db: DB;
}

/**
 * Build the API application with an injected database connection.
 * All routes are migrated verbatim from the legacy server.ts; behavior is
 * preserved. Authentication is still the demo JSON cookie — it is replaced
 * by opaque server-side sessions in Phase 1 and must not be trusted before then.
 */
export function createApp({ db }: CreateAppOptions): express.Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // Auth Middleware (demo session — Phase 1 replaces this)
  const getUser = (req: express.Request) => {
    const session = req.cookies.session;
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  };

  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    (req as any).user = user;
    next();
  };

  // --- Auth Routes ---

  app.post("/api/auth/login", (req, res) => {
    const body = (req.body ?? {}) as { email?: unknown; name?: unknown };
    const email = typeof body.email === "string" ? body.email : "";
    const name = typeof body.name === "string" ? body.name : "";

    // University Email Validation
    const uniRegex = /^\d{4}-\d{1,2}-\d{2,3}-\d{3}@gmail\.com$/;
    if (!uniRegex.test(email)) {
      return res.status(400).json({
        error: "Only university accounts are allowed (format: YYYY-#-##-###@gmail.com).",
        code: "INVALID_EMAIL",
      });
    }

    // Simple User Object (Mocking ID with email for simplicity in this demo)
    const user = {
      id: email.replace(/[^a-zA-Z0-9]/g, ""),
      email: email,
      name: name || email.split("@")[0],
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    };

    // Upsert User — conflict-aware update that never deletes or recreates the
    // parent row, so listings that reference the user (foreign key) survive
    // repeated logins, and the physical row (rowid) and created_at are preserved.
    const stmt = db.prepare(`
      INSERT INTO users (id, email, name, avatar_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        email = excluded.email,
        name = excluded.name,
        avatar_url = excluded.avatar_url
    `);
    stmt.run(user.id, user.email, user.name, user.avatar_url);

    // Set Session Cookie
    res.cookie("session", JSON.stringify(user), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({ success: true, user });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("session", {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: getUser(req) });
  });

  // --- Listing Routes ---

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

  app.get("/api/listings", (req, res) => {
    const user = getUser(req);
    const listings = db
      .prepare("SELECT * FROM listings WHERE is_active = 1 ORDER BY created_at DESC")
      .all() as Record<string, unknown>[];

    // Strip contact info if not logged in
    const sanitized = listings.map((listing) => {
      if (user) return listing;
      const { email, facebook, ...rest } = listing;
      return { ...rest, email: null, facebook: null, is_locked: true };
    });

    res.json(sanitized);
  });

  app.get("/api/stats", (req, res) => {
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

  // --- Errors ---

  app.use("/api", apiNotFoundHandler);
  app.use(errorHandler);

  return app;
}
