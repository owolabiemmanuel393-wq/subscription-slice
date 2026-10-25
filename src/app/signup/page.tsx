"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpSchema } from "@/lib/validations/auth";

export default function SignUpPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error on edit
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
    setServerError(null);
    setErrors({});

    // Client-side validation using shared Zod schema
    const validation = signUpSchema.safeParse(formData);
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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setServerError(data.message || "Too many sign-up attempts. Please wait before trying again.");
        } else if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          if (data.message) setServerError(data.message);
        } else {
          setServerError(data.message || "Unable to create account. Please try again.");
        }
        return;
      }

      // Success: redirect to verify email screen with email in query param
      const targetEmail = data.data?.email || formData.email.toLowerCase().trim();
      router.push(`/verify-email?email=${encodeURIComponent(targetEmail)}`);
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
          <h1 className="m3-headline">Create account</h1>
          <p className="m3-body-subtext">Start tracking your workout progress today</p>
        </header>

        {serverError && (
          <div role="alert" className="m3-banner-error" id="signup-server-error">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="m3-form" noValidate>
          {/* Full Name */}
          <div className="m3-field-group">
            <label htmlFor="signup-name" className="m3-label">
              Full Name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="m3-input"
              value={formData.name}
              onChange={handleChange}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "signup-name-error" : undefined}
              placeholder="e.g. Alex Morgan"
              disabled={isSubmitting}
            />
            {errors.name && (
              <span id="signup-name-error" role="alert" className="m3-field-error">
                {errors.name}
              </span>
            )}
          </div>

          {/* Email Address */}
          <div className="m3-field-group">
            <label htmlFor="signup-email" className="m3-label">
              Email Address
            </label>
            <input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="m3-input"
              value={formData.email}
              onChange={handleChange}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "signup-email-error" : undefined}
              placeholder="alex@example.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <span id="signup-email-error" role="alert" className="m3-field-error">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password */}
          <div className="m3-field-group">
            <label htmlFor="signup-password" className="m3-label">
              Password
            </label>
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="m3-input"
              value={formData.password}
              onChange={handleChange}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "signup-password-error" : undefined}
              placeholder="At least 8 characters"
              disabled={isSubmitting}
            />
            {errors.password && (
              <span id="signup-password-error" role="alert" className="m3-field-error">
                {errors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="m3-btn-filled"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <footer className="m3-card-footer">
          <span>
            Already have an account?{" "}
            <Link href="/signin" className="m3-link">
              Sign in
            </Link>
          </span>
        </footer>
      </div>
    </div>
  );
}
