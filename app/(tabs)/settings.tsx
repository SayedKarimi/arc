import { View, Text, ScrollView, Pressable, StyleSheet, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/useAuthStore";
import { useColors, useTheme } from "@/lib/ThemeContext";
import { useEffect, useState, useMemo } from "react";
import { getSettings, updateSettings } from "@/lib/supabase/queries";
import { scheduleWaterReminders, cancelWaterReminders } from "@/lib/notifications";
import * as Haptics from "expo-haptics";
import { Share } from "react-native";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const DARK = "#1C1C1E";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";
const BORDER = "#E5E5EA";

const ALL_MODULES_WITH_ROUTES: { key: string; label: string; icon: ArcIconName; href: string }[] = [
  { key: "workout", label: "Workout", icon: "workout", href: "/(tabs)/workout" },
  { key: "tasks", label: "Tasks", icon: "checkSquare", href: "/tasks" },
  { key: "friends", label: "Friends", icon: "users", href: "/friends" },
  { key: "finance", label: "Finance", icon: "dollar", href: "/(tabs)/finance" },
  { key: "recap", label: "Recap", icon: "recap", href: "/recap" },
  { key: "world", label: "World", icon: "swords", href: "/world" },
  { key: "journal", label: "Journal", icon: "book", href: "/journal" },
  { key: "scan", label: "Scan Food", icon: "camera", href: "/scan" },
  { key: "chat", label: "AI Chat", icon: "chatBubble", href: "/chat" },
];

const ALL_NAV_MODULES: { key: string; label: string; icon: ArcIconName }[] = [
  { key: "workout", label: "Workout", icon: "workout" },
  { key: "tasks", label: "Tasks", icon: "checkSquare" },
  { key: "friends", label: "Friends", icon: "users" },
  { key: "finance", label: "Finance", icon: "dollar" },
  { key: "recap", label: "Recap", icon: "recap" },
  { key: "world", label: "World", icon: "swords" },
  { key: "journal", label: "Journal", icon: "book" },
];

const DIET_TYPES = ["Halal", "Kosher", "Pescatarian", "Vegetarian", "Vegan"];
const PROTEIN_OPTS = ["Chicken", "Beef", "Fish", "Pork", "Plant-based"];

const MENU_ROWS: { icon: ArcIconName; label: string; href: string }[] = [
  { icon: "card", label: "Personal details", href: "/personal-details" },
  { icon: "target", label: "Edit nutrition goals", href: "/nutrition-goals" },
  { icon: "flag", label: "Goals & current weight", href: "/personal-details" },
  { icon: "stopwatch", label: "Weight history", href: "/weight-history" },
  { icon: "barchart", label: "BMI Details", href: "/bmi-detail" },
  { icon: "edit", label: "Change name", href: "/change-name" },
];

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={{ width: 52, height: 28, borderRadius: 14, backgroundColor: value ? DARK : "#E5E5EA", justifyContent: "center", paddingHorizontal: 3 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "white", alignSelf: value ? "flex-end" : "flex-start", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.25, shadowRadius: 3 }} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const colors = useColors();
  const { mode, setMode } = useTheme();
  const { signOut, user } = useAuthStore();
  const [settings, setSettings] = useState<any>({});
  const [addBurnedCals, setAddBurnedCals] = useState(false);
  const [rolloverCals, setRolloverCals] = useState(false);
  const [autoAdjustMacros, setAutoAdjustMacros] = useState(false);
  const [waterReminders, setWaterReminders] = useState(false);

  // Dietary preferences
  const [dietType, setDietType] = useState<string[]>([]);
  const [dietProtein, setDietProtein] = useState<string[]>([]);
  const [savingDiet, setSavingDiet] = useState(false);
  const [dietSaved, setDietSaved] = useState(false);

  // Nav config
  const [pendingNav, setPendingNav] = useState<string[]>(["workout", "tasks", "finance"]);
  const [savingNav, setSavingNav] = useState(false);

  useEffect(() => {
    getSettings().then((s: any) => {
      setSettings(s);
      const validKeys = new Set(ALL_NAV_MODULES.map(m => m.key));
      const nav = (s?.navConfig || []).filter((k: string) => validKeys.has(k)).slice(0, 3);
      setPendingNav(nav.length > 0 ? nav : ["workout", "tasks", "finance"]);
      const dp = s?.dietaryPreferences || {};
      setDietType(dp.type || []);
      setDietProtein(dp.protein || []);
      setAddBurnedCals(!!s?.addBurnedCals);
      setRolloverCals(!!s?.rolloverCals);
      setAutoAdjustMacros(!!s?.autoAdjustMacros);
      if (s?.notification_prefs?.water_reminders) setWaterReminders(true);
    });
  }, []);

  const displayName = settings?.name && settings.name !== "You" ? settings.name : user?.email?.split("@")[0] || "";
  const initial = displayName ? displayName[0].toUpperCase() : "?";
  const age = settings?.age || null;

  const handleLogout = () => {
    Alert.alert("Log out?", "Log out of your account?", [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert("Delete Account?", "Are you sure you want to permanently delete your account?", [
      { text: "No", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: () => Alert.alert("Coming soon") },
    ]);
  };

  const togglePendingNav = (key: string) => {
    setPendingNav(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key);
      if (prev.length < 3) return [...prev, key];
      return [...prev.slice(0, 2), key];
    });
  };

  const applyNav = async () => {
    if (pendingNav.length !== 3) return;
    setSavingNav(true);
    await updateSettings({ navConfig: pendingNav } as any);
    setSavingNav(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const saveDietaryPrefs = async () => {
    setSavingDiet(true);
    await updateSettings({ dietaryPreferences: { type: dietType, protein: dietProtein } } as any);
    setDietSaved(true);
    setTimeout(() => setDietSaved(false), 2000);
    setSavingDiet(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const shareApp = async () => {
    try {
      await Share.share({ message: "Track your health, nutrition & workouts in one app - Arc", url: "https://lifeos-iota-wine.vercel.app" });
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        {/* Title */}
        <Text style={{ fontSize: 32, fontWeight: "900", color: DARK, paddingTop: 8, marginBottom: 20 }}>Settings</Text>

        {/* Profile card */}
        <Pressable onPress={() => router.push("/profile" as any)} style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 20, fontWeight: "700", color: DARK }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: DARK }}>{displayName || "Enter your name"}</Text>
              {age && <Text style={{ fontSize: 14, color: SUBTITLE, marginTop: 2 }}>{age} years old</Text>}
            </View>
          </View>
        </Pressable>

        {/* All Modules */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BG }}>
            <ArcIcon name="compass" size={20} color={DARK} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>All Modules</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ALL_MODULES_WITH_ROUTES.map(m => (
              <Pressable key={m.key} onPress={() => router.push(m.href as any)} style={styles.moduleBtn}>
                <ArcIcon name={m.icon} size={24} color={DARK} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: DARK }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Invite Friends */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ArcIcon name="users" size={20} color={DARK} />
            <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>Invite friends</Text>
          </View>
          <View style={{ backgroundColor: DARK, borderRadius: 16, padding: 20, alignItems: "center", gap: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "white", textAlign: "center" }}>The journey is easier together</Text>
            <Pressable onPress={shareApp} style={{ backgroundColor: "white", borderRadius: 99, paddingHorizontal: 20, paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: DARK }}>Share Arc →</Text>
            </Pressable>
          </View>
        </View>

        {/* Navigation menu */}
        <View style={styles.card}>
          {MENU_ROWS.map((item, i) => (
            <Pressable key={item.label} onPress={() => router.push(item.href as any)} style={[styles.menuRow, i > 0 && { borderTopWidth: 1, borderTopColor: BG, marginLeft: 52 }]}>
              <View style={{ width: 24, alignItems: "center" }}>
                <ArcIcon name={item.icon} size={20} color={DARK} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, color: DARK }}>{item.label}</Text>
              <ArcIcon name="chevronRight" size={16} color="#C7C7CC" />
            </Pressable>
          ))}
        </View>

        {/* Preferences */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BORDER }}>
            <ArcIcon name="settings" size={20} color={DARK} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Preferences</Text>
          </View>

          {/* Appearance */}
          <View style={styles.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: DARK }}>Appearance</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Choose light, dark, or system appearance</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {(["light", "auto", "dark"] as const).map(m => (
                <Pressable key={m} onPress={() => setMode(m)} style={[styles.appearBtn, mode === m && styles.appearBtnActive]}>
                  <ArcIcon name={m === "light" ? "sun" : m === "dark" ? "moon" : "autoTheme"} size={14} color={mode === m ? "white" : DARK} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* Add burned calories */}
          <View style={styles.prefRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: DARK }}>Add burned calories</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Add burned calories back to daily goal</Text>
            </View>
            <Toggle value={addBurnedCals} onToggle={() => { const v = !addBurnedCals; setAddBurnedCals(v); updateSettings({ addBurnedCals: v } as any); }} />
          </View>

          {/* Rollover calories */}
          <View style={styles.prefRow}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: DARK }}>Rollover calories</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Add up to 200 leftover calories from yesterday</Text>
            </View>
            <Toggle value={rolloverCals} onToggle={() => { const v = !rolloverCals; setRolloverCals(v); updateSettings({ rolloverCals: v } as any); }} />
          </View>

          {/* Auto adjust macros */}
          <View style={[styles.prefRow, { borderBottomWidth: 0 }]}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: DARK }}>Auto adjust macros</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Adjust proportionally when editing</Text>
            </View>
            <Toggle value={autoAdjustMacros} onToggle={() => { const v = !autoAdjustMacros; setAutoAdjustMacros(v); updateSettings({ autoAdjustMacros: v } as any); }} />
          </View>
        </View>

        {/* Dietary Preferences */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BG }}>
            <ArcIcon name="food" size={20} color={DARK} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Dietary Preferences</Text>
          </View>
          <View style={{ paddingTop: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Diet Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <Pressable onPress={() => setDietType([])} style={[styles.dietPill, dietType.length === 0 && styles.dietPillActive]}>
                <Text style={[styles.dietPillText, dietType.length === 0 && styles.dietPillTextActive]}>None</Text>
              </Pressable>
              {DIET_TYPES.map(t => (
                <Pressable key={t} onPress={() => setDietType(prev => prev.includes(t) ? prev.filter(v => v !== t) : [...prev, t])} style={[styles.dietPill, dietType.includes(t) && styles.dietPillActive]}>
                  <Text style={[styles.dietPillText, dietType.includes(t) && styles.dietPillTextActive]}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>Protein Preferences</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {PROTEIN_OPTS.map(p => (
                <Pressable key={p} onPress={() => setDietProtein(prev => prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p])} style={[styles.dietPill, dietProtein.includes(p) && styles.dietPillActive]}>
                  <Text style={[styles.dietPillText, dietProtein.includes(p) && styles.dietPillTextActive]}>{p}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={saveDietaryPrefs} disabled={savingDiet || dietSaved} style={[styles.saveBtn, dietSaved && { backgroundColor: "#34C759" }]}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>{dietSaved ? "Saved ✓" : savingDiet ? "Saving..." : "Save Preferences"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Bottom Nav Customizer */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: BG }}>
            <ArcIcon name="compass" size={20} color={DARK} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Bottom Nav</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Home + Mic locked. Pick your 3 slots ({pendingNav.length}/3)</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, paddingTop: 16 }}>
            {ALL_NAV_MODULES.map(m => {
              const isActive = pendingNav.includes(m.key);
              const order = pendingNav.indexOf(m.key);
              return (
                <Pressable key={m.key} onPress={() => togglePendingNav(m.key)} style={[styles.navSlotBtn, isActive && { backgroundColor: DARK, borderColor: DARK }]}>
                  {isActive && <Text style={{ position: "absolute", top: 6, right: 8, fontSize: 9, fontWeight: "800", color: "rgba(255,255,255,0.7)" }}>{order + 1}</Text>}
                  <ArcIcon name={m.icon} size={24} color={isActive ? "white" : DARK} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? "white" : DARK }}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={applyNav} disabled={savingNav || pendingNav.length !== 3} style={[styles.saveBtn, { marginTop: 16 }, pendingNav.length !== 3 && { backgroundColor: "#C7C7CC" }]}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
              {savingNav ? "Applying..." : pendingNav.length < 3 ? `Pick ${3 - pendingNav.length} more` : "Apply Changes"}
            </Text>
          </Pressable>
        </View>

        {/* Water reminders */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "500", color: DARK }}>Water reminders (every 2h)</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Get reminded to stay hydrated</Text>
            </View>
            <Toggle value={waterReminders} onToggle={() => {
              const v = !waterReminders;
              setWaterReminders(v);
              if (v) scheduleWaterReminders(); else cancelWaterReminders();
              updateSettings({ notification_prefs: { ...settings?.notification_prefs, water_reminders: v } });
            }} />
          </View>
        </View>

        {/* Re-run Onboarding */}
        <Pressable style={styles.card} onPress={() => router.push("/onboarding" as any)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <ArcIcon name="refresh" size={20} color={DARK} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: DARK }}>Re-run Onboarding</Text>
              <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>Preview the welcome flow without resetting your data</Text>
            </View>
            <ArcIcon name="chevronRight" size={16} color="#C7C7CC" />
          </View>
        </Pressable>

        {/* Delete Account */}
        <Pressable style={styles.card} onPress={handleDeleteAccount}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <ArcIcon name="trash" size={20} color="#E53935" />
            <Text style={{ flex: 1, fontSize: 15, color: "#FF3B30" }}>Delete Account</Text>
            <ArcIcon name="chevronRight" size={16} color="#C7C7CC" />
          </View>
        </Pressable>

        {/* Logout */}
        <Pressable style={[styles.card, { marginTop: 8 }]} onPress={handleLogout}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <ArcIcon name="logout" size={20} color="#E53935" />
            <Text style={{ fontSize: 15, color: DARK }}>Logout</Text>
          </View>
        </Pressable>

        {/* Version */}
        <View style={{ padding: 16, alignItems: "center" }}>
          <Text style={{ fontSize: 11, color: "#C7C7CC" }}>Arc · native</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  moduleBtn: {
    width: "30%",
    backgroundColor: BG,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BG,
  },
  appearBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },
  appearBtnActive: {
    backgroundColor: DARK,
  },
  dietPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: BG,
  },
  dietPillActive: {
    backgroundColor: DARK,
  },
  dietPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: DARK,
  },
  dietPillTextActive: {
    color: "white",
  },
  saveBtn: {
    backgroundColor: DARK,
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  navSlotBtn: {
    width: "30%",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: BG,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    gap: 6,
  },
});
