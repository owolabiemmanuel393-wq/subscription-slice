import crypto from "crypto";

/**
 * Computes a SHA-256 hash of any input string.
 * Used to securely store tokens (session tokens, password reset tokens, verification codes)
 * in the database without storing raw plaintext values.
 *
 * @param value Plaintext string to hash.
 * @returns 64-character lowercase hex SHA-256 digest.
 */
export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Generates a cryptographically secure random hex token (default 32 bytes / 64 hex characters).
 * Used for session tokens and password reset tokens.
 *
 * @param bytes Number of random bytes to generate (default: 32).
 * @returns Cryptographically secure hex string.
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Generates a cryptographically secure 6-digit verification code (e.g., "482910").
 * Uses crypto.randomInt to guarantee uniform distribution without modulo bias.
 *
 * @returns 6-digit string from "100000" to "999999".
 */
export function generateVerificationCode(): string {
  const code = crypto.randomInt(100000, 1000000);
  return code.toString();
}
