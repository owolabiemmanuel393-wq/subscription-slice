import { z } from "zod";
import { validateEmailAuthenticity } from "./email-validator";

/**
 * Shared validation rules and schemas for GymLog authentication.
 * Declared once here and reused across both client-side form validation
 * and server-side route/action validation.
 */

// Name schema: at least 2 characters, trimmed
export const nameSchema = z
  .string({ required_error: "Full name is required." })
  .trim()
  .min(2, { message: "Name must be at least 2 characters." })
  .max(60, { message: "Name cannot exceed 60 characters." });

// Email schema: valid RFC email, non-disposable domain, and normalized to lowercase
export const emailSchema = z
  .string({ required_error: "Email address is required." })
  .trim()
  .max(255, { message: "Email cannot exceed 255 characters." })
  .superRefine((val, ctx) => {
    const check = validateEmailAuthenticity(val);
    if (!check.isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid, authentic email address.",
      });
    }
  })
  .transform((val) => val.toLowerCase().trim());

// Password schema: minimum 8 characters, maximum 72 (due to bcrypt limits)
export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(8, { message: "Password must be at least 8 characters long." })
  .max(72, { message: "Password cannot exceed 72 characters." });

// 6-digit verification code schema
export const verificationCodeSchema = z
  .string({ required_error: "Verification code is required." })
  .trim()
  .regex(/^\d{6}$/, { message: "Verification code must be exactly 6 digits." });

/**
 * Schema for Sign Up (Create Account)
 * Fields: name, email, password
 */
export const signUpSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;

/**
 * Schema for Sign In
 * Fields: email, password
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string({ required_error: "Password is required." })
    .min(1, { message: "Password is required." }),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Schema for Forgot Password request
 * Fields: email
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema for Reset Password submission
 * Fields: email, code, password, confirmPassword
 */
export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z
      .string({ required_error: "Reset code is required." })
      .trim()
      .regex(/^\d{6}$/, { message: "Reset code must be exactly 6 digits." }),
    password: passwordSchema,
    confirmPassword: z.string({ required_error: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for Email Verification Code submission
 * Fields: email, code
 */
export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: verificationCodeSchema,
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * Schema for Resending Email Verification Code
 * Fields: email
 */
export const resendCodeSchema = z.object({
  email: emailSchema,
});

export type ResendCodeInput = z.infer<typeof resendCodeSchema>;
