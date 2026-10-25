"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyEmailSchema } from "@/lib/validations/auth";

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialEmail = searchParams.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Resend cooldown timer (60 seconds)
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCodeError(null);
    setServerError(null);
    setSuccessMessage(null);

    const validation = verifyEmailSchema.safeParse({ email, code });
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        if (issue.path[0] === "code") {
          setCodeError(issue.message);
        } else if (issue.path[0] === "email") {
          setServerError("Please enter a valid email address.");
        }
      }
      return;
    }

    setIsVerifying(true);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors?.code) {
          setCodeError(data.fieldErrors.code);
        }
        setServerError(data.message || "Failed to verify code.");
        return;
      }

      setSuccessMessage(data.message || "Email verified! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1000);
    } catch {
      setServerError("An unexpected network error occurred. Please check your connection.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    if (!email) {
      setServerError("Please enter your email to receive a new code.");
      return;
    }

    setIsResending(true);
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = data.retryAfterSeconds || 60;
          setCooldown(retryAfter);
          setServerError(data.message || `Rate limit reached. Please wait ${retryAfter} seconds.`);
        } else {
          setServerError(data.message || "Unable to resend verification code.");
        }
        return;
      }

      setSuccessMessage("A fresh 6-digit verification code has been sent!");
      // Reset 60s cooldown
      setCooldown(60);
    } catch {
      setServerError("An unexpected network error occurred. Please check your connection.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="m3-card">
        <header className="m3-card-header">
          <span className="m3-app-brand">GymLog</span>
          <h1 className="m3-headline">Verify email</h1>
          <p className="m3-body-subtext">
            Enter the 6-digit verification code sent to your email address.
          </p>
        </header>

        {serverError && (
          <div role="alert" className="m3-banner-error" id="verify-server-error">
            {serverError}
          </div>
        )}

        {successMessage && (
          <div role="status" className="m3-banner-success">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleVerify} className="m3-form" noValidate>
          {/* Email input (editable if user arrived without query param) */}
          <div className="m3-field-group">
            <label htmlFor="verify-email" className="m3-label">
              Email Address
            </label>
            <input
              id="verify-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="m3-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              disabled={isVerifying}
            />
          </div>

          {/* 6-Digit Code */}
          <div className="m3-field-group">
            <label htmlFor="verify-code" className="m3-label">
              6-Digit Verification Code
            </label>
            <input
              id="verify-code"
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
              className="m3-input"
              style={{
                letterSpacing: "0.4em",
                fontSize: "1.25rem",
                textAlign: "center",
                fontWeight: 700,
              }}
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setCode(val);
                if (codeError) setCodeError(null);
              }}
              aria-invalid={!!codeError}
              aria-describedby={codeError ? "verify-code-error" : undefined}
              placeholder="••••••"
              disabled={isVerifying}
            />
            {codeError && (
              <span id="verify-code-error" role="alert" className="m3-field-error">
                {codeError}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="m3-btn-filled"
            disabled={isVerifying || code.length !== 6}
            aria-busy={isVerifying}
          >
            {isVerifying ? "Verifying..." : "Verify Code"}
          </button>
        </form>

        {/* Resend Action with Server-Enforced Cooldown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || isResending}
            className="m3-btn-outlined"
            aria-label={
              cooldown > 0
                ? `Resend code available in ${cooldown} seconds`
                : "Resend verification code"
            }
          >
            {isResending
              ? "Sending code..."
              : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend Code"}
          </button>
        </div>

        <footer className="m3-card-footer">
          <Link href="/signin" className="m3-link">
            Return to Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-container">
          <div className="m3-card">
            <p className="m3-body-subtext">Loading email verification...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailForm />
    </Suspense>
  );
}
