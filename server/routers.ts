/**
 * MediSupply Rwanda — Production API Router
 *
 * Architecture: tRPC v11 + Drizzle ORM + MySQL
 * Five actors: Admin · Pharmacist · Procurement Officer · Supplier · Accountant
 *
 * Workflow states:
 *   Requisition: draft → submitted → approved | rejected → converted_to_po
 *   Purchase Order: draft → sent → acknowledged → partial_delivery → delivered | cancelled
 *   Invoice: pending → partial → paid | overdue | cancelled
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import { eq, and, gte, lte, like, sql, desc, inArray, ne, lt, asc } from "drizzle-orm";

import { router, protectedProcedure, publicProcedure, adminProcedure } from "./_core/trpc";
import { getDb } from "./db";
import {
  users, medicalSupplies, suppliers, purchaseRequisitions, purchaseOrders,
  invoices, notifications, auditLogs, forecasts, inventoryTransactions,
  requisitionItems, poItems, quotations, payments, budgets,
  notificationPreferences, otpCodes, passwordResetTokens,
  chatMessages, deliveryReceipts, receiptItems
} from "../drizzle/schema";
import { getInsertId } from "./db";
import { createRoleNotifications, checkAndNotifyInventory } from "./notification-service";
import { authExtRouter } from "./auth-procedures";
import { exportRouter } from "./export-procedures";
import { forecastRouter } from "./forecast-procedures";
import { computeForecast } from "./forecast-procedures";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";

// ─── Role guards ───────────────────────────────────────────────────────────────

const pharmacistProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "pharmacist")
    throw new TRPCError({ code: "FORBIDDEN", message: "Pharmacist access required" });
  return next({ ctx });
});

const procurementProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "procurement_officer")
    throw new TRPCError({ code: "FORBIDDEN", message: "Procurement access required" });
  return next({ ctx });
});

const accountantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "accountant")
    throw new TRPCError({ code: "FORBIDDEN", message: "Accountant access required" });
  return next({ ctx });
});

const supplierProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "supplier")
    throw new TRPCError({ code: "FORBIDDEN", message: "Supplier access required" });
  return next({ ctx });
});

const CHAT_EDIT_WINDOW_MS = 15 * 60 * 1000;

const REPORT_EXPORT_PERMISSIONS = {
  admin: ["inventory", "suppliers", "orders", "financial", "budgets", "users", "logs"],
  pharmacist: ["inventory"],
  procurement_officer: ["orders", "suppliers"],
  supplier: ["orders"],
  accountant: ["financial", "orders", "budgets"],
} as const satisfies Record<string, readonly string[]>;

type ExportReportType = (typeof REPORT_EXPORT_PERMISSIONS.admin)[number];

function getAllowedReportTypesForRole(role: string): ExportReportType[] {
  return [...(REPORT_EXPORT_PERMISSIONS[role as keyof typeof REPORT_EXPORT_PERMISSIONS] ?? [])] as ExportReportType[];
}

function assertCanExportReport(role: string, reportType: ExportReportType) {
  if (!getAllowedReportTypesForRole(role).includes(reportType)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to export this report." });
  }
}

async function logReportExport(db: any, userId: number, reportType: ExportReportType) {
  await db.insert(auditLogs).values({
    userId,
    action: "EXPORT_REPORT",
    entityType: "report",
    changes: JSON.stringify({ reportType }),
  });
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function generateOTP(db: any, userId: number): Promise<string> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(otpCodes).values({ userId, code, purpose: "2fa_login", expiresAt });
  return code;
}

// ─── Root router ───────────────────────────────────────────────────────────────

export const appRouter = router({

  // ══════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════
  auth: router({
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await db.select().from(users)
          .where(and(eq(users.email, input.email.toLowerCase()), eq(users.isActive, true))).limit(1);
        if (!user?.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });
        await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));
        if (user.twoFactorEnabled) {
          const code = await generateOTP(db, user.id);
          const { sendEmail, otpEmailHtml } = await import("./email");
          await sendEmail({ to: user.email, subject: "MediSupply Rwanda — Login Code", html: otpEmailHtml(code, "2fa_login") });
          return { requires2fa: true, userId: user.id };
        }
        const { sdk } = await import("./_core/sdk");
        const token = await sdk.signSession({ openId: user.openId, appId: "medisupply-local", name: user.name || user.email });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { requires2fa: false, user: { id: user.id, role: user.role, name: user.name, email: user.email } };
      }),

    me: protectedProcedure.query(({ ctx }) => ctx.user),

    register: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(2) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        const hash = await bcrypt.hash(input.password, 12);
        const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await db.insert(users).values({ openId, email: input.email.toLowerCase(), name: input.name, passwordHash: hash, role: "pharmacist" });
        return { success: true };
      }),

    logout: protectedProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, cookieOptions);
      return { success: true };
    }),

    updateProfile: protectedProcedure
      .input(z.object({ name: z.string().min(1).optional(), email: z.string().email().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const update: any = {};
        if (input.name) update.name = input.name.trim();
        if (input.email) {
          const [ex] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, input.email), ne(users.id, ctx.user.id))).limit(1);
          if (ex) throw new TRPCError({ code: "CONFLICT", message: "Email already in use" });
          update.email = input.email;
        }
        await db.update(users).set(update).where(eq(users.id, ctx.user.id));
        return { success: true };
      }),

    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (!user?.passwordHash) throw new TRPCError({ code: "BAD_REQUEST" });
        const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        const hash = await bcrypt.hash(input.newPassword, 12);
        await db.update(users).set({ passwordHash: hash }).where(eq(users.id, ctx.user.id));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CHANGE_PASSWORD", entityType: "user", entityId: ctx.user.id });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // USERS (admin)
  // ══════════════════════════════════════════════════════════
  users: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(users);
    }),
    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin","pharmacist","procurement_officer","supplier","accountant"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(users).set({ role: input.role as any }).where(eq(users.id, input.userId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_USER_ROLE", entityType: "user", entityId: input.userId, changes: JSON.stringify({ role: input.role }) });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // INVENTORY
  // ══════════════════════════════════════════════════════════
  inventory: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(medicalSupplies).where(eq(medicalSupplies.isActive, true)).orderBy(asc(medicalSupplies.name));
    }),

    get: protectedProcedure.input(z.number()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [r] = await db.select().from(medicalSupplies).where(eq(medicalSupplies.id, input)).limit(1);
      return r ?? null;
    }),

    getLowStock: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(medicalSupplies)
        .where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.currentStock, medicalSupplies.reorderPoint)))
        .orderBy(asc(medicalSupplies.currentStock));
    }),

    getExpiring: protectedProcedure
      .input(z.object({ daysThreshold: z.number().default(30) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const threshold = new Date(Date.now() + input.daysThreshold * 86400000);
        return db.select().from(medicalSupplies)
          .where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.expiryDate, threshold)));
      }),

    create: pharmacistProcedure
      .input(z.object({
        code: z.string(), name: z.string(), category: z.string(), unit: z.string(),
        currentStock: z.number().default(0), reorderPoint: z.number(), reorderQuantity: z.number(),
        unitCost: z.string(), supplierId: z.number().optional(), expiryDate: z.date().optional(),
        batchNumber: z.string().optional(), storageLocation: z.string().optional(), description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await db.insert(medicalSupplies).values({ ...input, currentStock: input.currentStock ?? 0 });
        const id = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_SUPPLY", entityType: "medical_supply", entityId: id });
        // Seed opening stock transaction if provided
        if ((input.currentStock ?? 0) > 0) {
          await db.insert(inventoryTransactions).values({ supplyId: id, transactionType: "purchase", quantity: input.currentStock!, userId: ctx.user.id, notes: "Opening stock" });
        }
        return { success: true, id };
      }),

    update: pharmacistProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(), category: z.string().optional(), unit: z.string().optional(),
          currentStock: z.number().optional(), reorderPoint: z.number().optional(), reorderQuantity: z.number().optional(),
          unitCost: z.string().optional(), supplierId: z.number().nullable().optional(),
          expiryDate: z.date().nullable().optional(), batchNumber: z.string().optional(),
          storageLocation: z.string().optional(), description: z.string().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(medicalSupplies).set(input.data as any).where(eq(medicalSupplies.id, input.id));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_SUPPLY", entityType: "medical_supply", entityId: input.id, changes: JSON.stringify(input.data) });
        return { success: true };
      }),

    deactivate: adminProcedure
      .input(z.number())
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(medicalSupplies).set({ isActive: false }).where(eq(medicalSupplies.id, input));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "DEACTIVATE_SUPPLY", entityType: "medical_supply", entityId: input });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // INVENTORY TRANSACTIONS
  // ══════════════════════════════════════════════════════════
  inventoryTransactions: router({
    list: pharmacistProcedure
      .input(z.object({ supplyId: z.number().optional(), limit: z.number().default(100) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds = input.supplyId ? [eq(inventoryTransactions.supplyId, input.supplyId)] : [];
        return db.select().from(inventoryTransactions)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(inventoryTransactions.createdAt)).limit(input.limit);
      }),

    logUsage: pharmacistProcedure
      .input(z.object({ supplyId: z.number(), quantity: z.number().positive(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [supply] = await db.select().from(medicalSupplies).where(eq(medicalSupplies.id, input.supplyId)).limit(1);
        if (!supply) throw new TRPCError({ code: "NOT_FOUND" });
        if (supply.currentStock < input.quantity)
          throw new TRPCError({ code: "BAD_REQUEST", message: `Insufficient stock. Available: ${supply.currentStock} ${supply.unit}` });
        const newStock = supply.currentStock - input.quantity;
        await db.update(medicalSupplies).set({ currentStock: newStock }).where(eq(medicalSupplies.id, input.supplyId));
        await db.insert(inventoryTransactions).values({ supplyId: input.supplyId, transactionType: "usage", quantity: input.quantity, userId: ctx.user.id, notes: input.notes || "Dispensed" });
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "LOG_USAGE", entityType: "medical_supply", entityId: input.supplyId, changes: JSON.stringify({ quantity: input.quantity, newStock }) });
        // Auto low-stock check after usage
        if (newStock <= supply.reorderPoint) {
          checkAndNotifyInventory().catch(() => {});
        }
        return { success: true, newStock };
      }),

    receiveStock: pharmacistProcedure
      .input(z.object({ supplyId: z.number(), quantity: z.number().positive(), notes: z.string().optional(), referenceId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [supply] = await db.select().from(medicalSupplies).where(eq(medicalSupplies.id, input.supplyId)).limit(1);
        if (!supply) throw new TRPCError({ code: "NOT_FOUND" });
        const newStock = supply.currentStock + input.quantity;
        await db.update(medicalSupplies).set({ currentStock: newStock }).where(eq(medicalSupplies.id, input.supplyId));
        await db.insert(inventoryTransactions).values({ supplyId: input.supplyId, transactionType: "purchase", quantity: input.quantity, userId: ctx.user.id, notes: input.notes || "Stock received", referenceId: input.referenceId });
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "RECEIVE_STOCK", entityType: "medical_supply", entityId: input.supplyId, changes: JSON.stringify({ quantity: input.quantity, newStock }) });
        return { success: true, newStock };
      }),

    adjust: pharmacistProcedure
      .input(z.object({ supplyId: z.number(), newStock: z.number().min(0), reason: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [supply] = await db.select().from(medicalSupplies).where(eq(medicalSupplies.id, input.supplyId)).limit(1);
        if (!supply) throw new TRPCError({ code: "NOT_FOUND" });
        const diff = input.newStock - supply.currentStock;
        await db.update(medicalSupplies).set({ currentStock: input.newStock }).where(eq(medicalSupplies.id, input.supplyId));
        await db.insert(inventoryTransactions).values({ supplyId: input.supplyId, transactionType: "adjustment", quantity: Math.abs(diff), userId: ctx.user.id, notes: `Adjustment: ${input.reason} (${diff >= 0 ? "+" : ""}${diff})` });
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "ADJUST_STOCK", entityType: "medical_supply", entityId: input.supplyId, changes: JSON.stringify({ from: supply.currentStock, to: input.newStock, reason: input.reason }) });
        return { success: true, newStock: input.newStock };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // SUPPLIERS
  // ══════════════════════════════════════════════════════════
  suppliers: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name));
    }),

    get: protectedProcedure.input(z.number()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [s] = await db.select().from(suppliers).where(eq(suppliers.id, input)).limit(1);
      return s ?? null;
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string(), email: z.string().email(), contactPerson: z.string().optional(),
        phone: z.string().optional(), address: z.string().optional(), city: z.string().optional(),
        country: z.string().optional(), paymentTerms: z.string().optional(),
        averageDeliveryDays: z.number().optional(), userId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { userId, ...supplierData } = input;
        if (userId) {
          const [linkedUser] = await db.select({
            id: users.id,
            role: users.role,
            supplierId: users.supplierId,
          }).from(users).where(eq(users.id, userId)).limit(1);
          if (!linkedUser) throw new TRPCError({ code: "NOT_FOUND", message: "Selected user was not found." });
          if (linkedUser.role !== "supplier") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Only supplier-role users can be linked to a supplier company." });
          }
          if (linkedUser.supplierId) {
            throw new TRPCError({ code: "CONFLICT", message: "This user is already linked to another supplier company." });
          }
        }
        const result = await db.insert(suppliers).values({ ...supplierData, userId: userId ?? null });
        const supplierId = getInsertId(result);
        if (userId) await db.update(users).set({ supplierId }).where(eq(users.id, userId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_SUPPLIER", entityType: "supplier", entityId: supplierId });
        return { success: true, id: supplierId };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        data: z.object({
          name: z.string().optional(), email: z.string().email().optional(), contactPerson: z.string().optional(),
          phone: z.string().optional(), city: z.string().optional(), country: z.string().optional(),
          paymentTerms: z.string().optional(), averageDeliveryDays: z.number().optional(), rating: z.string().optional(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(suppliers).set(input.data as any).where(eq(suppliers.id, input.id));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_SUPPLIER", entityType: "supplier", entityId: input.id, changes: JSON.stringify(input.data) });
        return { success: true };
      }),

    linkUser: adminProcedure
      .input(z.object({ supplierId: z.number(), userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [supplier] = await db.select({ id: suppliers.id, userId: suppliers.userId }).from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Supplier not found." });
        const [user] = await db.select({ id: users.id, role: users.role, supplierId: users.supplierId }).from(users).where(eq(users.id, input.userId)).limit(1);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
        if (user.role !== "supplier") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Only supplier-role users can be assigned to supplier companies." });
        }
        if (user.supplierId && user.supplierId !== input.supplierId) {
          throw new TRPCError({ code: "CONFLICT", message: "This user is already linked to another supplier company." });
        }
        if (supplier.userId && supplier.userId !== input.userId) {
          await db.update(users).set({ supplierId: null }).where(eq(users.id, supplier.userId));
        }
        try { await db.update(suppliers).set({ userId: input.userId }).where(eq(suppliers.id, input.supplierId)); } catch {}
        await db.update(users).set({ supplierId: input.supplierId }).where(eq(users.id, input.userId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "LINK_SUPPLIER_USER", entityType: "supplier", entityId: input.supplierId });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // PURCHASE REQUISITIONS
  // ══════════════════════════════════════════════════════════
  requisitions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      // Pharmacist sees only their own; admin/procurement see all
      if (ctx.user.role === "pharmacist") {
        return db.select().from(purchaseRequisitions)
          .where(eq(purchaseRequisitions.createdBy, ctx.user.id))
          .orderBy(desc(purchaseRequisitions.createdAt));
      }
      return db.select().from(purchaseRequisitions).orderBy(desc(purchaseRequisitions.createdAt));
    }),

    getItems: protectedProcedure
      .input(z.object({ requisitionId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const items = await db.select().from(requisitionItems)
          .where(eq(requisitionItems.requisitionId, input.requisitionId));
        const supplyIds = [...new Set(items.map(i => i.supplyId))];
        if (supplyIds.length === 0) return [];
        const supplyList = await db.select({ id: medicalSupplies.id, name: medicalSupplies.name, unit: medicalSupplies.unit, unitCost: medicalSupplies.unitCost })
          .from(medicalSupplies).where(inArray(medicalSupplies.id, supplyIds));
        const supplyMap = new Map(supplyList.map(s => [s.id, s]));
        return items.map(i => ({
          ...i,
          supplyName: supplyMap.get(i.supplyId)?.name ?? `Supply #${i.supplyId}`,
          supplyUnit: supplyMap.get(i.supplyId)?.unit ?? "",
          currentUnitCost: supplyMap.get(i.supplyId)?.unitCost ?? "0",
        }));
      }),

    create: pharmacistProcedure
      .input(z.object({
        items: z.array(z.object({ supplyId: z.number(), quantity: z.number().positive(), estimatedUnitCost: z.string().optional() })),
        notes: z.string().optional(),
        urgency: z.enum(["routine", "urgent", "emergency"]).default("routine"),
        department: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const seq = await db.select({ id: purchaseRequisitions.id }).from(purchaseRequisitions).orderBy(desc(purchaseRequisitions.id)).limit(1);
        const nextNum = (seq[0]?.id ?? 0) + 1;
        const requisitionNumber = `REQ-${String(nextNum).padStart(4, "0")}`;
        const totalAmount = input.items.reduce((s, it) => s + (Number(it.estimatedUnitCost || 0) * it.quantity), 0);
        const result = await db.insert(purchaseRequisitions).values({
          requisitionNumber, createdBy: ctx.user.id, status: "draft",
          totalAmount: totalAmount.toString(), notes: input.notes,
        });
        const requisitionId = getInsertId(result);
        await db.insert(requisitionItems).values(
          input.items.map(it => ({ requisitionId, supplyId: it.supplyId, quantity: it.quantity, estimatedUnitCost: it.estimatedUnitCost || null }))
        );
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_REQUISITION", entityType: "purchase_requisition", entityId: requisitionId });
        return { success: true, id: requisitionId, requisitionNumber };
      }),

    submit: pharmacistProcedure
      .input(z.object({ requisitionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [req] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, input.requisitionId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (req.createdBy !== ctx.user.id && ctx.user.role !== "admin")
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only submit your own requisitions" });
        if (req.status !== "draft")
          throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot submit a requisition with status: ${req.status}` });
        await db.update(purchaseRequisitions).set({ status: "submitted" }).where(eq(purchaseRequisitions.id, input.requisitionId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "SUBMIT_REQUISITION", entityType: "purchase_requisition", entityId: input.requisitionId });
        createRoleNotifications({
          type: "approval_pending",
          title: `Requisition ${req.requisitionNumber} Awaiting Approval`,
          message: `${ctx.user.name || ctx.user.email} submitted ${req.requisitionNumber}${req.totalAmount ? ` (Est. RWF ${Number(req.totalAmount).toLocaleString()})` : ""}. Please review and approve or reject.`,
          referenceId: input.requisitionId,
        }).catch(() => {});
        return { success: true };
      }),

    approve: protectedProcedure
      .input(z.object({ requisitionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "procurement_officer")
          throw new TRPCError({ code: "FORBIDDEN", message: "Only procurement officers can approve requisitions" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [req] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, input.requisitionId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (req.status !== "submitted") throw new TRPCError({ code: "BAD_REQUEST", message: "Only submitted requisitions can be approved" });
        await db.update(purchaseRequisitions).set({ status: "approved", approvedBy: ctx.user.id, approvalDate: new Date() }).where(eq(purchaseRequisitions.id, input.requisitionId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "APPROVE_REQUISITION", entityType: "purchase_requisition", entityId: input.requisitionId });
        // Notify the requester
        createRoleNotifications({
          type: "approval_pending",
          title: `${req.requisitionNumber} Approved`,
          message: `Your requisition ${req.requisitionNumber} has been approved and is ready to be converted to a Purchase Order.`,
          referenceId: input.requisitionId,
          specificUserId: req.createdBy,
        }).catch(() => {});
        return { success: true };
      }),

    reject: protectedProcedure
      .input(z.object({ requisitionId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.role !== "procurement_officer")
          throw new TRPCError({ code: "FORBIDDEN", message: "Only procurement officers can reject requisitions" });
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [req] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, input.requisitionId)).limit(1);
        if (!req) throw new TRPCError({ code: "NOT_FOUND" });
        if (req.status !== "submitted") throw new TRPCError({ code: "BAD_REQUEST", message: "Only submitted requisitions can be rejected" });
        await db.update(purchaseRequisitions).set({ status: "rejected", rejectionReason: input.reason || "" }).where(eq(purchaseRequisitions.id, input.requisitionId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "REJECT_REQUISITION", entityType: "purchase_requisition", entityId: input.requisitionId, changes: JSON.stringify({ reason: input.reason }) });
        // Notify the requester
        createRoleNotifications({
          type: "approval_pending",
          title: `${req.requisitionNumber} Rejected`,
          message: `Your requisition ${req.requisitionNumber} was rejected${input.reason ? `: ${input.reason}` : ""}. Please revise and resubmit.`,
          referenceId: input.requisitionId,
          specificUserId: req.createdBy,
        }).catch(() => {});
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ══════════════════════════════════════════════════════════
  purchaseOrders: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      // Suppliers see all non-draft POs so they can act
      if (ctx.user.role === "supplier") {
        return db.select().from(purchaseOrders)
          .where(ne(purchaseOrders.status, "draft"))
          .orderBy(desc(purchaseOrders.createdAt));
      }
      return db.select().from(purchaseOrders).orderBy(desc(purchaseOrders.createdAt));
    }),

    getItems: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const items = await db.select().from(poItems).where(eq(poItems.poId, input));
        const supplyIds = [...new Set(items.map(i => i.supplyId))];
        if (!supplyIds.length) return [];
        const supplyList = await db.select({ id: medicalSupplies.id, name: medicalSupplies.name, unit: medicalSupplies.unit })
          .from(medicalSupplies).where(inArray(medicalSupplies.id, supplyIds));
        const sm = new Map(supplyList.map(s => [s.id, s]));
        return items.map(i => ({ ...i, supplyName: sm.get(i.supplyId)?.name ?? `Supply #${i.supplyId}`, supplyUnit: sm.get(i.supplyId)?.unit ?? "" }));
      }),

    create: procurementProcedure
      .input(z.object({
        supplierId: z.number(),
        requisitionId: z.number().optional(),
        items: z.array(z.object({ supplyId: z.number(), quantity: z.number().positive(), unitCost: z.string() })),
        expectedDeliveryDate: z.date().optional(),
        notes: z.string().optional(),
        sendImmediately: z.boolean().default(false),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const poNumber = `PO-${Date.now()}`;
        const totalAmount = input.items.reduce((s, i) => s + Number(i.unitCost) * i.quantity, 0);
        const status = input.sendImmediately ? "sent" : "draft";
        const result = await db.insert(purchaseOrders).values({
          poNumber, supplierId: input.supplierId, createdBy: ctx.user.id,
          totalAmount: totalAmount.toString(), expectedDeliveryDate: input.expectedDeliveryDate,
          notes: input.notes, status: status as any,
        });
        const poId = getInsertId(result);
        if (input.items.length > 0) {
          await db.insert(poItems).values(input.items.map(i => ({ poId, supplyId: i.supplyId, quantity: i.quantity, unitCost: i.unitCost, deliveredQuantity: 0 })));
        }
        if (input.requisitionId) {
          await db.update(purchaseRequisitions).set({ status: "converted_to_po" }).where(eq(purchaseRequisitions.id, input.requisitionId));
        }
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_PO", entityType: "purchase_order", entityId: poId, changes: JSON.stringify({ supplierId: input.supplierId, totalAmount, status }) });
        // Notify supplier if sent immediately
        if (status === "sent") {
          await _notifySupplierNewPO(db, poId, input.supplierId, totalAmount);
        }
        return { success: true, id: poId, poNumber };
      }),

    updateStatus: procurementProcedure
      .input(z.object({ poId: z.number(), status: z.enum(["draft","sent","acknowledged","partial_delivery","delivered","cancelled"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND" });
        await db.update(purchaseOrders).set({ status: input.status as any }).where(eq(purchaseOrders.id, input.poId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_PO_STATUS", entityType: "purchase_order", entityId: input.poId, changes: JSON.stringify({ from: po.status, to: input.status }) });
        // Notify supplier when sent
        if (input.status === "sent") {
          await _notifySupplierNewPO(db, input.poId, po.supplierId, Number(po.totalAmount));
        }
        // Notify procurement when delivered
        if (input.status === "delivered") {
          createRoleNotifications({ type: "order_update", title: `PO ${po.poNumber} Delivered`, message: `Purchase Order ${po.poNumber} has been fully delivered. Please verify goods receipt and process the invoice.`, referenceId: input.poId }).catch(() => {});
        }
        return { success: true };
      }),

    cancel: procurementProcedure
      .input(z.object({ poId: z.number(), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND" });
        if (["delivered", "cancelled"].includes(po.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot cancel a delivered or already-cancelled order" });
        await db.update(purchaseOrders).set({ status: "cancelled" as any }).where(eq(purchaseOrders.id, input.poId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CANCEL_PO", entityType: "purchase_order", entityId: input.poId, changes: JSON.stringify({ reason: input.reason }) });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // SUPPLIER PORTAL — actions suppliers take on POs
  // ══════════════════════════════════════════════════════════
  supplierPortal: router({
    getMyOrders: supplierProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(purchaseOrders)
        .where(ne(purchaseOrders.status, "draft"))
        .orderBy(desc(purchaseOrders.createdAt));
    }),

    confirmOrder: supplierProcedure
      .input(z.object({ poId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND" });
        if (po.status !== "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent orders can be confirmed" });
        await db.update(purchaseOrders).set({ status: "acknowledged" as any }).where(eq(purchaseOrders.id, input.poId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "SUPPLIER_CONFIRM_ORDER", entityType: "purchase_order", entityId: input.poId });
        createRoleNotifications({ type: "order_update", title: `${po.poNumber} Confirmed by Supplier`, message: `The supplier has confirmed ${po.poNumber}. Expected delivery: ${po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : "TBD"}.`, referenceId: input.poId }).catch(() => {});
        return { success: true };
      }),

    updateDeliveryStatus: supplierProcedure
      .input(z.object({
        poId: z.number(),
        status: z.enum(["partial_delivery", "delivered", "cancelled"]),
        notes: z.string().optional(),
        deliveredItems: z.array(z.object({ poItemId: z.number(), deliveredQuantity: z.number() })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND" });
        const updateData: any = { status: input.status };
        if (input.status === "delivered") updateData.deliveryDate = new Date();
        await db.update(purchaseOrders).set(updateData).where(eq(purchaseOrders.id, input.poId));
        // Update delivered quantities per item if provided
        if (input.deliveredItems?.length) {
          for (const di of input.deliveredItems) {
            await db.update(poItems).set({ deliveredQuantity: di.deliveredQuantity }).where(eq(poItems.id, di.poItemId));
          }
        } else if (input.status === "delivered") {
          await db.update(poItems).set({ deliveredQuantity: poItems.quantity }).where(eq(poItems.poId, input.poId));
        }
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_DELIVERY_STATUS", entityType: "purchase_order", entityId: input.poId, changes: JSON.stringify({ status: input.status, notes: input.notes }) });
        const label = input.status === "delivered" ? "fully delivered" : input.status === "partial_delivery" ? "partially delivered" : "cancelled";
        createRoleNotifications({ type: "order_update", title: `${po.poNumber} ${label.charAt(0).toUpperCase() + label.slice(1)}`, message: `Supplier marked ${po.poNumber} as ${label}.${input.notes ? ` Notes: ${input.notes}` : ""}${input.status === "delivered" ? " Pharmacy can now confirm receipt and update stock." : input.status === "partial_delivery" ? " Pharmacy can now confirm the quantities actually received." : ""}`, referenceId: input.poId }).catch(() => {});
        return { success: true };
      }),

    submitInvoice: supplierProcedure
      .input(z.object({ poId: z.number(), totalAmount: z.string(), dueDate: z.date().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND" });
        if (!["partial_delivery", "delivered"].includes(String(po.status))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice can only be submitted after items have been delivered to pharmacy." });
        }
        // Require pharmacist to have confirmed receipt before supplier can invoice
        const [receipt] = await db.select({ id: deliveryReceipts.id }).from(deliveryReceipts)
          .where(and(eq(deliveryReceipts.poId, input.poId), eq(deliveryReceipts.status, "confirmed"))).limit(1);
        if (!receipt) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot submit invoice yet — waiting for pharmacist to confirm receipt of the delivered items." });
        const confirmedValue = await _getConfirmedReceiptValue(db, input.poId);
        if (confirmedValue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No confirmed receipt quantities are available for invoicing yet." });
        if (Number(input.totalAmount) > confirmedValue) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invoice amount cannot exceed the confirmed received value of RWF ${confirmedValue.toLocaleString()}.` });
        }
        // Check for duplicate invoice
        const [existing] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.poId, input.poId)).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "An invoice already exists for this purchase order" });
        const invoiceNumber = `INV-${Date.now()}`;
        const result = await db.insert(invoices).values({ invoiceNumber, poId: input.poId, supplierId: po.supplierId, totalAmount: input.totalAmount, dueDate: input.dueDate, notes: input.notes });
        const invId = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "SUPPLIER_SUBMIT_INVOICE", entityType: "invoice", entityId: invId });
        createRoleNotifications({ type: "payment_due", title: `Invoice ${invoiceNumber} Received`, message: `Invoice ${invoiceNumber} submitted for ${po.poNumber} — RWF ${Number(input.totalAmount).toLocaleString()}. Due: ${input.dueDate ? new Date(input.dueDate).toLocaleDateString() : "ASAP"}.`, referenceId: invId }).catch(() => {});
        return { success: true, id: invId, invoiceNumber };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // INVOICES & PAYMENTS
  // ══════════════════════════════════════════════════════════
  invoices: router({
    list: accountantProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      // Auto-mark overdue invoices
      await db.update(invoices)
        .set({ status: "overdue" as any })
        .where(and(
          inArray(invoices.status as any, ["pending", "partial"]),
          lt(invoices.dueDate, new Date()),
        )).catch(() => {});
      return db.select().from(invoices).orderBy(desc(invoices.invoiceDate));
    }),

    listWithDetails: accountantProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const invList = await db.select({
        id: invoices.id, invoiceNumber: invoices.invoiceNumber, totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount, status: invoices.status, dueDate: invoices.dueDate,
        invoiceDate: invoices.invoiceDate, notes: invoices.notes,
        poId: invoices.poId, supplierId: invoices.supplierId,
        supplierName: suppliers.name, poNumber: purchaseOrders.poNumber,
      }).from(invoices)
        .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
        .leftJoin(purchaseOrders, eq(invoices.poId, purchaseOrders.id))
        .orderBy(desc(invoices.invoiceDate));
      return invList;
    }),

    create: accountantProcedure
      .input(z.object({ poId: z.number(), supplierId: z.number(), totalAmount: z.string(), dueDate: z.date().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
        const [receipt] = await db.select({ id: deliveryReceipts.id }).from(deliveryReceipts)
          .where(and(eq(deliveryReceipts.poId, input.poId), eq(deliveryReceipts.status, "confirmed"))).limit(1);
        if (!receipt) throw new TRPCError({ code: "BAD_REQUEST", message: "Invoice can only be created after pharmacy confirms receipt." });
        const confirmedValue = await _getConfirmedReceiptValue(db, input.poId);
        if (confirmedValue <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No confirmed quantities are available for invoicing." });
        if (Number(input.totalAmount) > confirmedValue) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Invoice amount cannot exceed the confirmed received value of RWF ${confirmedValue.toLocaleString()}.` });
        }
        const [existing] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.poId, input.poId)).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Invoice already exists for this PO" });
        const invoiceNumber = `INV-${Date.now()}`;
        const result = await db.insert(invoices).values({ invoiceNumber, ...input });
        const id = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_INVOICE", entityType: "invoice", entityId: id });
        return { success: true, id };
      }),

    recordPayment: accountantProcedure
      .input(z.object({ invoiceId: z.number(), amount: z.string(), paymentMethod: z.string(), transactionReference: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [inv] = await db.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
        if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
        const newPaid = Number(inv.paidAmount) + Number(input.amount);
        const total = Number(inv.totalAmount);
        const newStatus = newPaid >= total ? "paid" : newPaid > 0 ? "partial" : "pending";
        await db.update(invoices).set({ paidAmount: newPaid.toString(), status: newStatus as any }).where(eq(invoices.id, input.invoiceId));
        await db.insert(payments).values({ invoiceId: input.invoiceId, amount: input.amount, paymentMethod: input.paymentMethod, transactionReference: input.transactionReference, notes: input.notes });
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "RECORD_PAYMENT", entityType: "invoice", entityId: input.invoiceId, changes: JSON.stringify({ amount: input.amount, method: input.paymentMethod, newStatus }) });
        if (newStatus === "paid") {
          createRoleNotifications({ type: "payment_due", title: "Invoice Fully Paid", message: `Invoice #${inv.invoiceNumber} has been fully settled (RWF ${total.toLocaleString()}).`, referenceId: input.invoiceId }).catch(() => {});
        }
        return { success: true, newStatus, newPaidAmount: newPaid.toString() };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // BUDGETS
  // ══════════════════════════════════════════════════════════
  budgets: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(budgets).orderBy(asc(budgets.department));
    }),

    summary: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { totalAllocated: 0, totalSpent: 0, budgets: [] };
      const all = await db.select().from(budgets);
      return {
        totalAllocated: all.reduce((s, b) => s + Number(b.allocatedAmount), 0),
        totalSpent: all.reduce((s, b) => s + Number(b.spentAmount || 0), 0),
        budgets: all,
      };
    }),

    create: accountantProcedure
      .input(z.object({ department: z.string(), allocatedAmount: z.string(), fiscalYear: z.number(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const result = await db.insert(budgets).values(input);
        const id = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_BUDGET", entityType: "budget", entityId: id });
        return { success: true, id };
      }),

    update: accountantProcedure
      .input(z.object({ id: z.number(), allocatedAmount: z.string().optional(), spentAmount: z.string().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const { id, ...data } = input;
        await db.update(budgets).set(data as any).where(eq(budgets.id, id));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_BUDGET", entityType: "budget", entityId: id, changes: JSON.stringify(data) });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ══════════════════════════════════════════════════════════
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(notifications)
        .where(eq(notifications.userId, ctx.user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return 0;
      const rows = await db.select({ id: notifications.id }).from(notifications)
        .where(and(eq(notifications.userId, ctx.user.id), eq(notifications.isRead, false)));
      return rows.length;
    }),

    markAsRead: protectedProcedure.input(z.number()).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, input), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, ctx.user.id));
      return { success: true };
    }),

    delete: protectedProcedure.input(z.number()).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(notifications).where(and(eq(notifications.id, input), eq(notifications.userId, ctx.user.id)));
      return { success: true };
    }),

    deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(notifications).where(eq(notifications.userId, ctx.user.id));
      return { success: true };
    }),
  }),

  notificationPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { lowStockAlerts: true, expiryWarnings: true, approvalAlerts: true, orderUpdates: true, budgetAlerts: true, emailNotifications: true };
      const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, ctx.user.id)).limit(1);
      return pref ?? { lowStockAlerts: true, expiryWarnings: true, approvalAlerts: true, orderUpdates: true, budgetAlerts: true, emailNotifications: true };
    }),
    update: protectedProcedure
      .input(z.object({ lowStockAlerts: z.boolean().optional(), expiryWarnings: z.boolean().optional(), approvalAlerts: z.boolean().optional(), orderUpdates: z.boolean().optional(), budgetAlerts: z.boolean().optional(), emailNotifications: z.boolean().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.insert(notificationPreferences).values({ userId: ctx.user.id, ...input } as any).onDuplicateKeyUpdate({ set: input });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ══════════════════════════════════════════════════════════
  dashboard: router({
    stats: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return { lowStockCount: 0, expiringCount: 0, pendingOrders: 0, pendingApprovals: 0, totalSuppliers: 0, overdueInvoices: 0, totalInventoryValue: 0 };
      const [lowStock, expiring, pending, approvals, supplierList, overdueInv, allSupplies] = await Promise.all([
        db.select({ id: medicalSupplies.id }).from(medicalSupplies).where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.currentStock, medicalSupplies.reorderPoint))),
        db.select({ id: medicalSupplies.id }).from(medicalSupplies).where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.expiryDate, new Date(Date.now() + 30 * 86400000)))),
        db.select({ id: purchaseOrders.id }).from(purchaseOrders).where(inArray(purchaseOrders.status as any, ["sent", "acknowledged", "partial_delivery"])),
        db.select({ id: purchaseRequisitions.id }).from(purchaseRequisitions).where(eq(purchaseRequisitions.status, "submitted")),
        db.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.isActive, true)),
        db.select({ id: invoices.id }).from(invoices).where(and(inArray(invoices.status as any, ["pending","partial"]), lt(invoices.dueDate, new Date()))),
        db.select({ currentStock: medicalSupplies.currentStock, unitCost: medicalSupplies.unitCost }).from(medicalSupplies).where(eq(medicalSupplies.isActive, true)),
      ]);
      const totalInventoryValue = allSupplies.reduce((s, i) => s + Number(i.currentStock) * Number(i.unitCost), 0);
      return {
        lowStockCount: lowStock.length,
        expiringCount: expiring.length,
        pendingOrders: pending.length,
        pendingApprovals: approvals.length,
        totalSuppliers: supplierList.length,
        overdueInvoices: overdueInv.length,
        totalInventoryValue,
      };
    }),
  }),

  // ══════════════════════════════════════════════════════════
  // REPORTS
  // ══════════════════════════════════════════════════════════
  reports: router({
    summary: protectedProcedure
      .input(z.object({ from: z.date().optional(), to: z.date().optional(), preset: z.enum(["monthly","quarterly","yearly","custom"]).default("monthly") }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const now = new Date();
        let from = input.from;
        let to = input.to ?? now;
        if (!from) {
          if (input.preset === "monthly") from = new Date(now.getFullYear(), now.getMonth(), 1);
          else if (input.preset === "quarterly") { const q = Math.floor(now.getMonth() / 3); from = new Date(now.getFullYear(), q * 3, 1); }
          else if (input.preset === "yearly") from = new Date(now.getFullYear(), 0, 1);
          else from = new Date(now.getFullYear(), now.getMonth(), 1);
        }
        const [ordersInPeriod, invoicesInPeriod, paymentsInPeriod, usageInPeriod] = await Promise.all([
          db.select().from(purchaseOrders).where(and(gte(purchaseOrders.createdAt, from), lte(purchaseOrders.createdAt, to))),
          db.select().from(invoices).where(and(gte(invoices.createdAt, from), lte(invoices.createdAt, to))),
          db.select().from(payments).where(and(gte(payments.paymentDate, from), lte(payments.paymentDate, to))),
          db.select().from(inventoryTransactions).where(and(eq(inventoryTransactions.transactionType, "usage"), gte(inventoryTransactions.createdAt, from), lte(inventoryTransactions.createdAt, to))),
        ]);
        return {
          period: { from, to, preset: input.preset },
          orders: {
            total: ordersInPeriod.length,
            delivered: ordersInPeriod.filter(o => o.status === "delivered").length,
            pending: ordersInPeriod.filter(o => ["draft","sent","acknowledged"].includes(o.status)).length,
            cancelled: ordersInPeriod.filter(o => o.status === "cancelled").length,
            byStatus: ordersInPeriod.reduce((acc: Record<string, number>, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {}),
            totalSpendRWF: ordersInPeriod.filter(o => o.status === "delivered").reduce((s, o) => s + Number(o.totalAmount), 0),
          },
          financial: {
            totalInvoicedRWF: invoicesInPeriod.reduce((s, i) => s + Number(i.totalAmount), 0),
            totalPaidRWF: paymentsInPeriod.reduce((s, p) => s + Number(p.amount), 0),
            outstandingRWF: invoicesInPeriod.reduce((s, i) => s + Number(i.totalAmount) - Number(i.paidAmount || 0), 0),
            invoiceCount: invoicesInPeriod.length,
            paidInvoices: invoicesInPeriod.filter(i => i.status === "paid").length,
          },
          inventory: {
            totalUsageUnits: usageInPeriod.reduce((s, t) => s + Math.abs(t.quantity), 0),
            transactionCount: usageInPeriod.length,
          },
        };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // AI FORECASTING
  // ══════════════════════════════════════════════════════════
  aiForecasting: router({
    generateForecast: protectedProcedure
      .input(z.object({ supplyId: z.number(), forecastPeriod: z.string(), method: z.enum(["linear","exponential_smoothing","arima","ml"]).default("ml") }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [supply] = await db.select().from(medicalSupplies).where(eq(medicalSupplies.id, input.supplyId)).limit(1);
        if (!supply) throw new TRPCError({ code: "NOT_FOUND", message: "Supply not found" });
        const txns = await db.select().from(inventoryTransactions)
          .where(and(eq(inventoryTransactions.supplyId, input.supplyId), eq(inventoryTransactions.transactionType, "usage")))
          .orderBy(desc(inventoryTransactions.createdAt)).limit(500);
        const { predictedQuantity, confidence, dataPointsUsed } = computeForecast(txns, input.method, 30);
        const result = await db.insert(forecasts).values({ supplyId: input.supplyId, forecastPeriod: input.forecastPeriod, predictedQuantity, confidence: confidence.toFixed(2), method: input.method, dataPointsUsed });
        const id = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "GENERATE_AI_FORECAST", entityType: "forecast", entityId: id, changes: JSON.stringify({ method: input.method, predictedQuantity, confidence, dataPointsUsed }) });
        const gap = predictedQuantity - supply.currentStock;
        return {
          success: true,
          forecast: {
            id, supplyId: input.supplyId, supplyName: supply.name,
            predictedQuantity, confidence: parseFloat(confidence.toFixed(2)),
            method: input.method, period: input.forecastPeriod, dataPointsUsed,
            recommendations: gap > 0
              ? [`Order ${gap.toLocaleString()} ${supply.unit} to cover forecasted demand (${predictedQuantity.toLocaleString()} predicted, ${supply.currentStock.toLocaleString()} in stock)`]
              : [`Current stock (${supply.currentStock.toLocaleString()} ${supply.unit}) is sufficient for the forecast period`],
          },
        };
      }),

    getDemandRecommendations: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { recommendations: [] };
      const allItems = await db.select().from(medicalSupplies).where(eq(medicalSupplies.isActive, true));
      const recs = await Promise.all(allItems.map(async item => {
        const txns = await db!.select().from(inventoryTransactions)
          .where(and(eq(inventoryTransactions.supplyId, item.id), eq(inventoryTransactions.transactionType, "usage")))
          .orderBy(desc(inventoryTransactions.createdAt)).limit(200);
        const { predictedQuantity, confidence, dataPointsUsed } = computeForecast(txns, "ml", 30);
        const gap = predictedQuantity - item.currentStock;
        const dailyRate = predictedQuantity / 30;
        const stockCoverDays = dailyRate > 0 ? Math.floor(item.currentStock / dailyRate) : 999;
        let urgency: "critical" | "high" | "medium" | "low";
        if (item.currentStock === 0) urgency = "critical";
        else if (stockCoverDays < 7 || item.currentStock < item.reorderPoint * 0.5) urgency = "high";
        else if (item.currentStock <= item.reorderPoint || gap > 0) urgency = "medium";
        else urgency = "low";
        const recommendedOrderQty = Math.max(item.reorderQuantity, gap > 0 ? gap : 0);
        return { supplyId: item.id, supplyName: item.name, category: item.category, unit: item.unit, currentStock: item.currentStock, reorderPoint: item.reorderPoint, reorderQuantity: item.reorderQuantity, recommendedOrderQty, predictedDemand30d: predictedQuantity, stockCoverDays: Math.min(999, stockCoverDays), confidence: parseFloat(confidence.toFixed(2)), dataPointsUsed, urgency, estimatedCostRWF: Number(item.unitCost) * recommendedOrderQty };
      }));
      const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return { recommendations: recs.filter(r => r.urgency !== "low").sort((a, b) => order[a.urgency] - order[b.urgency]) };
    }),

    getAllForecasts: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(forecasts).orderBy(desc(forecasts.createdAt)).limit(200);
    }),
  }),

  // ══════════════════════════════════════════════════════════
  // AUDIT TRAIL
  // ══════════════════════════════════════════════════════════
  auditTrail: router({
    list: adminProcedure
      .input(z.object({ limit: z.number().default(200), entityType: z.string().optional(), userId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { logs: [] };
        const conds = [];
        if (input.entityType) conds.push(eq(auditLogs.entityType, input.entityType));
        if (input.userId) conds.push(eq(auditLogs.userId, input.userId));
        const logs = await db.select().from(auditLogs)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(auditLogs.createdAt)).limit(input.limit);
        // Enrich with user names
        const userIds = [...new Set(logs.map(l => l.userId))];
        const userList = userIds.length ? await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).where(inArray(users.id, userIds)) : [];
        const um = new Map(userList.map(u => [u.id, u]));
        return { logs: logs.map(l => ({ ...l, userName: um.get(l.userId)?.name ?? `User #${l.userId}`, userEmail: um.get(l.userId)?.email, userRole: um.get(l.userId)?.role })) };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // EXPORTS
  // ══════════════════════════════════════════════════════════
  export: router({
    allowedReports: protectedProcedure.query(({ ctx }) => {
      return { reports: getAllowedReportTypesForRole(ctx.user.role) };
    }),
    inventoryToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "inventory");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const items = await db.select({
        code: medicalSupplies.code,
        name: medicalSupplies.name,
        category: medicalSupplies.category,
        unit: medicalSupplies.unit,
        currentStock: medicalSupplies.currentStock,
        reorderPoint: medicalSupplies.reorderPoint,
        reorderQuantity: medicalSupplies.reorderQuantity,
        unitCost: medicalSupplies.unitCost,
        supplierName: suppliers.name,
        expiryDate: medicalSupplies.expiryDate,
        storageLocation: medicalSupplies.storageLocation,
        batchNumber: medicalSupplies.batchNumber,
        status: sql<string>`case when ${medicalSupplies.currentStock} <= ${medicalSupplies.reorderPoint} then 'Low Stock' else 'In Stock' end`,
      }).from(medicalSupplies)
        .leftJoin(suppliers, eq(medicalSupplies.supplierId, suppliers.id))
        .where(eq(medicalSupplies.isActive, true));
      await logReportExport(db, ctx.user.id, "inventory");
      return { data: items, timestamp: new Date() };
    }),
    suppliersToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "suppliers");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const data = await db.select({
        supplierName: suppliers.name,
        contactPerson: suppliers.contactPerson,
        email: suppliers.email,
        phone: suppliers.phone,
        city: suppliers.city,
        country: suppliers.country,
        paymentTerms: suppliers.paymentTerms,
        averageDeliveryDays: suppliers.averageDeliveryDays,
        rating: suppliers.rating,
        status: sql<string>`case when ${suppliers.isActive} = 1 then 'Active' else 'Inactive' end`,
      }).from(suppliers).where(eq(suppliers.isActive, true));
      await logReportExport(db, ctx.user.id, "suppliers");
      return { data, timestamp: new Date() };
    }),
    ordersToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "orders");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      let data;
      if (ctx.user.role === "supplier") {
        if (!ctx.user.supplierId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your supplier account is not linked yet." });
        }
        data = await db.select({
          poNumber: purchaseOrders.poNumber,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          createdAt: purchaseOrders.createdAt,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          deliveryDate: purchaseOrders.deliveryDate,
          notes: purchaseOrders.notes,
        }).from(purchaseOrders)
          .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
          .where(eq(purchaseOrders.supplierId, ctx.user.supplierId));
      } else {
        data = await db.select({
          poNumber: purchaseOrders.poNumber,
          supplierName: suppliers.name,
          status: purchaseOrders.status,
          totalAmount: purchaseOrders.totalAmount,
          createdAt: purchaseOrders.createdAt,
          expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
          deliveryDate: purchaseOrders.deliveryDate,
          notes: purchaseOrders.notes,
        }).from(purchaseOrders)
          .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id));
      }
      await logReportExport(db, ctx.user.id, "orders");
      return { data, timestamp: new Date() };
    }),
    financialToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "financial");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const data = await db.select({
        invoiceNumber: invoices.invoiceNumber, totalAmount: invoices.totalAmount, paidAmount: invoices.paidAmount,
        status: invoices.status, dueDate: invoices.dueDate, invoiceDate: invoices.invoiceDate,
        supplierName: suppliers.name, poNumber: purchaseOrders.poNumber,
      }).from(invoices)
        .leftJoin(suppliers, eq(invoices.supplierId, suppliers.id))
        .leftJoin(purchaseOrders, eq(invoices.poId, purchaseOrders.id));
      await logReportExport(db, ctx.user.id, "financial");
      return { data, timestamp: new Date() };
    }),
    budgetsToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "budgets");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const data = await db.select().from(budgets);
      await logReportExport(db, ctx.user.id, "budgets");
      return { data, timestamp: new Date() };
    }),
    usersToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "users");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const data = await db.select({
        name: users.name,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        supplierName: suppliers.name,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
      }).from(users)
        .leftJoin(suppliers, eq(users.supplierId, suppliers.id))
        .orderBy(asc(users.name));
      await logReportExport(db, ctx.user.id, "users");
      return { data, timestamp: new Date() };
    }),
    logsToJSON: protectedProcedure.query(async ({ ctx }) => {
      assertCanExportReport(ctx.user.role, "logs");
      const db = await getDb();
      if (!db) return { data: [], timestamp: new Date() };
      const data = await db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        changes: auditLogs.changes,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
      }).from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.createdAt));
      await logReportExport(db, ctx.user.id, "logs");
      return { data, timestamp: new Date() };
    }),
    medicineDetailReport: protectedProcedure
      .input(z.number())
      .query(async ({ input: medicineId, ctx }) => {
        assertCanExportReport(ctx.user.role, "inventory");
        const db = await getDb();
        if (!db) return { medicine: null, usage: [], summary: {} };

        // Get medicine details
        const [medicine] = await db.select().from(medicalSupplies)
          .leftJoin(suppliers, eq(medicalSupplies.supplierId, suppliers.id))
          .where(eq(medicalSupplies.id, medicineId));

        if (!medicine) {
          return { medicine: null, usage: [], summary: {} };
        }

        // Get usage history (last 100 transactions)
        const usage = await db.select({
          transactionType: inventoryTransactions.transactionType,
          quantity: inventoryTransactions.quantity,
          notes: inventoryTransactions.notes,
          userName: users.name,
          createdAt: inventoryTransactions.createdAt,
        }).from(inventoryTransactions)
          .leftJoin(users, eq(inventoryTransactions.userId, users.id))
          .where(eq(inventoryTransactions.supplyId, medicineId))
          .orderBy(desc(inventoryTransactions.createdAt))
          .limit(100);

        // Calculate usage summary
        const totalUsage = usage.filter(u => u.transactionType === "usage").reduce((sum, u) => sum + u.quantity, 0);
        const totalPurchased = usage.filter(u => u.transactionType === "purchase").reduce((sum, u) => sum + u.quantity, 0);
        const avgMonthlyUsage = totalUsage > 0 ? Math.round(totalUsage / 3) : 0; // Rough estimate
        const estimatedDaysToRunOut = medicine.medical_supplies.currentStock > 0 && avgMonthlyUsage > 0
          ? Math.round((medicine.medical_supplies.currentStock / avgMonthlyUsage) * 30)
          : -1;

        const summary = {
          totalUsage,
          totalPurchased,
          avgMonthlyUsage,
          estimatedDaysToRunOut,
          stockStatus: medicine.medical_supplies.currentStock <= medicine.medical_supplies.reorderPoint ? "Low Stock" : "In Stock",
        };

        await logReportExport(db, ctx.user.id, "inventory");
        return {
          medicine: {
            id: medicine.medical_supplies.id,
            code: medicine.medical_supplies.code,
            name: medicine.medical_supplies.name,
            category: medicine.medical_supplies.category,
            unit: medicine.medical_supplies.unit,
            currentStock: medicine.medical_supplies.currentStock,
            reorderPoint: medicine.medical_supplies.reorderPoint,
            reorderQuantity: medicine.medical_supplies.reorderQuantity,
            unitCost: medicine.medical_supplies.unitCost,
            supplierName: medicine.suppliers?.name || "N/A",
            expiryDate: medicine.medical_supplies.expiryDate,
            storageLocation: medicine.medical_supplies.storageLocation,
            batchNumber: medicine.medical_supplies.batchNumber,
            description: medicine.medical_supplies.description,
          },
          usage,
          summary,
          timestamp: new Date(),
        };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // USER MANAGEMENT (admin)
  // ══════════════════════════════════════════════════════════
  userManagement: router({
    list: adminProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(users).orderBy(asc(users.name));
    }),

    create: adminProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().min(2), role: z.enum(["admin","pharmacist","procurement_officer","supplier","accountant"]), supplierId: z.number().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [ex] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
        if (ex) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });
        const hash = await bcrypt.hash(input.password, 12);
        const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const result = await db.insert(users).values({ openId, email: input.email.toLowerCase(), name: input.name, passwordHash: hash, role: input.role as any, supplierId: input.supplierId ?? null });
        const userId = getInsertId(result);
        if (input.supplierId) {
          try { await db.update(suppliers).set({ userId }).where(eq(suppliers.id, input.supplierId)); } catch {}
        }
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "CREATE_USER", entityType: "user", entityId: userId });
        return { success: true, id: userId };
      }),

    updateRole: adminProcedure
      .input(z.object({ userId: z.number(), role: z.enum(["admin","pharmacist","procurement_officer","supplier","accountant"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(users).set({ role: input.role as any }).where(eq(users.id, input.userId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "UPDATE_USER_ROLE", entityType: "user", entityId: input.userId, changes: JSON.stringify({ role: input.role }) });
        return { success: true };
      }),

    toggleActive: adminProcedure
      .input(z.object({ userId: z.number(), isActive: z.boolean() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot deactivate your own account" });
        await db.update(users).set({ isActive: input.isActive }).where(eq(users.id, input.userId));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: input.isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER", entityType: "user", entityId: input.userId });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // QUOTATIONS (procurement)
  // ══════════════════════════════════════════════════════════
  quotations: router({
    list: procurementProcedure
      .input(z.object({ requisitionId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        if (input.requisitionId) return db.select().from(quotations).where(eq(quotations.requisitionId, input.requisitionId));
        return db.select().from(quotations).orderBy(desc(quotations.createdAt));
      }),
    submit: procurementProcedure
      .input(z.object({ requisitionId: z.number(), supplierId: z.number(), totalAmount: z.string(), validUntil: z.date().optional(), notes: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const qNumber = `QT-${Date.now()}`;
        const result = await db.insert(quotations).values({ ...input, quotationNumber: qNumber });
        const id = getInsertId(result);
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "SUBMIT_QUOTATION", entityType: "quotation", entityId: id });
        return { success: true, id };
      }),
    accept: procurementProcedure
      .input(z.object({ quotationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await db.update(quotations).set({ status: "accepted" as any }).where(eq(quotations.id, input.quotationId));
        const [qt] = await db.select().from(quotations).where(eq(quotations.id, input.quotationId));
        if (qt) await db.update(quotations).set({ status: "rejected" as any }).where(and(eq(quotations.requisitionId, qt.requisitionId), ne(quotations.id, input.quotationId)));
        await db.insert(auditLogs).values({ userId: ctx.user.id, action: "ACCEPT_QUOTATION", entityType: "quotation", entityId: input.quotationId });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // SEARCH
  // ══════════════════════════════════════════════════════════
  search: router({
    inventory: protectedProcedure
      .input(z.object({ query: z.string().optional(), category: z.string().optional(), limit: z.number().default(20) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds = [eq(medicalSupplies.isActive, true)];
        if (input.query) conds.push(like(medicalSupplies.name, `%${input.query}%`));
        if (input.category) conds.push(eq(medicalSupplies.category, input.category));
        return db.select().from(medicalSupplies).where(and(...conds)).limit(input.limit);
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // 2FA + PASSWORD RESET (external router)
  // ══════════════════════════════════════════════════════════
  authExt: authExtRouter,

  // ══════════════════════════════════════════════════════════
  // EXTERNAL ROUTERS
  // ══════════════════════════════════════════════════════════
  exportData: exportRouter,
  forecastDashboard: forecastRouter,

  // ══════════════════════════════════════════════════════════
  // CHAT — per requisition or per PO
  // ══════════════════════════════════════════════════════════
  chat: router({
    list: protectedProcedure
      .input(z.object({ entityType: z.enum(["requisition", "purchase_order"]), entityId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const msgs = await db.select({
          id: chatMessages.id,
          message: chatMessages.message,
          replyToMessageId: chatMessages.replyToMessageId,
          editedAt: chatMessages.editedAt,
          createdAt: chatMessages.createdAt,
          updatedAt: chatMessages.updatedAt,
          userId: chatMessages.userId,
          entityType: chatMessages.entityType,
          entityId: chatMessages.entityId,
        }).from(chatMessages)
          .where(and(eq(chatMessages.entityType, input.entityType), eq(chatMessages.entityId, input.entityId)))
          .orderBy(asc(chatMessages.createdAt));
        // Enrich with user name
        const uids = Array.from(new Set(msgs.map(m => m.userId)));
        const uList = uids.length ? await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(inArray(users.id, uids)) : [];
        const um = new Map(uList.map(u => [u.id, u]));
        const mm = new Map(msgs.map(m => [m.id, m]));
        return msgs.map(m => {
          const replied = m.replyToMessageId ? mm.get(m.replyToMessageId) : null;
          return {
            ...m,
            isEdited: Boolean(m.editedAt),
            userName: um.get(m.userId)?.name ?? `User #${m.userId}`,
            userRole: um.get(m.userId)?.role ?? "unknown",
            replyToMessage: replied ? {
              id: replied.id,
              message: replied.message,
              userId: replied.userId,
              userName: um.get(replied.userId)?.name ?? `User #${replied.userId}`,
            } : null,
          };
        });
      }),

    send: protectedProcedure
      .input(z.object({
        entityType: z.enum(["requisition", "purchase_order"]),
        entityId: z.number(),
        message: z.string().min(1).max(2000),
        replyToMessageId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        if (input.replyToMessageId) {
          const [replyTarget] = await db.select({
            id: chatMessages.id,
            entityType: chatMessages.entityType,
            entityId: chatMessages.entityId,
          }).from(chatMessages).where(eq(chatMessages.id, input.replyToMessageId)).limit(1);
          if (!replyTarget || replyTarget.entityType !== input.entityType || replyTarget.entityId !== input.entityId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Reply target was not found in this conversation." });
          }
        }
        const result = await db.insert(chatMessages).values({
          entityType: input.entityType,
          entityId: input.entityId,
          userId: ctx.user.id,
          message: input.message.trim(),
          replyToMessageId: input.replyToMessageId ?? null,
        });
        const id = getInsertId(result);
        // Notify relevant parties about the new message
        const senderName = ctx.user.name || ctx.user.email;
        if (input.entityType === "purchase_order") {
          createRoleNotifications({
            type: "order_update",
            title: `New message on PO #${input.entityId}`,
            message: `${senderName}: ${input.message.slice(0, 120)}${input.message.length > 120 ? "…" : ""}`,
            referenceId: input.entityId,
          }).catch(() => {});
        } else {
          createRoleNotifications({
            type: "approval_pending",
            title: `New message on Requisition #${input.entityId}`,
            message: `${senderName}: ${input.message.slice(0, 120)}${input.message.length > 120 ? "…" : ""}`,
            referenceId: input.entityId,
          }).catch(() => {});
        }
        return { success: true, id };
      }),

    edit: protectedProcedure
      .input(z.object({
        messageId: z.number(),
        message: z.string().min(1).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const [existing] = await db.select().from(chatMessages).where(eq(chatMessages.id, input.messageId)).limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Message not found." });
        if (existing.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit your own messages." });
        }
        if (Date.now() - new Date(existing.createdAt).getTime() > CHAT_EDIT_WINDOW_MS) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "This message can no longer be edited." });
        }
        await db.update(chatMessages)
          .set({ message: input.message.trim(), editedAt: new Date() })
          .where(eq(chatMessages.id, input.messageId));
        await db.insert(auditLogs).values({
          userId: ctx.user.id,
          action: "EDIT_CHAT_MESSAGE",
          entityType: "chat_message",
          entityId: input.messageId,
        });
        return { success: true };
      }),
  }),

  // ══════════════════════════════════════════════════════════
  // DELIVERY RECEIPTS — pharmacist confirms physical receipt
  // ══════════════════════════════════════════════════════════
  deliveryReceipts: router({
    /** Get the receipt for a PO (if any) */
    getByPO: protectedProcedure
      .input(z.number())
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [receipt] = await db.select().from(deliveryReceipts).where(eq(deliveryReceipts.poId, input)).limit(1);
        if (!receipt) return null;
        const items = await db.select({
          id: receiptItems.id, receiptId: receiptItems.receiptId,
          supplyId: receiptItems.supplyId, orderedQuantity: receiptItems.orderedQuantity,
          receivedQuantity: receiptItems.receivedQuantity, notes: receiptItems.notes,
          supplyName: medicalSupplies.name, supplyUnit: medicalSupplies.unit,
        }).from(receiptItems)
          .leftJoin(medicalSupplies, eq(receiptItems.supplyId, medicalSupplies.id))
          .where(eq(receiptItems.receiptId, receipt.id));
        return { ...receipt, items };
      }),

    /** List POs with delivered goods that still need pharmacy receipt confirmation */
    pendingConfirmation: pharmacistProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      const pendingPOs = await db.select().from(purchaseOrders)
        .where(inArray(purchaseOrders.status as any, ["partial_delivery", "delivered"]));
      if (!pendingPOs.length) return [];
      const poIds = pendingPOs.map(p => p.id);
      const receipts = await db.select({ poId: deliveryReceipts.poId, status: deliveryReceipts.status })
        .from(deliveryReceipts).where(inArray(deliveryReceipts.poId, poIds));
      const confirmedPOIds = new Set(receipts.filter(r => r.status === "confirmed").map(r => r.poId));
      return pendingPOs.filter(p => !confirmedPOIds.has(p.id));
    }),

    /** Pharmacist confirms receipt — records actual quantities, updates stock */
    confirm: pharmacistProcedure
      .input(z.object({
        poId: z.number(),
        items: z.array(z.object({
          supplyId: z.number(),
          orderedQuantity: z.number(),
          receivedQuantity: z.number().min(0),
          notes: z.string().optional(),
        })),
        notes: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.poId)).limit(1);
        if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "Purchase order not found" });
        if (!["partial_delivery", "delivered"].includes(String(po.status)))
          throw new TRPCError({ code: "BAD_REQUEST", message: "Can only confirm receipt for delivered or partially delivered orders" });

        // Check not already confirmed
        const [existing] = await db.select({ id: deliveryReceipts.id }).from(deliveryReceipts)
          .where(and(eq(deliveryReceipts.poId, input.poId), eq(deliveryReceipts.status, "confirmed"))).limit(1);
        if (existing) throw new TRPCError({ code: "CONFLICT", message: "Receipt already confirmed for this order" });

        const poLineItems = await db.select().from(poItems).where(eq(poItems.poId, input.poId));
        const providedItems = new Map(input.items.map(item => [item.supplyId, item]));
        const confirmedItems = poLineItems.map(item => {
          const provided = providedItems.get(item.supplyId);
          const deliveredQty = Number(item.deliveredQuantity ?? 0);
          const fallbackQty = deliveredQty > 0 ? deliveredQty : Number(item.quantity);
          const receivedQuantity = provided ? Number(provided.receivedQuantity ?? 0) : fallbackQty;
          return {
            poItemId: item.id,
            supplyId: item.supplyId,
            orderedQuantity: Number(provided?.orderedQuantity ?? item.quantity),
            receivedQuantity,
            notes: provided?.notes,
          };
        }).filter(item => item.orderedQuantity > 0);

        if (!confirmedItems.length) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No delivery items are available to confirm." });
        }

        // Create receipt record
        const receiptResult = await db.insert(deliveryReceipts).values({
          poId: input.poId,
          confirmedBy: ctx.user.id,
          status: "confirmed",
          notes: input.notes,
          confirmedAt: new Date(),
        });
        const receiptId = getInsertId(receiptResult);

        // Save receipt items
        if (confirmedItems.length > 0) {
          await db.insert(receiptItems).values(
            confirmedItems.map(i => ({
              receiptId,
              supplyId: i.supplyId,
              orderedQuantity: i.orderedQuantity,
              receivedQuantity: i.receivedQuantity,
              notes: i.notes,
            }))
          );
        }

        // Auto-update stock for each received item
        for (const item of confirmedItems) {
          if (item.receivedQuantity <= 0) continue;
          await db.update(poItems)
            .set({ deliveredQuantity: item.receivedQuantity })
            .where(eq(poItems.id, item.poItemId));
          const [supply] = await db.select({ currentStock: medicalSupplies.currentStock })
            .from(medicalSupplies).where(eq(medicalSupplies.id, item.supplyId)).limit(1);
          if (!supply) continue;
          const newStock = Number(supply.currentStock ?? 0) + Number(item.receivedQuantity);
          await db.update(medicalSupplies).set({ currentStock: newStock }).where(eq(medicalSupplies.id, item.supplyId));
          await db.insert(inventoryTransactions).values({
            supplyId: item.supplyId,
            transactionType: "purchase",
            quantity: item.receivedQuantity,
            userId: ctx.user.id,
            notes: `Received from PO #${po.poNumber}${item.notes ? " — " + item.notes : ""}`,
            referenceId: input.poId,
          });
        }

        await db.insert(auditLogs).values({
          userId: ctx.user.id,
          action: "CONFIRM_DELIVERY_RECEIPT",
          entityType: "purchase_order",
          entityId: input.poId,
          changes: JSON.stringify({ receiptId, itemCount: confirmedItems.length, deliveryStatus: po.status }),
        });

        // Notify procurement + supplier that receipt is confirmed
        createRoleNotifications({
          type: "order_update",
          title: `Delivery Receipt Confirmed — PO ${po.poNumber}`,
          message: `Pharmacist ${ctx.user.name || ctx.user.email} confirmed receipt of ${po.poNumber}. Supplier may now submit the invoice.`,
          referenceId: input.poId,
        }).catch(() => {});

        // Trigger low-stock check after receiving
        checkAndNotifyInventory().catch(() => {});

        return { success: true, receiptId };
      }),
  }),

// ─── Private helpers ───────────────────────────────────────────────────────────

});

async function _notifySupplierNewPO(db: any, poId: number, supplierId: number, totalAmount: number) {
  try {
    const [po] = await db.select({ poNumber: purchaseOrders.poNumber, expectedDeliveryDate: purchaseOrders.expectedDeliveryDate })
      .from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    // Notify all supplier-role users
    const supplierUsers = await db.select({ id: users.id, email: users.email }).from(users)
      .where(and(eq(users.role as any, "supplier"), eq(users.isActive, true)));
    if (supplierUsers.length === 0) return;
    for (const su of supplierUsers) {
      await createRoleNotifications({
        type: "order_update",
        title: `New Purchase Order — Action Required`,
        message: `You have received ${po?.poNumber ?? `PO #${poId}`} for RWF ${totalAmount.toLocaleString()}. Please log in and confirm.${po?.expectedDeliveryDate ? ` Expected delivery: ${new Date(po.expectedDeliveryDate).toLocaleDateString()}.` : ""}`,
        referenceId: poId,
        specificUserId: su.id,
      });
    }
  } catch {}
}

async function _getConfirmedReceiptValue(db: any, poId: number): Promise<number> {
  const [receipt] = await db.select({ id: deliveryReceipts.id }).from(deliveryReceipts)
    .where(and(eq(deliveryReceipts.poId, poId), eq(deliveryReceipts.status, "confirmed"))).limit(1);
  if (!receipt) return 0;

  const items = await db.select({
    receivedQuantity: receiptItems.receivedQuantity,
    unitCost: poItems.unitCost,
  }).from(receiptItems)
    .leftJoin(poItems, and(eq(poItems.poId, poId), eq(poItems.supplyId, receiptItems.supplyId)))
    .where(eq(receiptItems.receiptId, receipt.id));

  return items.reduce((sum, item) => sum + (Number(item.receivedQuantity) * Number(item.unitCost || 0)), 0);
}

export type AppRouter = typeof appRouter;
