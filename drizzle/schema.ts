import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, index } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["admin", "pharmacist", "procurement_officer", "supplier", "accountant"]).notNull(),
  supplierId: int("supplierId"),
  isActive: boolean("isActive").default(true).notNull(),
  twoFactorEnabled: boolean("twoFactorEnabled").default(false).notNull(),
  lastLogin: timestamp("lastLogin"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_email").on(table.email), index("idx_role").on(table.role)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** OTP codes for 2FA login and email verification */
export const otpCodes = mysqlTable("otp_codes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  purpose: mysqlEnum("purpose", ["2fa_login", "email_verify"]).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_otp_userId").on(table.userId)]);

/** Password reset tokens, single-use, expire in 1 hour */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_reset_token").on(table.token)]);

/** Per-user notification preferences stored in DB */
export const notificationPreferences = mysqlTable("notification_preferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  lowStockAlerts: boolean("lowStockAlerts").default(true).notNull(),
  expiryWarnings: boolean("expiryWarnings").default(true).notNull(),
  approvalAlerts: boolean("approvalAlerts").default(true).notNull(),
  orderUpdates: boolean("orderUpdates").default(true).notNull(),
  budgetAlerts: boolean("budgetAlerts").default(true).notNull(),
  emailNotifications: boolean("emailNotifications").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

export const medicalSupplies = mysqlTable("medical_supplies", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  currentStock: int("currentStock").default(0).notNull(),
  reorderPoint: int("reorderPoint").notNull(),
  reorderQuantity: int("reorderQuantity").notNull(),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(),
  supplierId: int("supplierId"),
  expiryDate: timestamp("expiryDate"),
  batchNumber: varchar("batchNumber", { length: 100 }),
  storageLocation: varchar("storageLocation", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_code").on(table.code), index("idx_category").on(table.category)]);

export type MedicalSupply = typeof medicalSupplies.$inferSelect;
export type InsertMedicalSupply = typeof medicalSupplies.$inferInsert;

export const inventoryTransactions = mysqlTable("inventory_transactions", {
  id: int("id").autoincrement().primaryKey(),
  supplyId: int("supplyId").notNull(),
  transactionType: mysqlEnum("transactionType", ["purchase", "usage", "adjustment", "expiry_removal"]).notNull(),
  quantity: int("quantity").notNull(),
  userId: int("userId").notNull(),
  notes: text("notes"),
  referenceId: int("referenceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_inv_supplyId").on(table.supplyId), index("idx_inv_userId").on(table.userId)]);

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = typeof inventoryTransactions.$inferInsert;

export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  /** The system user account linked to this supplier company */
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  contactPerson: varchar("contactPerson", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  country: varchar("country", { length: 100 }),
  registrationNumber: varchar("registrationNumber", { length: 100 }),
  paymentTerms: varchar("paymentTerms", { length: 100 }),
  averageDeliveryDays: int("averageDeliveryDays"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  totalOrders: int("totalOrders").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_sup_email").on(table.email), index("idx_sup_userId").on(table.userId)]);

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

export const purchaseRequisitions = mysqlTable("purchase_requisitions", {
  id: int("id").autoincrement().primaryKey(),
  requisitionNumber: varchar("requisitionNumber", { length: 50 }).notNull().unique(),
  createdBy: int("createdBy").notNull(),
  status: mysqlEnum("status", ["draft", "submitted", "approved", "rejected", "converted_to_po"]).default("draft").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).default("0"),
  approvedBy: int("approvedBy"),
  approvalDate: timestamp("approvalDate"),
  rejectionReason: text("rejectionReason"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_req_status").on(table.status), index("idx_req_createdBy").on(table.createdBy)]);

export type PurchaseRequisition = typeof purchaseRequisitions.$inferSelect;
export type InsertPurchaseRequisition = typeof purchaseRequisitions.$inferInsert;

export const requisitionItems = mysqlTable("requisition_items", {
  id: int("id").autoincrement().primaryKey(),
  requisitionId: int("requisitionId").notNull(),
  supplyId: int("supplyId").notNull(),
  quantity: int("quantity").notNull(),
  estimatedUnitCost: decimal("estimatedUnitCost", { precision: 12, scale: 2 }),
  notes: text("notes"),
});

export type RequisitionItem = typeof requisitionItems.$inferSelect;
export type InsertRequisitionItem = typeof requisitionItems.$inferInsert;

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: int("id").autoincrement().primaryKey(),
  poNumber: varchar("poNumber", { length: 50 }).notNull().unique(),
  requisitionId: int("requisitionId"),
  supplierId: int("supplierId").notNull(),
  createdBy: int("createdBy").notNull(),
  status: mysqlEnum("status", ["draft", "sent", "acknowledged", "partial_delivery", "delivered", "cancelled"]).default("draft").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  deliveryDate: timestamp("deliveryDate"),
  expectedDeliveryDate: timestamp("expectedDeliveryDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_po_number").on(table.poNumber), index("idx_po_status").on(table.status), index("idx_po_supplierId").on(table.supplierId)]);

export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = typeof purchaseOrders.$inferInsert;

export const poItems = mysqlTable("po_items", {
  id: int("id").autoincrement().primaryKey(),
  poId: int("poId").notNull(),
  supplyId: int("supplyId").notNull(),
  quantity: int("quantity").notNull(),
  unitCost: decimal("unitCost", { precision: 12, scale: 2 }).notNull(),
  deliveredQuantity: int("deliveredQuantity").default(0),
  notes: text("notes"),
});

export type POItem = typeof poItems.$inferSelect;
export type InsertPOItem = typeof poItems.$inferInsert;

export const quotations = mysqlTable("quotations", {
  id: int("id").autoincrement().primaryKey(),
  quotationNumber: varchar("quotationNumber", { length: 50 }).notNull().unique(),
  requisitionId: int("requisitionId").notNull(),
  supplierId: int("supplierId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  validUntil: timestamp("validUntil"),
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "expired"]).default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_quot_supplierId").on(table.supplierId)]);

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = typeof quotations.$inferInsert;

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoiceNumber", { length: 50 }).notNull().unique(),
  poId: int("poId").notNull(),
  supplierId: int("supplierId").notNull(),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0"),
  status: mysqlEnum("status", ["pending", "partial", "paid", "overdue", "cancelled"]).default("pending").notNull(),
  dueDate: timestamp("dueDate"),
  invoiceDate: timestamp("invoiceDate").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_inv_status").on(table.status), index("idx_inv_supplierId").on(table.supplierId)]);

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(),
  transactionReference: varchar("transactionReference", { length: 100 }),
  paymentDate: timestamp("paymentDate").defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

export const budgets = mysqlTable("budgets", {
  id: int("id").autoincrement().primaryKey(),
  department: varchar("department", { length: 100 }).notNull(),
  allocatedAmount: decimal("allocatedAmount", { precision: 12, scale: 2 }).notNull(),
  spentAmount: decimal("spentAmount", { precision: 12, scale: 2 }).default("0"),
  fiscalYear: int("fiscalYear").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Budget = typeof budgets.$inferSelect;
export type InsertBudget = typeof budgets.$inferInsert;

export const forecasts = mysqlTable("forecasts", {
  id: int("id").autoincrement().primaryKey(),
  supplyId: int("supplyId").notNull(),
  forecastPeriod: varchar("forecastPeriod", { length: 50 }).notNull(),
  predictedQuantity: int("predictedQuantity").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }),
  actualQuantity: int("actualQuantity"),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }),
  method: varchar("method", { length: 50 }),
  dataPointsUsed: int("dataPointsUsed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("idx_fc_supplyId").on(table.supplyId)]);

export type Forecast = typeof forecasts.$inferSelect;
export type InsertForecast = typeof forecasts.$inferInsert;

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["low_stock", "expiry_warning", "approval_pending", "order_update", "delivery_delay", "budget_alert", "forecast_alert", "payment_due"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message"),
  referenceId: int("referenceId"),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_notif_userId").on(table.userId), index("idx_notif_isRead").on(table.isRead)]);

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  action: varchar("action", { length: 255 }).notNull(),
  entityType: varchar("entityType", { length: 100 }).notNull(),
  entityId: int("entityId"),
  changes: text("changes"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("idx_audit_userId").on(table.userId), index("idx_audit_entityType").on(table.entityType)]);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

export const chatMessages = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["requisition", "purchase_order"]).notNull(),
  entityId: int("entityId").notNull(),
  userId: int("userId").notNull(),
  message: text("message").notNull(),
  replyToMessageId: int("replyToMessageId"),
  editedAt: timestamp("editedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_chat_entity").on(table.entityType, table.entityId),
  index("idx_chat_userId").on(table.userId),
  index("idx_chat_replyToMessageId").on(table.replyToMessageId),
]);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export const deliveryReceipts = mysqlTable("delivery_receipts", {
  id: int("id").autoincrement().primaryKey(),
  poId: int("poId").notNull(),
  confirmedBy: int("confirmedBy").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "disputed"]).default("pending").notNull(),
  notes: text("notes"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("idx_receipt_poId").on(table.poId),
  index("idx_receipt_status").on(table.status),
]);

export type DeliveryReceipt = typeof deliveryReceipts.$inferSelect;
export type InsertDeliveryReceipt = typeof deliveryReceipts.$inferInsert;

export const receiptItems = mysqlTable("receipt_items", {
  id: int("id").autoincrement().primaryKey(),
  receiptId: int("receiptId").notNull(),
  supplyId: int("supplyId").notNull(),
  orderedQuantity: int("orderedQuantity").notNull(),
  receivedQuantity: int("receivedQuantity").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("idx_receipt_item_receiptId").on(table.receiptId),
  index("idx_receipt_item_supplyId").on(table.supplyId),
]);

export type ReceiptItem = typeof receiptItems.$inferSelect;
export type InsertReceiptItem = typeof receiptItems.$inferInsert;
