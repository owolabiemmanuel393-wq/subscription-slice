"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setServerError(null);
    setSuccessMessage(null);

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setServerError(data.message || "Too many password reset requests. Please wait before trying again.");
        } else {
          setServerError(data.message || "Unable to process request. Please try again.");
        }
        return;
      }

      // Generic success message to avoid email enumeration
      setSuccessMessage(
        data.message ||
          "If an account exists with that email, we have sent instructions to reset your password."
      );
    } catch {
      setServerError("An unexpected network error occurred. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="m3-card">
        <header className="m3-card-header">
          <span className="m3-app-brand">GymLog</span>
          <h1 className="m3-headline">Forgot password</h1>
          <p className="m3-body-subtext">
            Enter your email address and we&apos;ll send you a 6-digit code to reset your password.
          </p>
        </header>

        {serverError && (
          <div role="alert" className="m3-banner-error" id="forgot-password-server-error">
            {serverError}
          </div>
        )}

        {successMessage ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div role="status" className="m3-banner-success">
              {successMessage}
            </div>
            <Link
              href={`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`}
              className="m3-btn-filled"
            >
              Enter Reset Code
            </Link>
            <p className="m3-body-subtext" style={{ fontSize: "0.875rem" }}>
              In development mode, check your server terminal console for the printed 6-digit reset code.
            </p>
            <Link href="/signin" className="m3-btn-outlined">
              Return to Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="m3-form" noValidate>
            <div className="m3-field-group">
              <label htmlFor="forgot-email" className="m3-label">
                Email Address
              </label>
              <input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="m3-input"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={error ? "forgot-email-error" : undefined}
                placeholder="alex@example.com"
                disabled={isSubmitting}
              />
              {error && (
                <span id="forgot-email-error" role="alert" className="m3-field-error">
                  {error}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="m3-btn-filled"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Sending reset link..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <footer className="m3-card-footer">
          <Link href="/signin" className="m3-link">
            Back to Sign in
          </Link>
        </footer>
      </div>
    </div>
  );
}
