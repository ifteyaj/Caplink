import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/errors";

interface ErrorPayload {
  status: number;
  error: string;
  code?: string;
  details?: unknown[];
}

/**
 * Flat, backward-compatible error envelope: `{ error: string, code?, details? }`.
 * `error` stays a plain message string because existing frontend consumers
 * render `data.error` directly (src/AuthContext.tsx, src/App.tsx).
 */
function toErrorPayload(error: unknown): ErrorPayload {
  if (error instanceof ZodError) {
    return {
      status: 400,
      error: "Validation failed",
      code: "VALIDATION_ERROR",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }
  if (error instanceof AppError) {
    return { status: error.status, error: error.message, code: error.code, details: error.details };
  }
  if (error instanceof SyntaxError && (error as { status?: number }).status === 400) {
    return { status: 400, error: "Malformed JSON body", code: "INVALID_JSON" };
  }
  if (typeof error === "object" && error !== null && "type" in error) {
    const type = (error as { type?: string }).type;
    if (type === "entity.too.large") {
      return { status: 413, error: "Request body too large", code: "PAYLOAD_TOO_LARGE" };
    }
    if (type === "entity.parse.failed") {
      return { status: 400, error: "Malformed JSON body", code: "INVALID_JSON" };
    }
  }
  if (error instanceof Error && error.name === "SqliteError") {
    console.error("[error] SqliteError:", error.message, (error as { code?: string }).code);
  }
  return { status: 500, error: "Internal server error", code: "INTERNAL_ERROR" };
}

/** JSON 404 for unmatched /api routes; other paths fall through to the frontend. */
export function apiNotFoundHandler(_req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
}

/** Central error handler. Never exposes stack traces or SQL internals to clients. */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const payload = toErrorPayload(error);
  if (payload.status >= 500) {
    console.error(`[error] ${payload.code ?? "INTERNAL_ERROR"}:`, error);
  }
  res.status(payload.status).json({
    error: payload.error,
    ...(payload.code ? { code: payload.code } : {}),
    ...(payload.details ? { details: payload.details } : {}),
  });
}
