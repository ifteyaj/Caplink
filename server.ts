import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import Database from "better-sqlite3";
import { z } from "zod";
import crypto from "crypto";

const db = new Database("caplink.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT CHECK(type IN ('solo', 'group')) NOT NULL,
    name TEXT NOT NULL,
    course TEXT NOT NULL,
    major TEXT NOT NULL,
    project_idea TEXT NOT NULL,
    skills TEXT NOT NULL, -- JSON array
    slots_open INTEGER,
    email TEXT NOT NULL,
    facebook TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Auth Middleware
const getUser = (req: express.Request) => {
  const session = req.cookies.session;
  if (!session) return null;
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
};

const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  (req as any).user = user;
  next();
};

// --- Auth Routes ---

app.post("/api/auth/login", (req, res) => {
  const { email, name } = req.body;

  // University Email Validation
  const uniRegex = /^\d{4}-\d{1,2}-\d{2,3}-\d{3}@gmail\.com$/;
  if (!uniRegex.test(email)) {
    return res.status(400).json({ error: "Only university accounts are allowed (format: YYYY-#-##-###@gmail.com)." });
  }

  // Simple User Object (Mocking ID with email for simplicity in this demo)
  const user = {
    id: email.replace(/[^a-zA-Z0-9]/g, ""),
    email: email,
    name: name || email.split("@")[0],
    avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
  };

  // Upsert User
  const stmt = db.prepare("INSERT OR REPLACE INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)");
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
  const listings = db.prepare("SELECT * FROM listings WHERE is_active = 1 ORDER BY created_at DESC").all();
  
  // Strip contact info if not logged in
  const sanitized = listings.map((l: any) => {
    const { email, facebook, ...rest } = l;
    return user ? l : { ...rest, email: null, facebook: null, is_locked: true };
  });

  res.json(sanitized);
});

app.get("/api/stats", (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as count FROM listings WHERE is_active = 1").get() as any;
  const solo = db.prepare("SELECT COUNT(*) as count FROM listings WHERE type = 'solo' AND is_active = 1").get() as any;
  const groups = db.prepare("SELECT COUNT(*) as count FROM listings WHERE type = 'group' AND is_active = 1").get() as any;
  res.json({ total: total.count, solo: solo.count, groups: groups.count });
});

app.post("/api/listings", requireAuth, (req, res) => {
  try {
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
      data.facebook || null
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error("Listing creation error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: error.issues });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/my-listings", requireAuth, (req, res) => {
  const user = (req as any).user;
  const listings = db.prepare("SELECT * FROM listings WHERE user_id = ? ORDER BY created_at DESC").all(user.id);
  res.json(listings);
});

app.delete("/api/listings/:id", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { id } = req.params;
  const stmt = db.prepare("DELETE FROM listings WHERE id = ? AND user_id = ?");
  const result = stmt.run(id, user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Not found or unauthorized" });
  res.json({ success: true });
});

// --- Vite Integration ---

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Caplink server running on http://localhost:${PORT}`);
  });
}

startServer();
