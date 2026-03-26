import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: string = "admin"): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "hashed",
    role: role as any,
    supplierId: null,
    isActive: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: any) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("Authentication", () => {
  it("should return current user from me query", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const user = await caller.auth.me();

    expect(user).toBeDefined();
    expect(user?.email).toBe("test@example.com");
    expect(user?.role).toBe("admin");
  });

  it("should logout and clear session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options.maxAge).toBe(-1);
  });
});

describe("Role-Based Access Control", () => {
  it("should allow admin to access admin procedures", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const users = await caller.users.list();
    expect(Array.isArray(users)).toBe(true);
  });

  it("should deny non-admin from accessing admin procedures", async () => {
    const { ctx } = createAuthContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.users.list();
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });

  it("should allow pharmacist to access inventory procedures", async () => {
    const { ctx } = createAuthContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    const inventory = await caller.inventory.list();
    expect(Array.isArray(inventory)).toBe(true);
  });

  it("should allow procurement officer to access procurement procedures", async () => {
    const { ctx } = createAuthContext("procurement_officer");
    const caller = appRouter.createCaller(ctx);

    const requisitions = await caller.requisitions.list();
    expect(Array.isArray(requisitions)).toBe(true);
  });

  it("should allow accountant to access financial procedures", async () => {
    const { ctx } = createAuthContext("accountant");
    const caller = appRouter.createCaller(ctx);

    const invoices = await caller.invoices.list();
    expect(Array.isArray(invoices)).toBe(true);
  });
});

describe("Dashboard Statistics", () => {
  it("should return dashboard stats for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.dashboard.stats();

    expect(stats).toBeDefined();
    expect(stats?.lowStockCount).toBeGreaterThanOrEqual(0);
    expect(stats?.pendingOrders).toBeGreaterThanOrEqual(0);
    expect(stats?.pendingApprovals).toBeGreaterThanOrEqual(0);
    expect(stats?.totalSuppliers).toBeGreaterThanOrEqual(0);
  });
});

describe("Audit Logging", () => {
  it("should allow admin to view audit logs", async () => {
    const { ctx } = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);

    const logs = await caller.auditLogs.list({ limit: 10 });
    expect(Array.isArray(logs)).toBe(true);
  });

  it("should deny non-admin from viewing audit logs", async () => {
    const { ctx } = createAuthContext("pharmacist");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auditLogs.list({ limit: 10 });
      expect.fail("Should have thrown FORBIDDEN error");
    } catch (error: any) {
      expect(error.code).toBe("FORBIDDEN");
    }
  });
});

describe("Notifications", () => {
  it("should return notifications for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.notifications.list();
    expect(Array.isArray(notifications)).toBe(true);
  });
});
