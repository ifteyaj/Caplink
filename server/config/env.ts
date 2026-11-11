import { z } from "zod";
import { AppError } from "../shared/errors";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default("./caplink.db"),
  // Comma-separated university email domains that may register.
  EWU_ALLOWED_EMAIL_DOMAINS: z.string().min(1).default("std.ewubd.edu,ewu.edu.bd"),
  // Required in production (enforced at startup); dev generates an ephemeral
  // secret when unset. Pepper for verification-code hashes; never logged.
  AUTH_SECRET: z.string().min(16).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseAllowedDomains(env: Env): string[] {
  return env.EWU_ALLOWED_EMAIL_DOMAINS.split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Parse and validate process environment values. Pure function of its input so
 * startup code and tests can call it without touching process.env.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError("INVALID_ENV", "Invalid environment configuration", 500, details);
  }
  return result.data;
}
