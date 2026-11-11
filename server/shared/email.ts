import { AppError } from "./errors";

export interface VerificationCodeMessage {
  to: string;
  code: string;
}

/**
 * Port for delivering one-time verification codes. Tests inject a capturing
 * implementation; production requires a real provider (deliberately unimplemented
 * until the Phase 5 pre-pilot decision — sending fails loudly, never silently);
 * development delivers via the API response (dev_code), never via logs.
 */
export interface VerificationCodeSender {
  send(message: VerificationCodeMessage): void | Promise<void>;
}

export function createDefaultCodeSender(isProduction: boolean): VerificationCodeSender {
  if (isProduction) {
    return {
      send() {
        throw new AppError(
          "EMAIL_NOT_CONFIGURED",
          "Email delivery is not configured — set EMAIL_PROVIDER settings before launch",
        );
      },
    };
  }
  return {
    send() {
      // Development: the code is returned in the API response (dev_code).
      // Deliberately not logged — codes must never appear in logs.
    },
  };
}
