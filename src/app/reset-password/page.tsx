"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { resetPasswordSchema } from "@/lib/validations/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialEmail = searchParams.get("email") || "";
  const initialCode = searchParams.get("code") || "";

  const [formData, setFormData] = useState({
    email: initialEmail,
    code: initialCode,
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setFormData((prev) => ({ ...prev, code: val }));
    if (errors.code) {
      setErrors((prev) => {
        const updated = { ...prev };
        delete updated.code;
        return updated;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);
    setErrors({});

    const validation = resetPasswordSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
        }
        setServerError(data.message || "Failed to reset password. The code may have expired.");
        return;
      }

      setIsSuccess(true);
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
          <h1 className="m3-headline">Reset password</h1>
          <p className="m3-body-subtext">
            Enter your 6-digit reset code and choose a new password.
          </p>
        </header>

        {serverError && (
          <div role="alert" className="m3-banner-error" id="reset-password-server-error">
            {serverError}
          </div>
        )}

        {isSuccess ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div role="status" className="m3-banner-success">
              Your password has been successfully reset! You can now sign in with your new password.
            </div>
            <button
              type="button"
              onClick={() => router.push("/signin")}
              className="m3-btn-filled"
            >
              Sign In Now
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="m3-form" noValidate>
            {/* Email */}
            <div className="m3-field-group">
              <label htmlFor="reset-email" className="m3-label">
                Email Address
              </label>
              <input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="m3-input"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "reset-email-error" : undefined}
                placeholder="alex@example.com"
                disabled={isSubmitting}
              />
              {errors.email && (
                <span id="reset-email-error" role="alert" className="m3-field-error">
                  {errors.email}
                </span>
              )}
            </div>

            {/* 6-Digit Code */}
            <div className="m3-field-group">
              <label htmlFor="reset-code" className="m3-label">
                6-Digit Reset Code
              </label>
              <input
                id="reset-code"
                name="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                required
                className="m3-input"
                style={{
                  letterSpacing: "0.3em",
                  fontSize: "1.25rem",
                  textAlign: "center",
                  fontWeight: 700,
                }}
                value={formData.code}
                onChange={handleCodeChange}
                aria-invalid={!!errors.code}
                aria-describedby={errors.code ? "reset-code-error" : undefined}
                placeholder="••••••"
                disabled={isSubmitting}
              />
              {errors.code && (
                <span id="reset-code-error" role="alert" className="m3-field-error">
                  {errors.code}
                </span>
              )}
            </div>

            {/* New Password */}
            <div className="m3-field-group">
              <label htmlFor="reset-new-password" className="m3-label">
                New Password
              </label>
              <input
                id="reset-new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="m3-input"
                value={formData.password}
                onChange={handleChange}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "reset-password-error" : undefined}
                placeholder="At least 8 characters"
                disabled={isSubmitting}
              />
              {errors.password && (
                <span id="reset-password-error" role="alert" className="m3-field-error">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm Password */}
            <div className="m3-field-group">
              <label htmlFor="reset-confirm-password" className="m3-label">
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                className="m3-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "reset-confirm-error" : undefined}
                placeholder="Re-enter your new password"
                disabled={isSubmitting}
              />
              {errors.confirmPassword && (
                <span id="reset-confirm-error" role="alert" className="m3-field-error">
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="m3-btn-filled"
              disabled={isSubmitting || formData.code.length !== 6}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? "Resetting password..." : "Reset Password"}
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page-container">
          <div className="m3-card">
            <p className="m3-body-subtext">Loading reset password form...</p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
