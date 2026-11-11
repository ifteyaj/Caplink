import crypto from "crypto";

/** Opaque, URL-safe session token. Only its hash is ever persisted. */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * One-time verification codes are stored as an HMAC of the user id and code so a
 * leaked database cannot be trivially brute-forced offline; rate limits and
 * attempt caps remain the primary defense.
 */
export function hmacVerificationCode(secret: string, userId: string, code: string): string {
  return crypto.createHmac("sha256", secret).update(`${userId}:${code}`).digest("hex");
}

export function generateNumericCode(digits = 6): string {
  const max = 10 ** digits;
  return String(crypto.randomInt(0, max)).padStart(digits, "0");
}

/**
 * Locally generated initials avatar (SVG data URI). Deliberately avoids sending
 * student emails to third-party avatar services (audit P2-6).
 */
export function initialsAvatar(nameOrEmail: string): string {
  const source = nameOrEmail.split("@")[0].trim();
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const initials = (words.length >= 2 ? words[0][0] + words[1][0] : source.slice(0, 2)).toUpperCase();
  const seed = [...source].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = seed % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
    `<rect width="64" height="64" rx="32" fill="hsl(${hue}, 55%, 45%)"/>` +
    `<text x="32" y="40" font-family="system-ui, sans-serif" font-size="24" font-weight="700" ` +
    `fill="#ffffff" text-anchor="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
