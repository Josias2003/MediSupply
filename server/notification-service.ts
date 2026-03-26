/**
 * notification-service.ts
 * Creates role-appropriate notifications and optionally emails them.
 * Call these helpers from anywhere in routers.ts after key events.
 *
 * Role → notification type mapping:
 *   low_stock        → pharmacist, admin
 *   expiry_warning   → pharmacist, admin
 *   approval_pending → admin, procurement_officer
 *   order_update     → procurement_officer, admin, supplier (their own orders)
 *   budget_alert     → accountant, admin
 *   payment_due      → accountant, admin
 *   forecast_alert   → pharmacist, procurement_officer, admin
 */

import { getDb } from "./db";
import { notifications, notificationPreferences, users } from "../drizzle/schema";
import { eq, inArray } from "drizzle-orm";
import { sendEmail, notificationEmailHtml } from "./email";

type NotifType =
  | "low_stock"
  | "expiry_warning"
  | "approval_pending"
  | "order_update"
  | "delivery_delay"
  | "budget_alert"
  | "forecast_alert"
  | "payment_due";

// Which roles should receive each notification type
const ROLE_MAP: Record<NotifType, string[]> = {
  low_stock:        ["admin", "pharmacist"],
  expiry_warning:   ["admin", "pharmacist"],
  approval_pending: ["admin", "procurement_officer"],
  order_update:     ["admin", "procurement_officer"],
  delivery_delay:   ["admin", "procurement_officer"],
  budget_alert:     ["admin", "accountant"],
  payment_due:      ["admin", "accountant"],
  forecast_alert:   ["admin", "pharmacist", "procurement_officer"],
};

interface CreateNotificationOpts {
  type: NotifType;
  title: string;
  message: string;
  referenceId?: number;
  /** If set, only notify this specific user (e.g. supplier for their own order) */
  specificUserId?: number;
}

export async function createRoleNotifications(opts: CreateNotificationOpts): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    let targetUsers: { id: number; email: string; role: string }[] = [];

    if (opts.specificUserId) {
      const [u] = await db.select({ id: users.id, email: users.email, role: users.role })
        .from(users).where(eq(users.id, opts.specificUserId)).limit(1);
      if (u) targetUsers = [u];
    } else {
      const allowedRoles = ROLE_MAP[opts.type] || ["admin"];
      targetUsers = await db.select({ id: users.id, email: users.email, role: users.role })
        .from(users)
        .where(inArray(users.role as any, allowedRoles));
    }

    if (targetUsers.length === 0) return;

    // Insert in-app notifications
    await db.insert(notifications).values(
      targetUsers.map(u => ({
        userId: u.id,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        referenceId: opts.referenceId,
      }))
    );

    // Send email notifications for users who have it enabled
    const userIds = targetUsers.map(u => u.id);
    const prefs = await db.select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, userIds));

    const prefMap = new Map(prefs.map(p => [p.userId, p]));

    for (const u of targetUsers) {
      const pref = prefMap.get(u.id);
      // Default to true if no preference row exists yet
      const emailEnabled = pref ? pref.emailNotifications : true;
      if (emailEnabled) {
        sendEmail({
          to: u.email,
          subject: `MediSupply Rwanda — ${opts.title}`,
          html: notificationEmailHtml(opts.title, opts.message),
        }).catch(() => {}); // non-blocking
      }
    }
  } catch (err) {
    console.error("[Notifications] Failed to create notifications:", err);
  }
}

/** Check all inventory and create low-stock / expiry notifications.
 *  Call this from a cron or after any stock change. */
export async function checkAndNotifyInventory(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const { medicalSupplies } = await import("../drizzle/schema");
    const { lte, and, eq } = await import("drizzle-orm");

    // Low stock
    const lowStock = await db.select().from(medicalSupplies)
      .where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.currentStock, medicalSupplies.reorderPoint)));

    for (const item of lowStock) {
      await createRoleNotifications({
        type: "low_stock",
        title: `Low Stock: ${item.name}`,
        message: `${item.name} has ${item.currentStock} ${item.unit} remaining (reorder point: ${item.reorderPoint}). Immediate procurement action needed.`,
        referenceId: item.id,
      });
    }

    // Expiring within 30 days
    const soon = new Date();
    soon.setDate(soon.getDate() + 30);
    const expiring = await db.select().from(medicalSupplies)
      .where(and(eq(medicalSupplies.isActive, true), lte(medicalSupplies.expiryDate, soon)));

    for (const item of expiring) {
      if (!item.expiryDate) continue;
      const daysLeft = Math.ceil((item.expiryDate.getTime() - Date.now()) / 86400000);
      await createRoleNotifications({
        type: "expiry_warning",
        title: `Expiry Alert: ${item.name}`,
        message: `${item.name} (batch: ${item.batchNumber || "N/A"}) expires in ${daysLeft} days on ${item.expiryDate.toLocaleDateString("en-RW")}.`,
        referenceId: item.id,
      });
    }
  } catch (err) {
    console.error("[Notifications] Inventory check failed:", err);
  }
}
