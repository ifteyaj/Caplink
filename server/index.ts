import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import express from "express";
import { createServer as createViteServer } from "vite";
import { parseEnv, parseAllowedDomains } from "./config/env";
import { createDatabase } from "./config/database";
import { runMigrations } from "./database/migrate";
import { createDefaultCodeSender } from "./shared/email";
import { createApp } from "./app";

async function main(): Promise<void> {
  const env = parseEnv(process.env);
  const isProduction = env.NODE_ENV === "production";

  // AUTH_SECRET peppers verification-code hashes. An ephemeral dev secret must
  // never silently protect real accounts, so production refuses to start
  // without one (fail fast, before any traffic is served).
  const authSecret =
    env.AUTH_SECRET ?? (isProduction ? undefined : crypto.randomBytes(32).toString("hex"));
  if (!authSecret) {
    throw new Error(
      "AUTH_SECRET is required in production — generate one with `openssl rand -hex 32`",
    );
  }

  const databasePath = path.resolve(env.DATABASE_PATH);
  const db = createDatabase(databasePath);
  const migrationsDir = path.resolve(process.cwd(), "server/database/migrations");
  runMigrations(db, { migrationsDir, databasePath });

  const app = createApp({
    db,
    auth: {
      authSecret,
      allowedDomains: parseAllowedDomains(env),
      // Development delivers codes via the API response (dev_code); production
      // sending fails loudly until a real provider is configured (Phase 5).
      sender: createDefaultCodeSender(isProduction),
      isProduction,
      devCodeDelivery: !isProduction,
    },
  });

  if (env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    if (!fs.existsSync(distDir)) {
      throw new Error(
        `Production frontend build not found at ${distDir} — run "npm run build" first`,
      );
    }
    app.use(express.static(distDir));
    app.get("*", (_req, res) => res.sendFile(path.join(distDir, "index.html")));
  }

  app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`Caplink server running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });
}

main().catch((error) => {
  console.error("[startup] failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
