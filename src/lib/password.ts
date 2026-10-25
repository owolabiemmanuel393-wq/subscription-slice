import bcrypt from "bcryptjs";

/**
 * Bcrypt cost factor (salt rounds).
 * As required by the engineering specification, we use cost factor 12.
 * Higher cost factor means more computational work, protecting against brute-force attacks.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt with a cost factor of 12.
 *
 * @param password The plaintext password to hash.
 * @returns Promise<string> The resulting bcrypt hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Compares a candidate plaintext password with an existing bcrypt hash.
 * Uses constant-time comparison internally to prevent timing attacks.
 *
 * @param password The plaintext password submitted by the user.
 * @param hash The stored bcrypt hash from the database.
 * @returns Promise<boolean> True if the password matches, false otherwise.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
