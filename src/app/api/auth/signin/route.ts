import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signInUser } from "@/lib/auth-service";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitKey = `signin:${ip}`;

  // Limit: 5 sign-in attempts per 10 minutes (600 seconds)
  const rateLimit = await checkRateLimit(rateLimitKey, 5, 600);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil(rateLimit.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        success: false,
        message: `Too many failed attempts. For your security, sign in has been locked. Please try again in ${minutes} minute${minutes > 1 ? "s" : ""} (${rateLimit.retryAfterSeconds}s).`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": rateLimit.retryAfterSeconds.toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const result = await signInUser(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }
}
