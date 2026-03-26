import axios, { AxiosInstance } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../store/authStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

class ApiClient {
  private client: AxiosInstance;
  private requestQueue: Array<() => Promise<any>> = [];
  private isOnline: boolean = true;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 10000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired
          await useAuthStore.getState().logout();
        }
        return Promise.reject(error);
      }
    );
  }

  async getInventory(params?: any) {
    try {
      const response = await this.client.get("/inventory/list", { params });
      return response.data;
    } catch (error) {
      if (!this.isOnline) {
        return this.getCachedInventory();
      }
      throw error;
    }
  }

  async logStock(supplyId: number, quantity: number, notes?: string) {
    const payload = {
      supplyId,
      quantity,
      notes,
      timestamp: new Date().toISOString(),
    };

    try {
      const response = await this.client.post("/inventory/log", payload);
      // Clear from sync queue if successful
      await this.removeSyncQueueItem(payload);
      return response.data;
    } catch (error) {
      if (!this.isOnline) {
        // Add to sync queue for later
        await this.addToSyncQueue(payload);
        return { success: true, queued: true };
      }
      throw error;
    }
  }

  async getNotifications(params?: any) {
    try {
      const response = await this.client.get("/notifications/list", { params });
      return response.data;
    } catch (error) {
      if (!this.isOnline) {
        return this.getCachedNotifications();
      }
      throw error;
    }
  }

  async markNotificationAsRead(notificationId: number) {
    try {
      const response = await this.client.put(
        `/notifications/${notificationId}/read`
      );
      return response.data;
    } catch (error) {
      // Offline: queue for later
      if (!this.isOnline) {
        await this.addToSyncQueue({
          action: "markNotificationRead",
          notificationId,
        });
        return { success: true, queued: true };
      }
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await this.client.get("/auth/me");
      return response.data;
    } catch (error) {
      if (!this.isOnline) {
        return this.getCachedProfile();
      }
      throw error;
    }
  }

  // Offline sync queue management
  private async addToSyncQueue(item: any) {
    try {
      const queue = await AsyncStorage.getItem("sync_queue");
      const items = queue ? JSON.parse(queue) : [];
      items.push({ ...item, queuedAt: new Date().toISOString() });
      await AsyncStorage.setItem("sync_queue", JSON.stringify(items));
    } catch (error) {
      console.error("Failed to add to sync queue:", error);
    }
  }

  private async removeSyncQueueItem(item: any) {
    try {
      const queue = await AsyncStorage.getItem("sync_queue");
      if (!queue) return;
      const items = JSON.parse(queue).filter(
        (q: any) => JSON.stringify(q) !== JSON.stringify(item)
      );
      await AsyncStorage.setItem("sync_queue", JSON.stringify(items));
    } catch (error) {
      console.error("Failed to remove from sync queue:", error);
    }
  }

  async syncOfflineData() {
    try {
      const queue = await AsyncStorage.getItem("sync_queue");
      if (!queue) return;

      const items = JSON.parse(queue);
      const results = [];

      for (const item of items) {
        try {
          if (item.action === "logStock") {
            await this.logStock(item.supplyId, item.quantity, item.notes);
          } else if (item.action === "markNotificationRead") {
            await this.markNotificationAsRead(item.notificationId);
          }
          results.push({ ...item, synced: true });
        } catch (error) {
          console.error("Failed to sync item:", error);
          results.push({ ...item, synced: false });
        }
      }

      // Clear successfully synced items
      const failedItems = results.filter((r) => !r.synced);
      if (failedItems.length === 0) {
        await AsyncStorage.removeItem("sync_queue");
      } else {
        await AsyncStorage.setItem("sync_queue", JSON.stringify(failedItems));
      }

      return results;
    } catch (error) {
      console.error("Sync failed:", error);
    }
  }

  // Caching methods
  private async getCachedInventory() {
    try {
      const cached = await AsyncStorage.getItem("cached_inventory");
      return cached ? JSON.parse(cached) : { items: [] };
    } catch {
      return { items: [] };
    }
  }

  private async getCachedNotifications() {
    try {
      const cached = await AsyncStorage.getItem("cached_notifications");
      return cached ? JSON.parse(cached) : { notifications: [] };
    } catch {
      return { notifications: [] };
    }
  }

  private async getCachedProfile() {
    try {
      const cached = await AsyncStorage.getItem("cached_profile");
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  setOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    if (isOnline) {
      this.syncOfflineData();
    }
  }
}

export const apiClient = new ApiClient();
