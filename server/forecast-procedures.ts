/**
 * forecast-procedures.ts
 * Real statistical demand forecasting using actual transaction history.
 *
 * Algorithms implemented (no external ML library needed — pure math):
 *   linear             — Ordinary Least Squares regression on daily usage
 *   exponential_smoothing — Holt-Winters double exponential smoothing
 *   arima              — Simple AR(1) autoregressive model
 *   ml                 — Ensemble: weighted average of all three methods
 *
 * All methods use real inventory_transactions data from the DB.
 * Confidence is derived from R² / variance of historical data.
 */

import { protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { forecasts, medicalSupplies, inventoryTransactions } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

// ─── Statistical helpers ───────────────────────────────────────────────────────

/** Group usage transactions into daily buckets and return daily usage array */
function buildDailySeries(
  transactions: { quantity: number; createdAt: Date }[],
  days: number
): number[] {
  const buckets = new Array<number>(days).fill(0);
  const now = Date.now();
  for (const t of transactions) {
    const age = Math.floor((now - t.createdAt.getTime()) / 86400000);
    if (age >= 0 && age < days) {
      buckets[days - 1 - age] += Math.abs(t.quantity);
    }
  }
  return buckets;
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[], m?: number): number {
  const mu = m ?? mean(arr);
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, x) => s + (x - mu) ** 2, 0) / (arr.length - 1));
}

/** OLS linear regression — returns slope and intercept */
function linearRegression(y: number[]): { slope: number; intercept: number; r2: number } {
  const n = y.length;
  if (n < 2) return { slope: 0, intercept: mean(y), r2: 0 };

  const x = Array.from({ length: n }, (_, i) => i);
  const mx = mean(x), my = mean(y);
  const sxy = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const sxx = x.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;

  const yHat = x.map(xi => slope * xi + intercept);
  const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - yHat[i]) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

/** Holt double-exponential smoothing — returns forecast for next `horizon` steps */
function holtSmoothing(y: number[], horizon: number, alpha = 0.3, beta = 0.1): number {
  if (y.length < 2) return mean(y) * horizon;
  let level = y[0];
  let trend = y[1] - y[0];
  for (let i = 1; i < y.length; i++) {
    const prevLevel = level;
    level = alpha * y[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return Math.max(0, (level + trend * horizon) * horizon);
}

/** Simple AR(1) model — uses last value + weighted average of lags */
function ar1Forecast(y: number[], horizon: number): number {
  if (y.length < 3) return mean(y) * horizon;
  // Estimate AR(1) coefficient via OLS on lagged pairs
  const n = y.length;
  let sxy = 0, sxx = 0;
  const my = mean(y.slice(1));
  const mx = mean(y.slice(0, n - 1));
  for (let i = 0; i < n - 1; i++) {
    sxy += (y[i] - mx) * (y[i + 1] - my);
    sxx += (y[i] - mx) ** 2;
  }
  const phi = sxx === 0 ? 0.7 : Math.min(0.99, Math.max(-0.99, sxy / sxx));
  const mu = mean(y);
  // Forecast horizon steps ahead
  let forecast = y[n - 1];
  for (let h = 0; h < horizon; h++) {
    forecast = mu + phi * (forecast - mu);
  }
  return Math.max(0, forecast * horizon);
}

/** Seasonal adjustment factor based on month (healthcare demand patterns) */
function seasonalFactor(month: number): number {
  // 0-indexed month. Healthcare usage peaks: Jan (flu), Jul-Aug (malaria season in Rwanda)
  const factors = [1.15, 1.10, 1.00, 0.95, 0.90, 0.95, 1.10, 1.15, 1.05, 0.95, 0.90, 1.10];
  return factors[month] ?? 1.0;
}

/** Compute forecast quantity for a given period using actual transaction data */
export function computeForecast(
  transactions: { quantity: number; createdAt: Date }[],
  method: "linear" | "exponential_smoothing" | "arima" | "ml",
  horizonDays: number
): { predictedQuantity: number; confidence: number; dataPointsUsed: number } {
  // Use last 90 days of data for modeling
  const lookback = 90;
  const daily = buildDailySeries(transactions, lookback);
  const dataPointsUsed = daily.filter(v => v > 0).length;
  const seasonal = seasonalFactor(new Date().getMonth());

  let raw = 0;
  let confidence = 0.5;

  if (method === "linear") {
    const { slope, intercept, r2 } = linearRegression(daily);
    const forecastDay = daily.length + horizonDays / 2;
    raw = Math.max(0, (slope * forecastDay + intercept) * horizonDays);
    confidence = 0.50 + r2 * 0.40;

  } else if (method === "exponential_smoothing") {
    raw = holtSmoothing(daily, horizonDays);
    const sd = stddev(daily);
    const mu = mean(daily);
    confidence = mu === 0 ? 0.50 : Math.max(0.40, 0.90 - (sd / (mu + 1)) * 0.5);

  } else if (method === "arima") {
    raw = ar1Forecast(daily, horizonDays);
    const sd = stddev(daily);
    const mu = mean(daily);
    confidence = mu === 0 ? 0.50 : Math.max(0.45, 0.88 - (sd / (mu + 1)) * 0.4);

  } else {
    // ml = ensemble of all three, weighted by their relative quality
    const lin = linearRegression(daily);
    const linQty = Math.max(0, (lin.slope * (daily.length + horizonDays / 2) + lin.intercept) * horizonDays);
    const holtQty = holtSmoothing(daily, horizonDays);
    const arQty = ar1Forecast(daily, horizonDays);

    // Weight: linear 30%, holt 35%, AR 35%
    raw = linQty * 0.30 + holtQty * 0.35 + arQty * 0.35;

    const sd = stddev(daily);
    const mu = mean(daily);
    const dataBonus = Math.min(0.20, dataPointsUsed / lookback * 0.20);
    confidence = mu === 0 ? 0.50 : Math.max(0.55, 0.72 + dataBonus - (sd / (mu + 1)) * 0.3);
  }

  // Apply seasonal adjustment
  const adjusted = raw * seasonal;
  const predictedQuantity = Math.max(1, Math.round(adjusted));
  const boundedConfidence = Math.min(0.97, Math.max(0.40, confidence));

  return { predictedQuantity, confidence: boundedConfidence, dataPointsUsed };
}

// ─── tRPC router ───────────────────────────────────────────────────────────────

export const forecastRouter = router({

  getDashboard: protectedProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { forecasts: [], summary: { totalForecasts: 0, periodDays: input.days } };

      const forecastData = await db.select().from(forecasts)
        .orderBy(desc(forecasts.createdAt)).limit(100);

      const avgAccuracy = forecastData.filter(f => f.accuracy).length > 0
        ? forecastData
            .filter(f => f.accuracy)
            .reduce((s, f) => s + Number(f.accuracy), 0) / forecastData.filter(f => f.accuracy).length
        : null;

      return {
        forecasts: forecastData,
        summary: {
          totalForecasts: forecastData.length,
          periodDays: input.days,
          generatedAt: new Date(),
          averageAccuracy: avgAccuracy ? parseFloat(avgAccuracy.toFixed(1)) : null,
        },
      };
    }),

  getItemForecast: protectedProcedure
    .input(z.object({ supplyId: z.number(), days: z.number().default(30) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { forecast: null, item: null };

      const [item] = await db.select().from(medicalSupplies)
        .where(eq(medicalSupplies.id, input.supplyId));

      const [latestForecast] = await db.select().from(forecasts)
        .where(eq(forecasts.supplyId, input.supplyId))
        .orderBy(desc(forecasts.createdAt)).limit(1);

      return { item: item ?? null, forecast: latestForecast ?? null };
    }),

  generateForecast: protectedProcedure
    .input(z.object({
      supplyId: z.number(),
      method: z.enum(["linear", "exponential_smoothing", "arima", "ml"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) return { success: false, message: "Database unavailable" };

      const [supply] = await db.select().from(medicalSupplies)
        .where(eq(medicalSupplies.id, input.supplyId));
      if (!supply) throw new TRPCError({ code: "NOT_FOUND" });

      const txns = await db.select().from(inventoryTransactions)
        .where(and(
          eq(inventoryTransactions.supplyId, input.supplyId),
          eq(inventoryTransactions.transactionType, "usage"),
        ))
        .orderBy(desc(inventoryTransactions.createdAt))
        .limit(500);

      const { predictedQuantity, confidence, dataPointsUsed } = computeForecast(txns, input.method, 30);

      return {
        success: true,
        supplyId: input.supplyId,
        method: input.method,
        forecast: {
          nextMonth: predictedQuantity,
          confidence,
          dataPointsUsed,
          generatedAt: new Date(),
        },
      };
    }),

  compareActualVsForecast: protectedProcedure
    .input(z.object({ supplyId: z.number(), startDate: z.date(), endDate: z.date() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Get the latest forecast for this supply
      const [fc] = await db.select().from(forecasts)
        .where(eq(forecasts.supplyId, input.supplyId))
        .orderBy(desc(forecasts.createdAt)).limit(1);

      // Sum actual usage in the date range
      const { gte, lte } = await import("drizzle-orm");
      const txns = await db.select().from(inventoryTransactions)
        .where(and(
          eq(inventoryTransactions.supplyId, input.supplyId),
          eq(inventoryTransactions.transactionType, "usage"),
          gte(inventoryTransactions.createdAt, input.startDate),
          lte(inventoryTransactions.createdAt, input.endDate),
        ));

      const actualUsage = txns.reduce((s, t) => s + Math.abs(t.quantity), 0);
      const forecastedUsage = fc?.predictedQuantity ?? 0;
      const variance = actualUsage - forecastedUsage;
      const variancePct = forecastedUsage > 0
        ? parseFloat(((Math.abs(variance) / forecastedUsage) * 100).toFixed(1))
        : 0;
      const accuracy = Math.max(0, 100 - variancePct);

      return {
        supplyId: input.supplyId,
        period: { start: input.startDate, end: input.endDate },
        comparison: { forecastedUsage, actualUsage, variance, variancePercent: variancePct, accuracy },
      };
    }),

  getForecastAccuracy: protectedProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const all = await db.select().from(forecasts).where(
        // Only forecasts that have actual quantity recorded
        // drizzle doesn't have isNotNull in all versions, use raw
      );

      const withActual = all.filter(f => f.actualQuantity != null && f.predictedQuantity > 0);

      const byMethod: Record<string, { total: number; count: number }> = {};
      for (const f of withActual) {
        const m = f.method || "unknown";
        if (!byMethod[m]) byMethod[m] = { total: 0, count: 0 };
        const acc = Math.max(0, 100 - Math.abs((f.predictedQuantity - (f.actualQuantity ?? 0)) / f.predictedQuantity) * 100);
        byMethod[m].total += acc;
        byMethod[m].count += 1;
      }

      const byMethodAvg: Record<string, number> = {};
      for (const [m, v] of Object.entries(byMethod)) {
        byMethodAvg[m] = v.count > 0 ? parseFloat((v.total / v.count).toFixed(1)) : 0;
      }

      const overallArr = withActual.map(f =>
        Math.max(0, 100 - Math.abs((f.predictedQuantity - (f.actualQuantity ?? 0)) / f.predictedQuantity) * 100)
      );
      const overall = overallArr.length > 0
        ? parseFloat((overallArr.reduce((a, b) => a + b, 0) / overallArr.length).toFixed(1))
        : null;

      return {
        overallAccuracy: overall,
        byMethod: byMethodAvg,
        totalForecasts: all.length,
        forecastsWithActual: withActual.length,
      };
    }),
});
