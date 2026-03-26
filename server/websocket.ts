import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { getDb } from "./db";
import { eq } from "drizzle-orm";
import { notifications, medicalSupplies, purchaseOrders } from "../drizzle/schema";

export interface SocketUser {
  userId: number;
  role: string;
  socketId: string;
}

const connectedUsers = new Map<string, SocketUser>();

export function initializeWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[WebSocket] User connected: ${socket.id}`);

    // User joins with authentication
    socket.on("user:join", (data: { userId: number; role: string }) => {
      const user: SocketUser = {
        userId: data.userId,
        role: data.role,
        socketId: socket.id,
      };
      connectedUsers.set(socket.id, user);
      socket.join(`user:${data.userId}`);
      socket.join(`role:${data.role}`);
      console.log(`[WebSocket] User ${data.userId} joined as ${data.role}`);
    });

    // Subscribe to inventory updates
    socket.on("subscribe:inventory", () => {
      socket.join("inventory:updates");
      socket.emit("message", { type: "subscribed", channel: "inventory" });
    });

    // Subscribe to notifications
    socket.on("subscribe:notifications", () => {
      socket.join("notifications:updates");
      socket.emit("message", { type: "subscribed", channel: "notifications" });
    });

    // Subscribe to order updates
    socket.on("subscribe:orders", () => {
      socket.join("orders:updates");
      socket.emit("message", { type: "subscribed", channel: "orders" });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      connectedUsers.delete(socket.id);
      console.log(`[WebSocket] User disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`[WebSocket] Socket error:`, error);
    });
  });

  return io;
}

/**
 * Broadcast inventory update to all connected users
 */
export async function broadcastInventoryUpdate(
  io: SocketIOServer,
  supplyId: number,
  updateType: "stock_changed" | "expiry_warning" | "low_stock" | "reordered"
) {
  const db = await getDb();
  if (!db) return;

  try {
    const supply = await db
      .select()
      .from(medicalSupplies)
      .where(eq(medicalSupplies.id, supplyId))
      .limit(1);

    if (supply.length > 0) {
      io.to("inventory:updates").emit("inventory:update", {
        type: updateType,
        supply: supply[0],
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error("[WebSocket] Error broadcasting inventory update:", error);
  }
}

/**
 * Send notification to specific user
 */
export async function sendNotificationToUser(
  io: SocketIOServer,
  userId: number,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }
) {
  io.to(`user:${userId}`).emit("notification:new", {
    ...notification,
    timestamp: new Date(),
  });
}

/**
 * Broadcast notification to role
 */
export async function broadcastNotificationToRole(
  io: SocketIOServer,
  role: string,
  notification: {
    type: string;
    title: string;
    message: string;
    data?: Record<string, any>;
  }
) {
  io.to(`role:${role}`).emit("notification:new", {
    ...notification,
    timestamp: new Date(),
  });
}

/**
 * Broadcast order status update
 */
export async function broadcastOrderUpdate(
  io: SocketIOServer,
  orderId: number,
  status: string
) {
  const db = await getDb();
  if (!db) return;

  try {
    const order = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, orderId))
      .limit(1);

    if (order.length > 0) {
      io.to("orders:updates").emit("order:update", {
        orderId,
        status,
        order: order[0],
        timestamp: new Date(),
      });
    }
  } catch (error) {
    console.error("[WebSocket] Error broadcasting order update:", error);
  }
}

/**
 * Get connected users count
 */
export function getConnectedUsersCount(): number {
  return connectedUsers.size;
}

/**
 * Get connected users by role
 */
export function getConnectedUsersByRole(role: string): SocketUser[] {
  return Array.from(connectedUsers.values()).filter((user) => user.role === role);
}
