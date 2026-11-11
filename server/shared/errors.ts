/**
 * Shared application error with a stable machine-readable code.
 * Server middleware maps this to the API error envelope without leaking internals.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown[];

  constructor(code: string, message: string, status = 500, details?: unknown[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
