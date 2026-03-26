import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/_core/hooks/useAuth";

interface UseWebSocketOptions {
  channels?: Array<"inventory" | "notifications" | "orders">;
  onInventoryUpdate?: (data: any) => void;
  onNotification?: (data: any) => void;
  onOrderUpdate?: (data: any) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const { channels = [], onInventoryUpdate, onNotification, onOrderUpdate } = options;

  useEffect(() => {
    if (!user) return;

    // Initialize socket connection
    const socket = io(window.location.origin, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[WebSocket] Connected");
      // Authenticate user
      socket.emit("user:join", {
        userId: user.id,
        role: user.role,
      });

      // Subscribe to requested channels
      if (channels.includes("inventory")) {
        socket.emit("subscribe:inventory");
      }
      if (channels.includes("notifications")) {
        socket.emit("subscribe:notifications");
      }
      if (channels.includes("orders")) {
        socket.emit("subscribe:orders");
      }
    });

    socket.on("inventory:update", (data) => {
      console.log("[WebSocket] Inventory update:", data);
      onInventoryUpdate?.(data);
    });

    socket.on("notification:new", (data) => {
      console.log("[WebSocket] New notification:", data);
      onNotification?.(data);
    });

    socket.on("order:update", (data) => {
      console.log("[WebSocket] Order update:", data);
      onOrderUpdate?.(data);
    });

    socket.on("disconnect", () => {
      console.log("[WebSocket] Disconnected");
    });

    socket.on("error", (error) => {
      console.error("[WebSocket] Error:", error);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, channels, onInventoryUpdate, onNotification, onOrderUpdate]);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return {
    socket: socketRef.current,
    emit,
    isConnected: socketRef.current?.connected ?? false,
  };
}
