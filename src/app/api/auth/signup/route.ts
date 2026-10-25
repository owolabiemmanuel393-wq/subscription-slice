import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { signUpUser } from "@/lib/auth-service";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitKey = `signup:${ip}`;

  // Limit: 5 sign-up attempts per 15 minutes (900 seconds)
  const rateLimit = await checkRateLimit(rateLimitKey, 5, 900);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: `Too many sign-up attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
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
    const result = await signUpUser(body);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }
}
