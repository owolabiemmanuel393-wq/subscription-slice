import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { generateSecureToken, hashToken } from "@/lib/crypto";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/constants";

/**
 * Creates a new session for a user.
 * 1. Generates a cryptographically random session token.
 * 2. Persists ONLY the SHA-256 hash of this token in the database.
 * 3. Sets the raw token as an HttpOnly, SameSite=Lax, Secure cookie on the client response.
 *
 * @param userId ID of the authenticated user
 * @returns The raw session token
 */
export async function createSession(userId: string): Promise<string> {
  const rawToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(rawToken);

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  // Store only the hash in the database
  await prisma.session.create({
    data: {
      sessionTokenHash,
      userId,
      expiresAt,
    },
  });

  // Set the session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return rawToken;
}

/**
 * Validates the session from the incoming request cookies on the server.
 * Checks that the session exists in the database and has not expired.
 *
 * @returns The authenticated user and session, or null if unauthenticated.
 */
export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const sessionTokenHash = hashToken(token);

  // Query database checking both token hash AND that expiresAt is in the future
  const session = await prisma.session.findUnique({
    where: {
      sessionTokenHash,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isEmailVerified: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt < new Date()) {
    // Clean up expired session from DB
    await prisma.session.delete({
      where: { id: session.id },
    }).catch(() => {});
    return null;
  }

  return {
    user: session.user,
    session,
  };
}

/**
 * Destroys the current session:
 * 1. Removes the session record from the database.
 * 2. Clears the session cookie from the client.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const sessionTokenHash = hashToken(token);
    await prisma.session.deleteMany({
      where: { sessionTokenHash },
    }).catch(() => {});
  }

  // Clear cookie
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}
