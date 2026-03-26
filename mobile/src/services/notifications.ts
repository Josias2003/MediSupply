import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function initializeNotifications() {
  if (!Device.isDevice) {
    console.log("Must use physical device for push notifications");
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push notification permissions");
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log("Expo push token:", token.data);
    return token.data;
  } catch (error) {
    console.error("Failed to get push token:", error);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: "default",
      badge: 1,
    },
    trigger: { seconds: 1 },
  });
}

export function setupNotificationListeners(
  onNotification?: (notification: Notifications.Notification) => void
) {
  // Listen for notifications when app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("Notification received:", notification);
      onNotification?.(notification);
    }
  );

  // Listen for notification responses (when user taps notification)
  const responseSubscription =
    Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("Notification response:", response);
      const { notification } = response;
      const { data } = notification.request.content;

      // Handle navigation based on notification type
      if (data.type === "low_stock") {
        // Navigate to inventory screen
      } else if (data.type === "order_update") {
        // Navigate to orders screen
      }
    });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}
