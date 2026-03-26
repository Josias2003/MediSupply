import { describe, it, expect } from "vitest";
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
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("API Structure Verification", () => {
  it("should have all required routers", () => {
    const router = appRouter._def.procedures;
    
    expect(router).toBeDefined();
    expect(Object.keys(router).length).toBeGreaterThan(0);
  });

  it("should have authentication endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.auth).toBeDefined();
    expect(caller.auth.me).toBeDefined();
    expect(caller.auth.logout).toBeDefined();
  });

  it("should have inventory management endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.inventory).toBeDefined();
    expect(caller.inventory.list).toBeDefined();
    expect(caller.inventory.create).toBeDefined();
  });

  it("should have procurement endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.requisitions).toBeDefined();
    expect(caller.purchaseOrders).toBeDefined();
  });

  it("should have supplier endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.suppliers).toBeDefined();
  });

  it("should have notification endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.notifications).toBeDefined();
    expect(caller.notificationPreferences).toBeDefined();
  });

  it("should have search endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.search).toBeDefined();
    expect(caller.search.inventory).toBeDefined();
    expect(caller.search.suppliers).toBeDefined();
    expect(caller.search.orders).toBeDefined();
  });

  it("should have export endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.export).toBeDefined();
    expect(caller.export.inventory).toBeDefined();
    expect(caller.export.suppliers).toBeDefined();
    expect(caller.export.orders).toBeDefined();
  });

  it("should have audit trail endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.auditLogs).toBeDefined();
    expect(caller.auditLogs.list).toBeDefined();
  });

  it("should have forecasting endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.forecasts).toBeDefined();
  });

  it("should have dashboard endpoints", () => {
    const caller = appRouter.createCaller(createMockContext());
    
    expect(caller.dashboard).toBeDefined();
  });

  it("should enforce admin access on inventory create", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.inventory.create({
        code: "TEST",
        name: "Test",
        description: "Test",
        category: "Test",
        unit: "units",
        reorderPoint: 10,
        currentStock: 100,
      });
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("should enforce procurement access on requisition create", async () => {
    const ctx = createMockContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.requisitions.create({
        supplyId: 1,
        quantity: 100,
        urgency: "normal",
        justification: "Test",
      });
      expect.fail("Should have thrown FORBIDDEN");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});
