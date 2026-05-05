import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "./supabase/client";

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("No EAS projectId found, skipping push token registration");
    return null;
  }
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;

  // iOS specific channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  // Save token to Supabase for server-side push
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("push_tokens").upsert({
      user_id: user.id,
      token,
      platform: Platform.OS,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
  }

  return token;
}

export async function scheduleDailyReminder(hour: number = 20, minute: number = 0) {
  // Cancel existing daily reminders
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Log your day",
      body: "Don't forget to track your meals and workouts!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function scheduleStreakReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Keep your streak alive! 🔥",
      body: "You haven't logged anything today. Don't break the chain!",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 21,
      minute: 0,
    },
  });
}

export async function scheduleWaterReminders(intervalHours: number = 2, startHour: number = 8, endHour: number = 20) {
  // Cancel existing water reminders first
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.type === "water_reminder") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  const messages = [
    "Time to hydrate! 💧",
    "Drink some water! 🥤",
    "Stay hydrated! 💦",
    "Water break! 💧",
  ];

  for (let hour = startHour; hour <= endHour; hour += intervalHours) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Water Reminder",
        body: messages[Math.floor(Math.random() * messages.length)],
        sound: true,
        data: { type: "water_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  }
}

export async function cancelWaterReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content.data?.type === "water_reminder") {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}
