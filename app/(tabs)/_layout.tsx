import { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Text, View, Pressable } from "react-native";
import { useColors } from "@/lib/ThemeContext";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getSettings } from "@/lib/supabase/queries";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const NAV_META: Record<string, { label: string; icon: ArcIconName }> = {
  workout: { label: "Workout", icon: "workout" },
  tasks: { label: "Tasks", icon: "checkSquare" },
  friends: { label: "Friends", icon: "users" },
  finance: { label: "Finance", icon: "dollar" },
  recap: { label: "Recap", icon: "recap" },
  world: { label: "World", icon: "swords" },
  journal: { label: "Journal", icon: "book" },
};

export default function TabLayout() {
  const router = useRouter();
  const colors = useColors();
  const [navConfig, setNavConfig] = useState<string[]>(["workout", "tasks", "finance"]);

  useEffect(() => {
    getSettings().then((s: any) => {
      const nav = s?.navConfig;
      if (nav && Array.isArray(nav) && nav.length === 3) {
        setNavConfig(nav);
      }
    }).catch(() => {});
  }, []);

  const isVisible = (key: string) => navConfig.includes(key);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "rgba(255,255,255,0.92)",
          borderTopColor: "rgba(0,0,0,0.06)",
          borderTopWidth: 1,
          height: 90,
          paddingBottom: 30,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#111118",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => <ArcIcon name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "Workout",
          tabBarIcon: ({ color }) => <ArcIcon name="workout" size={24} color={color} />,
          href: isVisible("workout") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color }) => <ArcIcon name="checkSquare" size={24} color={color} />,
          href: isVisible("tasks") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: "",
          tabBarButton: () => (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingBottom: 22 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/chat"); }}
                style={{ width: 40, height: 54, borderRadius: 14, borderTopRightRadius: 6, borderBottomRightRadius: 6, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["#667eea", "#764ba2"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <ArcIcon name="chatBubble" size={18} color="white" />
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/voice" as any); }}
                style={{ width: 40, height: 54, borderRadius: 14, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, overflow: "hidden" }}
              >
                <LinearGradient
                  colors={["#764ba2", "#667eea"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                >
                  <ArcIcon name="mic" size={18} color="white" />
                </LinearGradient>
              </Pressable>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: "Finance",
          tabBarIcon: ({ color }) => <ArcIcon name="dollar" size={24} color={color} />,
          href: isVisible("finance") ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <ArcIcon name="settings" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
