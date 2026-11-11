import { z } from "zod";
import { AppError } from "../shared/errors";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default("./caplink.db"),
});

export type Env = z.infer<typeof EnvSchema>;

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
