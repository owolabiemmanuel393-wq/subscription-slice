import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { resendVerificationCode } from "@/lib/auth-service";

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitKey = `resend:${ip}`;

  // Limit: 4 resend attempts per 10 minutes (600 seconds)
  const rateLimit = await checkRateLimit(rateLimitKey, 4, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        message: `Too many resend attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
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
    const result = await resendVerificationCode(body);

    if (!result.success) {
      const status = result.retryAfterSeconds ? 429 : 400;
      const headers: Record<string, string> = {};
      if (result.retryAfterSeconds) {
        headers["Retry-After"] = result.retryAfterSeconds.toString();
      }
      return NextResponse.json(result, { status, headers });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request payload." },
      { status: 400 }
    );
  }
}
