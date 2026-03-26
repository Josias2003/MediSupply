import { protectedProcedure, router, adminProcedure } from "./_core/trpc";
import { z } from "zod";
import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";
import { eq, and, gte, lte } from "drizzle-orm";

export const auditRouter = router({
  list: adminProcedure
    .input(z.object({
      entityType: z.string().optional(),
      userId: z.number().optional(),
      action: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { logs: [], total: 0 };
      
      const conditions: any[] = [];
      
      if (input.entityType) {
        conditions.push(eq(auditLogs.entityType, input.entityType));
      }
      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }
      if (input.action) {
        conditions.push(eq(auditLogs.action, input.action));
      }
      if (input.dateFrom) {
        conditions.push(gte(auditLogs.createdAt, input.dateFrom));
      }
      if (input.dateTo) {
        conditions.push(lte(auditLogs.createdAt, input.dateTo));
      }
      
      const logs = await db.select().from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(input.limit)
        .offset(input.offset);
      
      return { logs, total: logs.length };
    }),

  search: adminProcedure
    .input(z.object({
      query: z.string(),
      entityType: z.string().optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { results: [], total: 0 };
      
      // Search across audit logs
      const logs = await db.select().from(auditLogs)
        .limit(input.limit)
        .offset(input.offset);
      
      return { results: logs, total: logs.length };
    }),

  getComplianceReport: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      reportType: z.enum(["inventory_changes", "approvals", "financial", "all"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { report: null, summary: {} };
      
      const conditions: any[] = [
        gte(auditLogs.createdAt, input.startDate),
        lte(auditLogs.createdAt, input.endDate),
      ];
      
      if (input.reportType !== "all") {
        conditions.push(eq(auditLogs.entityType, input.reportType));
      }
      
      const logs = await db.select().from(auditLogs)
        .where(and(...conditions));
      
      return {
        report: logs,
        summary: {
          totalEvents: logs.length,
          dateRange: { start: input.startDate, end: input.endDate },
          reportType: input.reportType,
          generatedAt: new Date(),
        },
      };
    }),

  exportComplianceReport: adminProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      format: z.enum(["json", "csv", "pdf"]),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };
      
      const logs = await db.select().from(auditLogs)
        .where(and(
          gte(auditLogs.createdAt, input.startDate),
          lte(auditLogs.createdAt, input.endDate),
        ));
      
      return {
        success: true,
        format: input.format,
        recordCount: logs.length,
        filename: `compliance-report-${new Date().toISOString().split('T')[0]}.${input.format}`,
      };
    }),
});
