"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInSchema } from "@/lib/validations/auth";

const SIGNIN_LOCKOUT_STORAGE_KEY = "gymlog_signin_lockout_until";

export default function SignInPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Check and restore lockout on mount
  useEffect(() => {
    const storedLockout = localStorage.getItem(SIGNIN_LOCKOUT_STORAGE_KEY);
    if (storedLockout) {
      const lockoutUntil = parseInt(storedLockout, 10);
      const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (remaining > 0) {
        setLockoutSeconds(remaining);
      } else {
        localStorage.removeItem(SIGNIN_LOCKOUT_STORAGE_KEY);
      }
    }
  }, []);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;

    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          localStorage.removeItem(SIGNIN_LOCKOUT_STORAGE_KEY);
          setServerError(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setServerError(null);
    setErrors({});

    const validation = signInSchema.safeParse(formData);
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
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const retrySeconds = data.retryAfterSeconds || 600; // 10 minutes default
          setLockoutSeconds(retrySeconds);
          localStorage.setItem(
            SIGNIN_LOCKOUT_STORAGE_KEY,
            (Date.now() + retrySeconds * 1000).toString()
          );
          setServerError(
            data.message ||
              `Too many attempts. Sign in has been locked for 10 minutes. Please wait before retrying.`
          );
        } else if (data.data?.requiresVerification) {
          // User exists but has not verified email yet
          const emailParam = encodeURIComponent(data.data.email || formData.email.trim());
          router.push(`/verify-email?email=${emailParam}`);
          return;
        } else {
          // Generic message (prevent email enumeration)
          setServerError(data.message || "Invalid email or password.");
        }
        return;
      }

      // Clear any past lockout
      localStorage.removeItem(SIGNIN_LOCKOUT_STORAGE_KEY);

      // Successful sign in: refresh and navigate to protected dashboard
      router.push("/dashboard");
      router.refresh();
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
          <h1 className="m3-headline">Sign in</h1>
          <p className="m3-body-subtext">Welcome back. Enter your credentials to access your account.</p>
        </header>

        {(lockoutSeconds > 0 || serverError) && (
          <div role="alert" className="m3-banner-error" id="signin-server-error">
            {lockoutSeconds > 0
              ? `Too many failed attempts. Try again in ${formatTime(lockoutSeconds)}`
              : serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="m3-form" noValidate>
          {/* Email */}
          <div className="m3-field-group">
            <label htmlFor="signin-email" className="m3-label">
              Email Address
            </label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="m3-input"
              value={formData.email}
              onChange={handleChange}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "signin-email-error" : undefined}
              placeholder="alex@example.com"
              disabled={isSubmitting || lockoutSeconds > 0}
            />
            {errors.email && (
              <span id="signin-email-error" role="alert" className="m3-field-error">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="m3-field-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label htmlFor="signin-password" className="m3-label">
                Password
              </label>
              <Link href="/forgot-password" className="m3-btn-text" style={{ padding: "0 4px", fontSize: "0.8125rem" }}>
                Forgot password?
              </Link>
            </div>
            <input
              id="signin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="m3-input"
              value={formData.password}
              onChange={handleChange}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "signin-password-error" : undefined}
              placeholder="••••••••"
              disabled={isSubmitting || lockoutSeconds > 0}
            />
            {errors.password && (
              <span id="signin-password-error" role="alert" className="m3-field-error">
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="m3-btn-filled"
            disabled={isSubmitting || lockoutSeconds > 0}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <footer className="m3-card-footer">
          <span>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="m3-link">
              Create account
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
