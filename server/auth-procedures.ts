/**
 * auth-procedures.ts
 * Real 2FA, forgot password, and reset password procedures.
 * These replace/augment the auth router in routers.ts.
 */
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as bcrypt from "bcrypt";
import { getDb, getUserByEmail, getUserById } from "./db";
import { users, otpCodes, passwordResetTokens } from "../drizzle/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { sendEmail, otpEmailHtml, passwordResetEmailHtml } from "./email";
import crypto from "crypto";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

function generateOtp(): string {
  return String(Math.floor(100000 + (crypto.randomInt(900000)))).padStart(6, "0");
}

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

export const authExtRouter = router({
  /** Step 1 of 2FA login — verify password, send OTP if 2FA enabled */
  loginStep1: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
      if (!user.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "Account inactive" });

      if (!user.twoFactorEnabled) {
        // No 2FA — signal caller to proceed with full login
        return { requires2fa: false, userId: user.id };
      }

      // 2FA enabled: generate OTP and email it
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const code = generateOtp();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await db.insert(otpCodes).values({
        userId: user.id,
        code,
        purpose: "2fa_login",
        expiresAt,
      });

      await sendEmail({
        to: user.email,
        subject: "MediSupply Rwanda — Login Verification Code",
        html: otpEmailHtml(code, "2fa_login"),
      });

      return { requires2fa: true, userId: user.id };
    }),

  /** Step 2 of 2FA — verify OTP code, then set session cookie */
  verifyOtp: publicProcedure
    .input(z.object({ userId: z.number(), code: z.string().length(6) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [otp] = await db.select().from(otpCodes).where(
        and(
          eq(otpCodes.userId, input.userId),
          eq(otpCodes.code, input.code),
          eq(otpCodes.purpose, "2fa_login"),
          gt(otpCodes.expiresAt, new Date()),
          isNull(otpCodes.usedAt),
        )
      ).limit(1);

      if (!otp) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired code" });
      }

      // Mark OTP used
      await db.update(otpCodes).set({ usedAt: new Date() }).where(eq(otpCodes.id, otp.id));

      // Load user and set session cookie — completing the login
      const user = await getUserById(input.userId);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

      const sessionToken = await sdk.signSession(
        { openId: user.openId, appId: user.openId, name: user.name || user.email },
        { expiresInMs: ONE_YEAR_MS }
      );
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      return { verified: true, userId: input.userId };
    }),

  /** Toggle 2FA for the current user */
  toggle2fa: protectedProcedure
    .input(z.object({ enable: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(users).set({ twoFactorEnabled: input.enable }).where(eq(users.id, ctx.user.id));
      return { success: true, twoFactorEnabled: input.enable };
    }),

  /** Request password reset — sends email with token link */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const user = await getUserByEmail(input.email);
      // Always return success to prevent email enumeration
      if (!user) return { success: true };

      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.insert(passwordResetTokens).values({ userId: user.id, token, expiresAt });

      const baseUrl = process.env.APP_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;

      await sendEmail({
        to: user.email,
        subject: "MediSupply Rwanda — Password Reset",
        html: passwordResetEmailHtml(resetUrl),
      });

      return { success: true };
    }),

  /** Validate a reset token (for the reset-password page to check before showing form) */
  validateResetToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db.select().from(passwordResetTokens).where(
        and(
          eq(passwordResetTokens.token, input.token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        )
      ).limit(1);

      return { valid: Boolean(row) };
    }),

  /** Consume reset token and set new password */
  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [row] = await db.select().from(passwordResetTokens).where(
        and(
          eq(passwordResetTokens.token, input.token),
          gt(passwordResetTokens.expiresAt, new Date()),
          isNull(passwordResetTokens.usedAt),
        )
      ).limit(1);

      if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset link" });

      const hash = await bcrypt.hash(input.newPassword, 10);
      await db.update(users).set({ passwordHash: hash }).where(eq(users.id, row.userId));
      await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));

      return { success: true };
    }),
});
