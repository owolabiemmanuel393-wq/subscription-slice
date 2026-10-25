import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { generateSecureToken, generateVerificationCode, hashToken } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { createSession, destroySession } from "@/lib/session";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendCodeSchema,
} from "@/lib/validations/auth";

// Verification code expiration: 15 minutes
const VERIFICATION_CODE_EXPIRY_MS = 15 * 60 * 1000;
// Maximum allowed failed verification attempts per code
const MAX_VERIFICATION_ATTEMPTS = 5;
// Resend cooldown in seconds
const RESEND_COOLDOWN_SECONDS = 60;
// Password reset token validity: 30 minutes
const RESET_TOKEN_EXPIRY_MS = 30 * 60 * 1000;

export interface AuthActionResult<T = unknown> {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
  retryAfterSeconds?: number;
}

/**
 * Signs up a new user idempotently.
 * Enforces email normalization, bcrypt cost factor 12 password hashing,
 * and database-level unique constraint handling.
 */
export async function signUpUser(rawData: unknown): Promise<AuthActionResult<{ email: string; requiresVerification: boolean }>> {
  // 1. Shared Zod validation on the server (never trust client)
  const validation = signUpSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }
    return {
      success: false,
      message: "Please fix the validation errors below.",
      fieldErrors,
    };
  }

  const { name, email, password } = validation.data;

  // 2. Hash password with bcrypt cost factor 12
  const passwordHash = await hashPassword(password);

  try {
    // 3. Create user in database
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        isEmailVerified: false,
      },
    });

    // 4. Generate & send 6-digit email verification code
    await issueVerificationCode(newUser.id, newUser.email);

    return {
      success: true,
      message: "Account created! Please check your email for the 6-digit verification code.",
      data: { email: newUser.email, requiresVerification: true },
    };
  } catch (error) {
    // 5. Handle unique constraint violation idempotently (Prisma error code P2002)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Find existing user
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser && !existingUser.isEmailVerified) {
        // If account exists but email is not verified yet, resend code and guide them to verification
        await issueVerificationCode(existingUser.id, existingUser.email).catch(() => {});
        return {
          success: true,
          message: "An account with this email already exists and is pending verification. A fresh code has been sent.",
          data: { email: existingUser.email, requiresVerification: true },
        };
      }

      // If already verified, return clear guidance without crashing
      return {
        success: false,
        message: "An account with this email already exists. Please sign in instead.",
        fieldErrors: {
          email: "An account with this email already exists.",
        },
      };
    }

    console.error("Sign up error:", error);
    return {
      success: false,
      message: "An unexpected error occurred while creating your account. Please try again.",
    };
  }
}

/**
 * Issues a fresh 6-digit verification code for a user.
 * Enforces server-side 60s resend cooldown.
 */
export async function issueVerificationCode(
  userId: string,
  email: string
): Promise<{ success: boolean; error?: string; retryAfterSeconds?: number }> {
  const now = new Date();

  // Enforce server-side 60s cooldown
  const latestCode = await prisma.emailVerificationCode.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (latestCode) {
    const elapsedSeconds = (now.getTime() - latestCode.createdAt.getTime()) / 1000;
    if (elapsedSeconds < RESEND_COOLDOWN_SECONDS) {
      const remainingSeconds = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
      return {
        success: false,
        error: `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} before requesting a new code.`,
        retryAfterSeconds: remainingSeconds,
      };
    }
  }

  // Delete previous active verification codes for this user to keep only the newest
  await prisma.emailVerificationCode.deleteMany({
    where: { userId },
  });

  // Generate cryptographically secure 6-digit code
  const rawCode = generateVerificationCode();
  const codeHash = hashToken(rawCode);
  const expiresAt = new Date(now.getTime() + VERIFICATION_CODE_EXPIRY_MS);

  // Store hashed code with expiry and 0 attempts
  await prisma.emailVerificationCode.create({
    data: {
      userId,
      codeHash,
      attempts: 0,
      expiresAt,
    },
  });

  // Dispatch email (logs to terminal in development)
  await sendEmail({
    to: email,
    subject: "Your GymLog Verification Code",
    text: `Your GymLog verification code is: ${rawCode}\n\nThis code will expire in 15 minutes.\nIf you did not request this, please ignore this email.`,
  });

  return { success: true };
}

/**
 * Verifies the 6-digit email code.
 * Checks expiresAt column directly in the database query.
 * Enforces maximum failed attempts per code.
 */
export async function verifyEmailCode(rawData: unknown): Promise<AuthActionResult> {
  const validation = verifyEmailSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      message: "Please enter a valid 6-digit code and email.",
      fieldErrors,
    };
  }

  const { email, code } = validation.data;

  // Find user by normalized email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return {
      success: false,
      message: "Unable to verify email. Please check your details or sign up again.",
    };
  }

  if (user.isEmailVerified) {
    // If already verified, establish session
    await createSession(user.id);
    return {
      success: true,
      message: "Email is already verified. Redirecting to dashboard...",
    };
  }

  const now = new Date();

  // Query database checking expiresAt column directly in the DB query
  const codeRecord = await prisma.emailVerificationCode.findFirst({
    where: {
      userId: user.id,
      expiresAt: { gt: now }, // Enforced in DB query itself
    },
    orderBy: { createdAt: "desc" },
  });

  if (!codeRecord) {
    return {
      success: false,
      message: "The verification code has expired or is invalid. Please request a new code.",
    };
  }

  // Check maximum failed attempts
  if (codeRecord.attempts >= MAX_VERIFICATION_ATTEMPTS) {
    // Invalidate code upon hitting maximum attempts
    await prisma.emailVerificationCode.delete({
      where: { id: codeRecord.id },
    }).catch(() => {});

    return {
      success: false,
      message: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  // Verify code hash
  const submittedCodeHash = hashToken(code);
  if (submittedCodeHash !== codeRecord.codeHash) {
    // Increment attempts counter in database
    await prisma.emailVerificationCode.update({
      where: { id: codeRecord.id },
      data: { attempts: { increment: 1 } },
    });

    const remainingAttempts = MAX_VERIFICATION_ATTEMPTS - (codeRecord.attempts + 1);
    return {
      success: false,
      message: `Invalid code. ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`,
      fieldErrors: { code: "Invalid verification code." },
    };
  }

  // Code is valid! Mark email as verified and delete code
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true },
    }),
    prisma.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  // Create authenticated session and set cookie
  await createSession(user.id);

  return {
    success: true,
    message: "Email successfully verified! Redirecting to dashboard...",
  };
}

/**
 * Resends the 6-digit verification code for a user.
 */
export async function resendVerificationCode(rawData: unknown): Promise<AuthActionResult> {
  const validation = resendCodeSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please provide a valid email address.",
    };
  }

  const { email } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    // Return generic message to avoid email enumeration
    return {
      success: true,
      message: "If an account exists, a new verification code has been sent.",
    };
  }

  if (user.isEmailVerified) {
    return {
      success: false,
      message: "This email is already verified. Please sign in.",
    };
  }

  const issueResult = await issueVerificationCode(user.id, user.email);
  if (!issueResult.success) {
    return {
      success: false,
      message: issueResult.error,
      retryAfterSeconds: issueResult.retryAfterSeconds,
    };
  }

  return {
    success: true,
    message: "A new 6-digit verification code has been sent to your email.",
  };
}

/**
 * Signs in a user.
 * Never reveals whether email exists (uses generic message).
 * Verifies bcrypt password and issues session.
 */
export async function signInUser(rawData: unknown): Promise<AuthActionResult<{ requiresVerification?: boolean; email?: string }>> {
  const validation = signInSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      message: "Please enter your email and password.",
      fieldErrors,
    };
  }

  const { email, password } = validation.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Generic invalid message to avoid email enumeration
  const GENERIC_ERROR = "Invalid email or password.";

  if (!user) {
    // Perform dummy bcrypt check to mitigate timing attacks
    await verifyPassword(password, "$2a$12$e8uqN/xJj9f60uVlZqGgOuY7lXm11w8cM91f.5Q9ZfG9Oa1eQ9ZfG").catch(() => {});
    return {
      success: false,
      message: GENERIC_ERROR,
    };
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return {
      success: false,
      message: GENERIC_ERROR,
    };
  }

  // Check if email has been verified
  if (!user.isEmailVerified) {
    // Send a fresh verification code
    await issueVerificationCode(user.id, user.email).catch(() => {});
    return {
      success: false,
      message: "Please verify your email address to continue. We have sent a verification code to your inbox.",
      data: { requiresVerification: true, email: user.email },
    };
  }

  // Create session
  await createSession(user.id);

  return {
    success: true,
    message: "Signed in successfully! Redirecting to dashboard...",
  };
}

/**
 * Requests a password reset.
 * Does not reveal whether the email exists in the database.
 * Issues a 6-digit reset code and invalidates all older reset tokens when a new one is issued.
 */
export async function requestPasswordReset(rawData: unknown): Promise<AuthActionResult<{ email?: string }>> {
  const validation = forgotPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Please enter a valid email address.",
      fieldErrors: { email: "Please enter a valid email address." },
    };
  }

  const { email } = validation.data;

  // Always display generic response to prevent email enumeration
  const GENERIC_RESPONSE = {
    success: true,
    message: "If an account exists with that email, we have sent a 6-digit password reset code.",
    data: { email },
  };

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return GENERIC_RESPONSE;
  }

  const now = new Date();

  // Invalidate all older reset tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  // Generate secure 6-digit password reset code
  const rawCode = generateVerificationCode();
  const codeHash = hashToken(rawCode);
  const expiresAt = new Date(now.getTime() + RESET_TOKEN_EXPIRY_MS);

  // Store hashed reset code with 30-minute expiry
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: codeHash,
      expiresAt,
      usedAt: null,
    },
  });

  // Dispatch password reset email
  await sendEmail({
    to: user.email,
    subject: "Your GymLog Password Reset Code",
    text: `Your GymLog password reset code is: ${rawCode}\n\nThis 6-digit code is valid for 30 minutes and can only be used once.\nIf you did not request this reset, you can safely ignore this email.`,
  });

  return GENERIC_RESPONSE;
}

/**
 * Resets the user's password using the 6-digit code sent to their email.
 * Enforces single-use (usedAt), time limit (30 minutes), and revokes existing sessions.
 */
export async function resetPasswordWithToken(rawData: unknown): Promise<AuthActionResult> {
  const validation = resetPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of validation.error.issues) {
      const field = issue.path[0] as string;
      fieldErrors[field] = issue.message;
    }
    return {
      success: false,
      message: "Please correct the errors below.",
      fieldErrors,
    };
  }

  const { email, code, password } = validation.data;
  const codeHash = hashToken(code);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return {
      success: false,
      message: "This password reset code is invalid or has expired. Please request a new one.",
    };
  }

  // Find token by user and code hash, ensuring it is not expired and has not been used
  const resetTokenRecord = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      tokenHash: codeHash,
      expiresAt: { gt: now },
      usedAt: null,
    },
  });

  if (!resetTokenRecord) {
    return {
      success: false,
      message: "This password reset code is invalid or has expired. Please request a new one.",
      fieldErrors: { code: "Invalid or expired reset code." },
    };
  }

  // Hash new password with bcrypt cost factor 12
  const newPasswordHash = await hashPassword(password);

  // In a transaction:
  // 1. Update user password
  // 2. Mark reset token as used (single use)
  // 3. Invalidate all active sessions for this user so old sessions cannot be hijacked
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetTokenRecord.id },
      data: { usedAt: now },
    }),
    prisma.session.deleteMany({
      where: { userId: user.id },
    }),
  ]);

  return {
    success: true,
    message: "Your password has been successfully reset! You can now sign in with your new password.",
  };
}

/**
 * Signs out the currently authenticated user.
 * Deletes session in database and clears cookie.
 */
export async function signOutUser(): Promise<void> {
  await destroySession();
}
