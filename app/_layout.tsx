import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/store/useAuthStore";
import { ThemeProvider, useTheme } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, loading, session } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    initialize().then(() => SplashScreen.hideAsync());

    // Handle notification taps — navigate to the route specified in data
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const route = response.notification.request.content.data?.route;
      if (route) {
        router.push(route as any);
      }
    });
    return () => sub.remove();
  }, []);

  // Auth + onboarding redirect
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "auth";
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inAuth) {
      router.replace("/auth");
    } else if (session && inAuth) {
      // Check onboarding status
      checkOnboarding();
    } else if (session && !inAuth && !inOnboarding && !onboardingChecked) {
      checkOnboarding();
    }
  }, [session, loading, segments]);

  const checkOnboarding = async () => {
    if (onboardingChecked) return;
    const { data } = await supabase
      .from("user_settings")
      .select("onboarding_complete")
      .eq("user_id", session?.user?.id)
      .single();

    setOnboardingChecked(true);
    if (!data?.onboarding_complete) {
      router.replace("/onboarding");
    } else {
      if (segments[0] === "auth") {
        router.replace("/(tabs)");
      }
    }
  };

  if (loading) return null;

  return (
    <ThemeProvider>
      <StatusBarWrapper />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="chat" options={{ presentation: "modal" }} />
        <Stack.Screen name="scan" options={{ presentation: "fullScreenModal" }} />
        <Stack.Screen name="tasks" options={{ presentation: "card" }} />
        <Stack.Screen name="journal" options={{ presentation: "card" }} />
        <Stack.Screen name="progress" options={{ presentation: "card" }} />
        <Stack.Screen name="friends" options={{ presentation: "card" }} />
        <Stack.Screen name="challenges" options={{ presentation: "card" }} />
        <Stack.Screen name="world" options={{ presentation: "card" }} />
        <Stack.Screen name="recap" options={{ presentation: "card" }} />
        <Stack.Screen name="onboarding" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="food-search" options={{ presentation: "card" }} />
        <Stack.Screen name="leaderboard" options={{ presentation: "card" }} />
        <Stack.Screen name="feed" options={{ presentation: "card" }} />
        <Stack.Screen name="character" options={{ presentation: "card" }} />
        <Stack.Screen name="battle" options={{ presentation: "card" }} />
        <Stack.Screen name="nutrition-goals" options={{ presentation: "card" }} />
        <Stack.Screen name="profile" options={{ presentation: "card" }} />
        <Stack.Screen name="measurements" options={{ presentation: "card" }} />
        <Stack.Screen name="fasting" options={{ presentation: "card" }} />
        <Stack.Screen name="mood" options={{ presentation: "card" }} />
        <Stack.Screen name="streak-calendar" options={{ presentation: "card" }} />
        <Stack.Screen name="export-data" options={{ presentation: "card" }} />
        <Stack.Screen name="meal-plan" options={{ presentation: "card" }} />
        <Stack.Screen name="compare-photos" options={{ presentation: "card" }} />
        <Stack.Screen name="exercises" options={{ presentation: "card" }} />
        <Stack.Screen name="voice" options={{ presentation: "card" }} />
        <Stack.Screen name="achievements" options={{ presentation: "card" }} />
        <Stack.Screen name="battle-active" options={{ presentation: "card" }} />
        <Stack.Screen name="battle-friend" options={{ presentation: "card" }} />
        <Stack.Screen name="bmi-detail" options={{ presentation: "card" }} />
        <Stack.Screen name="change-name" options={{ presentation: "card" }} />
        <Stack.Screen name="create-meal" options={{ presentation: "card" }} />
        <Stack.Screen name="daily-breakdown" options={{ presentation: "card" }} />
        <Stack.Screen name="fix-result" options={{ presentation: "card" }} />
        <Stack.Screen name="gym" options={{ presentation: "card" }} />
        <Stack.Screen name="invite" options={{ presentation: "card" }} />
        <Stack.Screen name="items" options={{ presentation: "card" }} />
        <Stack.Screen name="log-food" options={{ presentation: "card" }} />
        <Stack.Screen name="personal-details" options={{ presentation: "card" }} />
        <Stack.Screen name="reset-password" options={{ presentation: "card" }} />
        <Stack.Screen name="skills" options={{ presentation: "card" }} />
        <Stack.Screen name="story" options={{ presentation: "card" }} />
        <Stack.Screen name="weight-history" options={{ presentation: "card" }} />
        <Stack.Screen name="world-map" options={{ presentation: "card" }} />
      </Stack>
    </ThemeProvider>
  );
}

function StatusBarWrapper() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}
