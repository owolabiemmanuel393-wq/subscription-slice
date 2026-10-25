import prisma from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Enforces database-backed rate limiting.
 * Storing rate-limiting counters in the database ensures persistence across
 * serverless function restarts and horizontal multi-instance deployments.
 *
 * @param key Unique identifier combining action and subject (e.g., "signin:127.0.0.1")
 * @param maxAttempts Maximum allowed requests in the time window
 * @param windowSeconds Window length in seconds
 * @returns RateLimitResult with allowed boolean, remaining attempts, and retryAfterSeconds
 */
export async function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  // Look up existing rate limit record
  const existing = await prisma.rateLimit.findUnique({
    where: { key },
  });

  // If no record exists or window has expired, reset/create counter
  if (!existing || existing.resetAt <= now) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count: 1,
        resetAt,
      },
      update: {
        count: 1,
        resetAt,
      },
    });

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      retryAfterSeconds: 0,
    };
  }

  // Window is currently active
  if (existing.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
    );

    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  // Increment counter within current active window
  const updated = await prisma.rateLimit.update({
    where: { key },
    data: {
      count: {
        increment: 1,
      },
    },
  });

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - updated.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Extracts the client IP from request headers.
 * Uses x-forwarded-for or x-real-ip fallback.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
