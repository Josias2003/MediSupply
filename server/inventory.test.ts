import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createMockContext(role: string = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "email",
      role: role as "admin" | "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Inventory Operations", () => {
  it("should create a medical supply", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inventory.create({
      code: "MED-001",
      name: "Paracetamol",
      description: "Pain reliever",
      category: "Analgesic",
      unit: "tablets",
      reorderPoint: 100,
      currentStock: 500,
    });

    expect(result).toBeDefined();
    expect(result.code).toBe("MED-001");
  });

  it("should list inventory items", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inventory.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should log inventory usage", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inventory.logUsage({
      supplyId: 1,
      quantity: 10,
      notes: "Used for patient treatment",
    });

    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  it("should get low stock items", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inventory.getLowStock();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get expiry warnings", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.inventory.getExpiryWarnings();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should search inventory items", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.search.inventory({
      query: "Paracetamol",
      category: "Analgesic",
    });

    expect(result).toBeDefined();
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("should prevent non-admin from creating supplies", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.inventory.create({
        code: "MED-002",
        name: "Aspirin",
        description: "Pain reliever",
        category: "Analgesic",
        unit: "tablets",
        reorderPoint: 50,
        currentStock: 200,
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
