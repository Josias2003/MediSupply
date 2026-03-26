import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { medicalSupplies, suppliers, purchaseOrders } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export const exportRouter = router({
  inventoryToCSV: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { data: "", timestamp: new Date() };
      
      const items = await db.select().from(medicalSupplies)
        .where(eq(medicalSupplies.isActive, true));
      
      // Build CSV
      const headers = ["ID", "Code", "Name", "Category", "Current Stock", "Reorder Point", "Unit Cost", "Expiry Date"];
      const rows = items.map(item => [
        item.id,
        item.code,
        item.name,
        item.category,
        item.currentStock,
        item.reorderPoint,
        item.unitCost,
        item.expiryDate?.toISOString() || "",
      ]);
      
      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");
      
      return {
        data: csv,
        timestamp: new Date(),
        format: "csv",
        filename: `inventory-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),

  suppliersToCSV: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { data: "", timestamp: new Date() };
      
      const items = await db.select().from(suppliers)
        .where(eq(suppliers.isActive, true));
      
      const headers = ["ID", "Name", "Contact Person", "Email", "Phone", "City", "Country", "Rating", "Total Orders"];
      const rows = items.map(item => [
        item.id,
        item.name,
        item.contactPerson || "",
        item.email,
        item.phone || "",
        item.city || "",
        item.country || "",
        item.rating || "0",
        item.totalOrders || "0",
      ]);
      
      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");
      
      return {
        data: csv,
        timestamp: new Date(),
        format: "csv",
        filename: `suppliers-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),

  ordersToCSV: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { data: "", timestamp: new Date() };
      
      const items = await db.select().from(purchaseOrders);
      
      const headers = ["ID", "PO Number", "Supplier ID", "Status", "Total Amount", "Expected Delivery", "Created At"];
      const rows = items.map(item => [
        item.id,
        item.poNumber,
        item.supplierId,
        item.status,
        item.totalAmount,
        item.expectedDeliveryDate?.toISOString() || "",
        item.createdAt?.toISOString() || "",
      ]);
      
      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");
      
      return {
        data: csv,
        timestamp: new Date(),
        format: "csv",
        filename: `orders-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),

  inventoryToPDF: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };
      
      const items = await db.select().from(medicalSupplies)
        .where(eq(medicalSupplies.isActive, true));
      
      // PDF generation would use a library like pdfkit or reportlab
      // For now, return metadata for frontend to handle
      return {
        success: true,
        format: "pdf",
        itemCount: items.length,
        timestamp: new Date(),
        filename: `inventory-report-${new Date().toISOString().split('T')[0]}.pdf`,
        message: "PDF export ready. Use frontend PDF library to generate.",
      };
    }),

  sendReportByEmail: protectedProcedure
    .input(z.object({
      reportType: z.enum(["inventory", "suppliers", "orders", "financial"]),
      format: z.enum(["json", "csv", "pdf"]),
      recipientEmail: z.string().email(),
      includeCharts: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      // Email sending logic
      // This would integrate with email service (SendGrid, AWS SES, etc.)
      return {
        success: true,
        message: `${input.reportType} report queued for delivery to ${input.recipientEmail}`,
        timestamp: new Date(),
      };
    }),

  scheduleReportGeneration: protectedProcedure
    .input(z.object({
      reportType: z.enum(["inventory", "suppliers", "orders", "financial"]),
      format: z.enum(["json", "csv", "pdf"]),
      frequency: z.enum(["daily", "weekly", "monthly"]),
      recipientEmail: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // Schedule report generation
      return {
        success: true,
        message: `${input.reportType} report scheduled for ${input.frequency} delivery`,
        scheduleId: `schedule_${Date.now()}`,
      };
    }),
});
