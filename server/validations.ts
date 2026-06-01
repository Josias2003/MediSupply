import { z } from "zod";

// ─── Base Validations ───────────────────────────────────────────────────

export const positiveNumber = z.number().positive("Must be greater than 0");
export const nonNegativeNumber = z.number().min(0, "Cannot be negative");
export const phoneNumber = z.string().regex(/^\+?[0-9\-\s()]{10,}$/, "Invalid phone number");
export const currencyAmount = z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid currency amount");

// ─── Date Validations ───────────────────────────────────────────────────

// Past dates allowed (for historical entries, adjustments)
export const dateAllowPast = z.date().describe("Historical date");

// Only future dates allowed (for scheduling, orders)
export const futureDate = z.date()
  .refine(
    (date) => date > new Date(),
    "Date must be in the future"
  );

// No future dates allowed (for records, receipts, adjustments)
export const pastOrPresentDate = z.date()
  .refine(
    (date) => date <= new Date(),
    "Date cannot be in the future"
  );

// Flexible date for context (caller decides validation)
export const dateFlexible = z.date();

// ─── Inventory Validations ───────────────────────────────────────────────

export const medicalSupplyCreateSchema = z.object({
  code: z.string().min(1, "Code required").max(50),
  name: z.string().min(1, "Name required").max(255),
  category: z.string().min(1, "Category required"),
  unit: z.string().min(1, "Unit required"),
  currentStock: nonNegativeNumber.default(0),
  reorderPoint: nonNegativeNumber,
  reorderQuantity: positiveNumber,
  unitCost: currencyAmount,
  supplierId: z.number().optional(),
  expiryDate: dateAllowPast.optional(), // Allow past for historical batch setup
  batchNumber: z.string().optional(),
  storageLocation: z.string().optional(),
  description: z.string().optional(),
});

export const medicalSupplyUpdateSchema = z.object({
  id: z.number(),
  data: z.object({
    name: z.string().min(1).optional(),
    category: z.string().optional(),
    unit: z.string().optional(),
    currentStock: nonNegativeNumber.optional(),
    reorderPoint: nonNegativeNumber.optional(),
    reorderQuantity: positiveNumber.optional(),
    unitCost: currencyAmount.optional(),
    supplierId: z.number().nullable().optional(),
    expiryDate: dateAllowPast.nullable().optional(),
    batchNumber: z.string().optional(),
    storageLocation: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const inventoryAdjustmentSchema = z.object({
  supplyId: z.number(),
  newStock: nonNegativeNumber.describe("New stock count cannot be negative"),
  reason: z.string().min(1, "Adjustment reason required"),
});

export const inventoryTransactionSchema = z.object({
  supplyId: z.number(),
  quantity: positiveNumber.describe("Transaction quantity must be positive"),
  notes: z.string().optional(),
});

export const inventoryReturnSchema = z.object({
  supplyId: z.number(),
  quantity: positiveNumber.describe("Return quantity must be positive"),
  notes: z.string().optional(),
  referenceId: z.number().optional(),
});

// ─── Purchase Requisition Validations ───────────────────────────────────

export const requisitionItemSchema = z.object({
  supplyId: z.number(),
  quantity: positiveNumber.describe("Quantity must be greater than 0"),
  estimatedUnitCost: currencyAmount.optional(),
  notes: z.string().optional(),
});

export const createRequisitionSchema = z.object({
  items: z.array(requisitionItemSchema).min(1, "At least one item required"),
  dueDate: futureDate.optional(),
  notes: z.string().optional(),
  estimatedTotalCost: currencyAmount.optional(),
});

export const approveRequisitionSchema = z.object({
  requisitionId: z.number(),
  notes: z.string().optional(),
});

export const rejectRequisitionSchema = z.object({
  requisitionId: z.number(),
  reason: z.string().min(1, "Rejection reason required"),
});

// ─── Purchase Order Validations ─────────────────────────────────────────

export const poItemSchema = z.object({
  supplyId: z.number(),
  quantity: positiveNumber,
  unitPrice: currencyAmount,
  deliveryDate: futureDate.optional(),
  notes: z.string().optional(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number(),
  items: z.array(poItemSchema).min(1, "At least one item required"),
  expectedDeliveryDate: futureDate.optional(),
  paymentTerms: z.string().optional(),
  notes: z.string().optional(),
  totalAmount: currencyAmount.optional(),
});

export const updatePurchaseOrderSchema = z.object({
  id: z.number(),
  data: z.object({
    expectedDeliveryDate: futureDate.optional(),
    paymentTerms: z.string().optional(),
    notes: z.string().optional(),
  }),
});

// ─── Invoice Validations ────────────────────────────────────────────────

export const recordPaymentSchema = z.object({
  invoiceId: z.number(),
  amount: positiveNumber.describe("Payment amount must be greater than 0"),
  method: z.enum(["bank_transfer", "cash", "check", "mobile_money"]),
  reference: z.string().min(1, "Reference number required"),
  notes: z.string().optional(),
  paymentDate: pastOrPresentDate.optional(),
});

export const createInvoiceSchema = z.object({
  poId: z.number(),
  totalAmount: positiveNumber,
  dueDate: futureDate.optional(),
  notes: z.string().optional(),
});

// ─── Budget Validations ────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  department: z.string().min(1, "Department required"),
  allocatedAmount: positiveNumber.describe("Budget amount must be greater than 0"),
  fiscalYear: z.string().regex(/^\d{4}$/, "Fiscal year must be YYYY format"),
  notes: z.string().optional(),
});

// ─── Delivery Receipt Validations ───────────────────────────────────────

export const receiptItemSchema = z.object({
  poItemId: z.number(),
  quantityReceived: nonNegativeNumber.describe("Quantity received cannot be negative"),
  batchNumber: z.string().optional(),
  expiryDate: dateAllowPast.optional(),
  notes: z.string().optional(),
});

export const createDeliveryReceiptSchema = z.object({
  poId: z.number(),
  items: z.array(receiptItemSchema).min(1, "At least one item required"),
  receivedDate: pastOrPresentDate.optional(),
  deliveryNotes: z.string().optional(),
  damageNotes: z.string().optional(),
});

// ─── Forecast Validations ──────────────────────────────────────────────

export const createForecastSchema = z.object({
  supplyId: z.number(),
  forecastedDemand: positiveNumber.describe("Forecasted demand must be positive"),
  confidence: z.number().min(0).max(100),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM format"),
  notes: z.string().optional(),
});

// Type exports for use in components
export type MedicalSupplyCreate = z.infer<typeof medicalSupplyCreateSchema>;
export type MedicalSupplyUpdate = z.infer<typeof medicalSupplyUpdateSchema>;
export type InventoryAdjustment = z.infer<typeof inventoryAdjustmentSchema>;
export type CreateRequisition = z.infer<typeof createRequisitionSchema>;
export type CreatePurchaseOrder = z.infer<typeof createPurchaseOrderSchema>;
export type RecordPayment = z.infer<typeof recordPaymentSchema>;
export type CreateBudget = z.infer<typeof createBudgetSchema>;
export type CreateDeliveryReceipt = z.infer<typeof createDeliveryReceiptSchema>;
export type CreateForecast = z.infer<typeof createForecastSchema>;
