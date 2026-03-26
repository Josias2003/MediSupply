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

describe("Procurement Workflow", () => {
  it("should create a purchase requisition", async () => {
    const ctx = createMockContext("procurement_officer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.requisitions.create({
      supplyId: 1,
      quantity: 100,
      urgency: "normal",
      justification: "Stock replenishment",
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("pending");
  });

  it("should list purchase requisitions", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.requisitions.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should approve a requisition as admin", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.requisitions.approve({
      requisitionId: 1,
      notes: "Approved",
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("approved");
  });

  it("should generate purchase order from requisition", async () => {
    const ctx = createMockContext("procurement_officer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.purchaseOrders.create({
      requisitionId: 1,
      supplierId: 1,
      expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("pending");
  });

  it("should list purchase orders", async () => {
    const ctx = createMockContext("admin");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.purchaseOrders.list();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("should update order status", async () => {
    const ctx = createMockContext("procurement_officer");
    const caller = appRouter.createCaller(ctx);

    const result = await caller.purchaseOrders.updateStatus({
      orderId: 1,
      status: "delivered",
    });

    expect(result).toBeDefined();
    expect(result.status).toBe("delivered");
  });
});
