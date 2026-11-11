import express from "express";
import cookieParser from "cookie-parser";
import type { DB } from "./config/database";
import { apiNotFoundHandler, errorHandler } from "./middleware/errorHandler";
import { csrfOriginCheck } from "./middleware/csrf";
import { createRequireAuth } from "./middleware/requireAuth";
import { registerAuthRoutes, type AuthRouteLimits } from "./modules/auth/auth.routes";
import type { AuthConfig } from "./modules/auth/auth.service";
import { registerProjectRoutes } from "./modules/projects/project.routes";
import type { VerificationCodeSender } from "./shared/email";

export interface CreateAppOptions {
  db: DB;
  auth: {
    /** Pepper for verification-code hashes. Required in production (startup gate). */
    authSecret: string;
    allowedDomains: string[];
    sender: VerificationCodeSender;
    isProduction: boolean;
    /** Non-production only: include the code in the API response (dev_code). */
    devCodeDelivery: boolean;
  };
  /** Test-only rate-limit overrides; production uses the SPEC-002 defaults. */
  limits?: Partial<AuthRouteLimits>;
}

/**
 * Build the API application with an injected database and auth configuration.
 * Authentication is the verified-account OTP flow (SPEC-002): opaque
 * server-side sessions, domain allowlist, rate limits, CSRF origin checks.
 */
export function createApp(options: CreateAppOptions): express.Express {
  const app = express();
  const { db, auth } = options;

  app.use(express.json());
  app.use(cookieParser());

  // Cross-site state-changing requests are rejected before any handler runs
  // (defense in depth alongside SameSite=Lax session cookies).
  app.use(csrfOriginCheck);

  const requireAuth = createRequireAuth(db);

  const authConfig: AuthConfig = {
    db,
    authSecret: auth.authSecret,
    allowedDomains: auth.allowedDomains,
    sender: auth.sender,
    isProduction: auth.isProduction,
    devCodeDelivery: auth.devCodeDelivery,
  };
  registerAuthRoutes(app, { config: authConfig, limits: options.limits });
  registerProjectRoutes(app, { db, requireAuth });

  // --- Errors ---

  app.use("/api", apiNotFoundHandler);
  app.use(errorHandler);

  return app;
}
