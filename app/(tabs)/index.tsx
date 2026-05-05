import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, ActivityIndicator, Dimensions, Modal, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, startOfWeek, addDays } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { useAuthStore } from "@/store/useAuthStore";
import {
  getSettings, getNutritionTotals, getNutritionForDate,
  getHydrationForDate, getStepsForDate, getCurrentStreak, addHydrationEntry,
  addNutritionEntry,
} from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { registerForPushNotifications, scheduleDailyReminder } from "@/lib/notifications";
import { startOfflineSync } from "@/lib/cache";
import { initHealthKit, syncHealthData } from "@/lib/healthkit";
import Svg, { Circle } from "react-native-svg";
import { ArcIcon } from "@/components/ArcIcon";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const todayStr = () => format(new Date(), "yyyy-MM-dd");
const NARROW = ["M", "T", "W", "T", "F", "S", "S"];

function Ring({ pct, size = 80, stroke = 8, color = "#1C1C1E", bg = "#E5E5EA" }: {
  pct: number; size?: number; stroke?: number; color?: string; bg?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(pct, 0), 1) * circ;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </Svg>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [settings, setSettings] = useState<any>({});
  const [calories, setCalories] = useState(0);
  const [macros, setMacros] = useState({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 });
  const [hydration, setHydration] = useState(0);
  const [steps, setSteps] = useState(0);
  const [streak, setStreak] = useState(0);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loggedDates, setLoggedDates] = useState<Set<string>>(new Set());
  const [calMode, setCalMode] = useState<"left" | "eaten">("left");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const [waterPopup, setWaterPopup] = useState(false);
  const [waterUnit, setWaterUnit] = useState<"ml" | "oz">("ml");
  const [customWater, setCustomWater] = useState("");
  const [showCustomWater, setShowCustomWater] = useState(false);
  const [mealSuggestStep, setMealSuggestStep] = useState<null | "pick" | "loading" | "result">(null);
  const [mealSuggestType, setMealSuggestType] = useState("");
  const [mealSuggestion, setMealSuggestion] = useState<{ name: string; description: string; calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [nutrientInfo, setNutrientInfo] = useState(false);
  const carouselRef = useRef<ScrollView>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const loadData = useCallback(async (date = selectedDate) => {
    try {
      const [s, totals, entries, h, st, strk] = await Promise.all([
        getSettings(),
        getNutritionTotals(date),
        getNutritionForDate(date),
        getHydrationForDate(date),
        getStepsForDate(date),
        getCurrentStreak(),
      ]);
      setSettings(s);
      setCalories(totals.calories || 0);
      setMacros({
        protein: totals.protein || 0, carbs: totals.carbs || 0, fat: totals.fat || 0,
        fiber: totals.fiber || 0, sugar: totals.sugar || 0, sodium: totals.sodium || 0,
      });
      setHydration(h);
      setSteps(st);
      setStreak(strk as number);
      setRecentEntries((entries || []).slice(0, 5));

      // Get logged dates for week indicator
      const { data: { user: u } } = await supabase.auth.getUser();
      if (u) {
        const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
        const { data: logged } = await supabase
          .from("nutrition_entries")
          .select("date")
          .eq("user_id", u.id)
          .gte("date", weekStart);
        if (logged) setLoggedDates(new Set(logged.map((l: any) => l.date)));
      }
    } catch (e) {
      console.error("Load error:", e);
    }
    setLoading(false);
    setRefreshing(false);
  }, [selectedDate]);

  useEffect(() => { loadData(selectedDate); }, [selectedDate]);

  useEffect(() => {
    registerForPushNotifications();
    scheduleDailyReminder(20, 0);
    startOfflineSync();
    initHealthKit().then((granted) => { if (granted) syncHealthData(); });
  }, []);

  const onRefresh = () => { setRefreshing(true); loadData(selectedDate); };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const mt = settings?.macro_targets || settings?.macroTargets || {};
  const calGoal = mt.calories || 2000;
  const proteinGoal = mt.protein || 150;
  const carbsGoal = mt.carbs || 200;
  const fatGoal = mt.fat || 70;
  const fiberGoal = mt.fiber || 38;
  const hydrationGoal = settings?.hydration_goal || settings?.hydrationGoal || 2500;
  const stepGoal = settings?.step_goal || settings?.stepGoal || 10000;
  // Burned calories logic
  const burnedCals = Math.round(steps * 0.04);
  const addBurned = settings?.addBurnedCals;
  const adjustedCalGoal = addBurned ? calGoal + burnedCals : calGoal;
  // Rollover logic — up to 200 leftover from yesterday
  const rollover = settings?.rolloverCals ? Math.min(200, Math.max(0, calGoal - calories)) : 0;
  const effectiveCalGoal = adjustedCalGoal + (settings?.rolloverCals && calories === 0 ? 0 : 0); // rollover applied on display
  const calPct = calories / Math.max(adjustedCalGoal, 1);
  const calLeft = Math.max(0, adjustedCalGoal - calories);
  const proteinLeft = Math.max(0, proteinGoal - macros.protein);
  const carbsLeft = Math.max(0, carbsGoal - macros.carbs);
  const fatLeft = Math.max(0, fatGoal - macros.fat);
  const fiberLeft = Math.max(0, fiberGoal - macros.fiber);
  const waterServing = settings?.water_serving_size || settings?.waterServingSize || 250;
  const hydrationL = (hydration / 1000).toFixed(1);
  const stepsK = steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`;

  const heroCalNumber = calMode === "left" ? Math.round(calLeft) : Math.round(calories);
  const heroCalLabel = calMode === "left" ? "Calories left" : "Calories eaten";

  const name = settings?.name && settings.name !== "You" ? settings.name.split(" ")[0] : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isToday = selectedDate === todayStr();

  // Date strip
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const dateStrip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    const dateStr = format(d, "yyyy-MM-dd");
    const today = todayStr();
    return {
      date: dateStr,
      letter: NARROW[i],
      num: format(d, "d"),
      isPast: dateStr < today,
      isToday: dateStr === today,
      isFuture: dateStr > today,
    };
  });

  const addWater = async (amount?: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ml = amount || waterServing;
    await addHydrationEntry(ml);
    setHydration(prev => prev + ml);
    setWaterPopup(false);
    setShowCustomWater(false);
    setCustomWater("");
  };

  const handleMealSuggest = async (type: string) => {
    setMealSuggestType(type);
    setMealSuggestStep("loading");
    try {
      const dietPrefs = settings?.dietaryPreferences || {};
      const prompt = `Suggest a ${type} meal for someone with these preferences: ${dietPrefs.type?.length ? dietPrefs.type.join(", ") : "no restrictions"}, protein preferences: ${dietPrefs.protein?.length ? dietPrefs.protein.join(", ") : "any"}. They need about ${Math.round(calLeft)} more calories, ${Math.round(proteinLeft)}g protein, ${Math.round(carbsLeft)}g carbs, ${Math.round(fatLeft)}g fat remaining today. Give ONE specific meal suggestion. Return JSON: {"name":"...", "description":"...", "calories":..., "protein":..., "carbs":..., "fat":...}`;
      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt }),
      });
      const data = await res.json();
      const text = data.response ?? data.message ?? JSON.stringify(data);
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        setMealSuggestion(JSON.parse(match[0]));
        setMealSuggestStep("result");
      } else {
        setMealSuggestStep(null);
      }
    } catch {
      setMealSuggestStep(null);
    }
  };

  const logSuggestedMeal = async () => {
    if (!mealSuggestion) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await addNutritionEntry({
      id: Math.random().toString(36).slice(2),
      date: selectedDate, timestamp: Date.now(),
      food: mealSuggestion.name, amount: "1 serving",
      meal: mealSuggestType as any,
      calories: mealSuggestion.calories,
      protein: mealSuggestion.protein,
      carbs: mealSuggestion.carbs,
      fat: mealSuggestion.fat,
      fiber: 0, source: "ai",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMealSuggestStep(null);
    setMealSuggestion(null);
    loadData(selectedDate);
  };

  const slideWidth = SCREEN_WIDTH - 28;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        {/* ── Header ── */}
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <Text style={styles.greeting}>
              {greeting}{name ? `, ${name}` : ""}
            </Text>
            {streak > 0 && (
              <Pressable style={styles.streakPill} onPress={() => router.push("/achievements" as any)}>
                <ArcIcon name="flame" size={16} color="#FF6B35" />
                <Text style={styles.streakNum}>{streak}</Text>
              </Pressable>
            )}
          </View>

          {/* Date strip */}
          <View style={styles.dateStrip}>
            {dateStrip.map(({ date, letter, num, isPast, isToday: isDayToday, isFuture }) => {
              const isSelected = date === selectedDate && !isDayToday;
              const hasLog = loggedDates.has(date);
              return (
                <Pressable key={date} onPress={() => setSelectedDate(date)} style={styles.dateItem}>
                  <Text style={[styles.dateLetter, isDayToday && { color: "#FF3B30" }, isFuture && { color: "#C7C7CC" }]}>
                    {letter}
                  </Text>
                  <View style={[
                    styles.dateCircle,
                    isDayToday && { borderWidth: 2, borderColor: "#FF3B30" },
                    isPast && !isSelected && { borderWidth: 1.5, borderColor: "#C7C7CC", borderStyle: "dashed" },
                    isSelected && { backgroundColor: "#1C1C1E" },
                  ]}>
                    <Text style={[
                      styles.dateNum,
                      isSelected && { color: "white" },
                      isFuture && { color: "#C7C7CC" },
                    ]}>{num}</Text>
                  </View>
                  <View style={[styles.dateDot, hasLog && { backgroundColor: "#34C759" }]} />
                </Pressable>
              );
            })}
          </View>

          {/* Sub-nav */}
          <View style={styles.subNav}>
            <View style={[styles.subNavTab, { borderBottomColor: colors.text, borderBottomWidth: 2 }]}>
              <Text style={[styles.subNavText, { color: colors.text }]}>Home</Text>
            </View>
            <Pressable style={styles.subNavTab} onPress={() => router.push("/progress" as any)}>
              <Text style={[styles.subNavText, { color: colors.text2 }]}>Progress</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Carousel ── */}
        <View style={{ paddingTop: 14 }}>
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
              setCarouselIdx(idx);
            }}
            snapToInterval={slideWidth}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: 14 }}
          >
            {/* Slide 1: Calories + Macros */}
            <View style={{ width: slideWidth, paddingRight: 14 }}>
              {/* Calorie card */}
              <Pressable style={styles.calorieCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroNumber}>{heroCalNumber}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Text style={styles.heroLabel}>{heroCalLabel}</Text>
                    {steps > 0 && calMode === "left" && (
                      <View style={styles.burnedBadge}>
                        <ArcIcon name="flame" size={12} color="#34C759" />
                        <Text style={styles.burnedText}>+{Math.round(steps * 0.04)} cal</Text>
                      </View>
                    )}
                  </View>
                  <Pressable onPress={() => setCalMode(m => m === "left" ? "eaten" : "left")} style={styles.toggleBtn}>
                    <Text style={styles.toggleText}>⇄ {calMode === "left" ? "Calories Left" : "Calories Eaten"}</Text>
                  </Pressable>
                </View>
                <View style={{ position: "relative" }}>
                  <Ring pct={calPct} size={82} stroke={8} color="#1C1C1E" bg="#E5E5EA" />
                  <View style={styles.ringOverlay}>
                    <ArcIcon name="flame" size={24} color="#FF6B35" />
                  </View>
                </View>
              </Pressable>

              {/* Macro cards */}
              <View style={styles.macroGrid}>
                {(calMode === "left" ? [
                  { label: "Protein left", val: proteinLeft, consumed: macros.protein, goal: proteinGoal, color: "#FF6B6B", icon: "protein" as const },
                  { label: "Carbs left", val: carbsLeft, consumed: macros.carbs, goal: carbsGoal, color: "#FF9F43", icon: "carbs" as const },
                  { label: "Fat left", val: fatLeft, consumed: macros.fat, goal: fatGoal, color: "#4FACFE", icon: "fat" as const },
                ] : [
                  { label: "Protein eaten", val: macros.protein, consumed: macros.protein, goal: proteinGoal, color: "#FF6B6B", icon: "protein" as const },
                  { label: "Carbs eaten", val: macros.carbs, consumed: macros.carbs, goal: carbsGoal, color: "#FF9F43", icon: "carbs" as const },
                  { label: "Fat eaten", val: macros.fat, consumed: macros.fat, goal: fatGoal, color: "#4FACFE", icon: "fat" as const },
                ]).map(({ label, val, consumed, goal, color, icon }) => (
                  <Pressable key={label} onPress={() => router.push("/daily-breakdown" as any)} style={styles.macroCard}>
                    <Text style={styles.macroVal}>{Math.round(val)}g</Text>
                    <Text style={styles.macroLabel}>{label}</Text>
                    <View style={{ position: "relative", marginTop: 10 }}>
                      <Ring pct={consumed / Math.max(goal, 1)} size={52} stroke={5} color={color} bg="#E5E5EA" />
                      <View style={styles.ringOverlaySmall}>
                        <ArcIcon name={icon} size={16} color={color} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Slide 2: Health Score + Micros */}
            <View style={{ width: slideWidth, paddingRight: 14 }}>
              {/* Micro cards */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.5 }}>Micronutrients</Text>
                <Pressable onPress={() => setNutrientInfo(true)} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#8E8E93" }}>What do these mean?</Text>
                </Pressable>
              </View>
              <View style={styles.macroGrid}>
                {[
                  { label: calMode === "left" ? "Fiber left" : "Fiber eaten", val: calMode === "left" ? fiberLeft : macros.fiber, consumed: macros.fiber, goal: fiberGoal, color: "#BF5AF2", icon: "fiber" as const, unit: "g" },
                  { label: "Sugar", val: macros.sugar, consumed: macros.sugar, goal: 50, color: "#FF6B9D", icon: "sugar" as const, unit: "g" },
                  { label: "Sodium", val: macros.sodium, consumed: macros.sodium, goal: 2300, color: "#FF9F43", icon: "sodium" as const, unit: "mg" },
                ].map(({ label, val, consumed, goal, color, icon, unit }) => (
                  <View key={label} style={styles.macroCard}>
                    <Text style={styles.macroVal}>{val > 0 ? Math.round(val) : "—"}</Text>
                    <Text style={{ fontSize: 9, color: "#C7C7CC" }}>{unit}</Text>
                    <Text style={styles.macroLabel}>{label}</Text>
                    <View style={{ position: "relative", marginTop: 10 }}>
                      <Ring pct={consumed / Math.max(goal, 1)} size={52} stroke={5} color={color} bg="#E5E5EA" />
                      <View style={styles.ringOverlaySmall}>
                        <ArcIcon name={icon} size={16} color={color} />
                      </View>
                    </View>
                  </View>
                ))}
              </View>

              {/* Health Score card */}
              <Pressable onPress={() => router.push("/daily-breakdown" as any)} style={[styles.calorieCard, { marginTop: 10 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.eyebrow}>Health Score</Text>
                  {calories > 0 ? (
                    <>
                      <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text }}>Good</Text>
                      <Text style={{ fontSize: 12, color: colors.text2, marginTop: 4 }}>Great nutritional balance today!</Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>N/A</Text>
                      <Text style={{ fontSize: 12, color: colors.text2, marginTop: 4 }}>Track a few foods to generate your health score</Text>
                    </>
                  )}
                </View>
                {calories > 0 && (
                  <View style={{ position: "relative", marginLeft: 16 }}>
                    <Ring pct={0.7} size={72} stroke={7} color="#34C759" bg="#E5E5EA" />
                    <View style={styles.ringOverlay}>
                      <Text style={{ fontSize: 15, fontWeight: "900", color: colors.text }}>7</Text>
                      <Text style={{ fontSize: 9, color: colors.text2 }}>/10</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Slide 3: Activity */}
            <View style={{ width: slideWidth, paddingRight: 14 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Steps */}
                <View style={[styles.activityCard, { flex: 1 }]}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>{stepsK}</Text>
                  <Text style={{ fontSize: 11, color: colors.text2, marginTop: 2, marginBottom: 12 }}>/{(stepGoal / 1000).toFixed(0)}k Steps today</Text>
                  <View style={{ position: "relative", width: 64, height: 64, alignSelf: "center" }}>
                    <Ring pct={steps / Math.max(stepGoal, 1)} size={64} stroke={6} color="#4FACFE" bg="#E5E5EA" />
                    <View style={[styles.ringOverlay, { position: "absolute" }]}>
                      <ArcIcon name="steps" size={20} color="#4FACFE" />
                    </View>
                  </View>
                </View>
                {/* Calories burned */}
                <View style={[styles.activityCard, { flex: 1 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <ArcIcon name="flame" size={18} color="#FF6B35" />
                    <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>0</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: colors.text2, marginTop: 2, marginBottom: 12 }}>Calories burned</Text>
                  <View style={{ backgroundColor: "#1C1C1E", borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start" }}>
                    <Text style={{ fontSize: 11, color: "white", fontWeight: "600" }}>Workout +0</Text>
                  </View>
                </View>
              </View>

              {/* Water card */}
              <View style={[styles.waterCard, { marginTop: 10 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <ArcIcon name="water" size={22} color="#3B9EDB" />
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Water</Text>
                    <Text style={{ fontSize: 12, color: colors.text2 }}>{hydrationL}L / {(hydrationGoal / 1000).toFixed(1)}L</Text>
                  </View>
                </View>
                <Pressable onPress={() => setWaterPopup(true)} style={styles.logBtn}>
                  <Text style={styles.logBtnText}>Log</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          {/* Pagination dots */}
          <View style={styles.dots}>
            {[0, 1, 2].map(i => (
              <View key={i} style={[styles.dot, carouselIdx === i && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* ── Suggest a meal ── */}
        {isToday && (
          <Pressable onPress={() => setMealSuggestStep("pick")}
            style={{ marginHorizontal: 14, marginTop: 20, backgroundColor: "white", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" }}>
              <ArcIcon name="bolt" size={18} color="#1C1C1E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#1C1C1E" }}>Suggest a meal</Text>
              <Text style={{ fontSize: 12, color: "#8E8E93", marginTop: 2 }}>AI picks something that fits your remaining macros</Text>
            </View>
            <Text style={{ fontSize: 14, color: "#C7C7CC" }}>›</Text>
          </Pressable>
        )}

        {/* ── Recently Logged ── */}
        <View style={{ padding: 14, paddingTop: 20 }}>
          <Text style={styles.sectionTitle}>Recently logged</Text>

          {recentEntries.length === 0 ? (
            <Pressable style={styles.emptyCard} onPress={() => router.push("/food-search" as any)}>
              <View style={{ marginBottom: 8 }}><ArcIcon name="plate" size={36} color="#C7C7CC" /></View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Nothing logged yet</Text>
              <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>Tap + to log your meals</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10 }}>
              {recentEntries.map((entry: any) => {
                const timeStr = entry.timestamp ? format(new Date(entry.timestamp), "h:mm a") : "";
                return (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                      <Text style={styles.entryFood} numberOfLines={1}>{entry.food}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 12, color: colors.text2 }}>{timeStr}</Text>
                        <Pressable onPress={() => router.push(`/fix-result?food=${encodeURIComponent(entry.food)}&calories=${entry.calories || 0}&protein=${entry.protein || 0}&carbs=${entry.carbs || 0}&fat=${entry.fat || 0}&fiber=${entry.fiber || 0}` as any)}>
                          <ArcIcon name="edit" size={14} color="#C7C7CC" />
                        </Pressable>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <ArcIcon name="flame" size={14} color="#FF6B35" />
                      <Text style={styles.entryCal}>{Math.round(entry.calories || 0)} calories</Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><ArcIcon name="protein" size={12} color="#FF6B6B" /><Text style={styles.entryMacro}>{Math.round(entry.protein || 0)}g</Text></View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><ArcIcon name="carbs" size={12} color="#FF9F43" /><Text style={styles.entryMacro}>{Math.round(entry.carbs || 0)}g</Text></View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><ArcIcon name="fat" size={12} color="#4FACFE" /><Text style={styles.entryMacro}>{Math.round(entry.fat || 0)}g</Text></View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── FAB ── */}
      {isToday && (
        <>
          {fabOpen && (
            <Pressable style={styles.fabOverlay} onPress={() => setFabOpen(false)}>
              <View style={styles.fabGrid}>
                {([
                  { icon: "search" as const, label: "Search Food", route: "/food-search" },
                  { icon: "bookmark" as const, label: "Saved Foods", route: "/food-search" },
                  { icon: "camera" as const, label: "Scan Food", route: "/scan" },
                  { icon: "edit" as const, label: "Manual Entry", route: "/food-search" },
                ]).map(({ icon, label, route }) => (
                  <Pressable key={label} style={styles.fabItem} onPress={() => { setFabOpen(false); router.push(route as any); }}>
                    <View style={styles.fabIcon}>
                      <ArcIcon name={icon} size={22} color="#1C1C1E" />
                    </View>
                    <Text style={styles.fabLabel}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          )}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setFabOpen(v => !v); }}
            style={[styles.fab, fabOpen && { transform: [{ rotate: "45deg" }] }]}
          >
            <Text style={styles.fabPlus}>+</Text>
          </Pressable>
        </>
      )}

      {/* ── Water Modal ── */}
      <Modal visible={waterPopup} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => { setWaterPopup(false); setShowCustomWater(false); }}>
          <Pressable style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }} onPress={() => {}}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5EA", alignSelf: "center", marginBottom: 20 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#1C1C1E" }}>Log Water</Text>
              <View style={{ flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 10, padding: 3 }}>
                <Pressable onPress={() => setWaterUnit("ml")} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: waterUnit === "ml" ? "#1C1C1E" : "transparent" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: waterUnit === "ml" ? "white" : "#8E8E93" }}>ml</Text>
                </Pressable>
                <Pressable onPress={() => setWaterUnit("oz")} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: waterUnit === "oz" ? "#1C1C1E" : "transparent" }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: waterUnit === "oz" ? "white" : "#8E8E93" }}>oz</Text>
                </Pressable>
              </View>
            </View>
            <View style={{ gap: 10 }}>
              {[
                { label: "Glass", ml: 250, oz: 8 },
                { label: "Bottle", ml: 500, oz: 17 },
                { label: "Large Bottle", ml: 750, oz: 25 },
              ].map(opt => {
                const display = waterUnit === "ml" ? `${opt.ml} ml` : `${opt.oz} oz`;
                return (
                  <Pressable key={opt.label} onPress={() => addWater(opt.ml)}
                    style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16 }}>
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "#1C1C1E" }}>{opt.label}</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#8E8E93" }}>{display}</Text>
                  </Pressable>
                );
              })}
              {!showCustomWater ? (
                <Pressable onPress={() => setShowCustomWater(true)}
                  style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16 }}>
                  <Text style={{ flex: 1, fontSize: 16, fontWeight: "600", color: "#1C1C1E" }}>Custom</Text>
                  <Text style={{ fontSize: 14, color: "#8E8E93" }}>Enter amount</Text>
                </Pressable>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TextInput
                    value={customWater}
                    onChangeText={setCustomWater}
                    placeholder={waterUnit === "ml" ? "350" : "12"}
                    placeholderTextColor="#C7C7CC"
                    keyboardType="numeric"
                    autoFocus
                    style={{ flex: 1, backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16, fontSize: 16, fontWeight: "600", color: "#1C1C1E" }}
                  />
                  <Pressable onPress={() => {
                    const val = parseFloat(customWater);
                    if (!val || val <= 0) return;
                    const mlVal = waterUnit === "oz" ? Math.round(val * 29.574) : val;
                    addWater(mlVal);
                  }} style={{ backgroundColor: "#1C1C1E", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 16 }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Add</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Nutrient Explainer Modal ── */}
      <Modal visible={nutrientInfo} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => setNutrientInfo(false)}>
          <Pressable style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }} onPress={() => {}}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5EA", alignSelf: "center", marginBottom: 20 }} />
            <Text style={{ fontSize: 18, fontWeight: "800", color: "#1C1C1E", marginBottom: 16 }}>What do these mean?</Text>
            {[
              { name: "Fiber", target: `${fiberGoal}g/day`, desc: "Keeps digestion healthy and helps you feel full. Found in fruits, vegetables, and whole grains.", color: "#BF5AF2" },
              { name: "Sugar", target: "< 50g/day", desc: "Added sugars should be limited. Natural sugars from fruit are fine. Excess sugar leads to energy crashes.", color: "#FF6B9D" },
              { name: "Sodium", target: "< 2,300mg/day", desc: "Essential for nerve function, but too much raises blood pressure. Most comes from processed foods.", color: "#FF9F43" },
            ].map(n => (
              <View key={n.name} style={{ marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F2F2F7" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: n.color }} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: "#1C1C1E" }}>{n.name}</Text>
                  <Text style={{ fontSize: 12, color: "#8E8E93", marginLeft: "auto" }}>Target: {n.target}</Text>
                </View>
                <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 19 }}>{n.desc}</Text>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Meal Suggest Modal ── */}
      <Modal visible={mealSuggestStep !== null} animationType="slide" transparent>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }} onPress={() => { setMealSuggestStep(null); setMealSuggestion(null); }}>
          <Pressable style={{ backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }} onPress={() => {}}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5EA", alignSelf: "center", marginBottom: 20 }} />
            {mealSuggestStep === "pick" && (
              <>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#1C1C1E", marginBottom: 6 }}>Suggest a meal</Text>
                <Text style={{ fontSize: 13, color: "#8E8E93", marginBottom: 20 }}>What meal are you planning?</Text>
                <View style={{ gap: 10 }}>
                  {[
                    { key: "breakfast", label: "Breakfast", icon: "sun" as const },
                    { key: "lunch", label: "Lunch", icon: "flame" as const },
                    { key: "dinner", label: "Dinner", icon: "moon" as const },
                    { key: "snack", label: "Snack", icon: "food" as const },
                  ].map(opt => (
                    <Pressable key={opt.key} onPress={() => handleMealSuggest(opt.key)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16 }}>
                      <ArcIcon name={opt.icon} size={22} color="#1C1C1E" />
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#1C1C1E" }}>{opt.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {mealSuggestStep === "loading" && (
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <ActivityIndicator size="large" color="#1C1C1E" />
                <Text style={{ fontSize: 14, color: "#8E8E93", marginTop: 16, fontWeight: "600" }}>Finding the perfect {mealSuggestType}...</Text>
              </View>
            )}
            {mealSuggestStep === "result" && mealSuggestion && (
              <>
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#1C1C1E", marginBottom: 8 }}>{mealSuggestion.name}</Text>
                <Text style={{ fontSize: 14, color: "#8E8E93", lineHeight: 20, marginBottom: 16 }}>{mealSuggestion.description}</Text>
                <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                  {[
                    { val: mealSuggestion.calories, label: "cal", color: "#1C1C1E" },
                    { val: `${mealSuggestion.protein}g`, label: "protein", color: "#FF6B6B" },
                    { val: `${mealSuggestion.carbs}g`, label: "carbs", color: "#FF9F43" },
                    { val: `${mealSuggestion.fat}g`, label: "fat", color: "#4FACFE" },
                  ].map(m => (
                    <View key={m.label} style={{ flex: 1, backgroundColor: "#F2F2F7", borderRadius: 12, padding: 12, alignItems: "center" }}>
                      <Text style={{ fontSize: 16, fontWeight: "900", color: m.color }}>{m.val}</Text>
                      <Text style={{ fontSize: 10, color: "#8E8E93", marginTop: 2 }}>{m.label}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Pressable onPress={logSuggestedMeal} style={{ flex: 1, backgroundColor: "#1C1C1E", borderRadius: 14, padding: 16, alignItems: "center" }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Log this meal</Text>
                  </Pressable>
                  <Pressable onPress={() => { const q = encodeURIComponent(`healthy ${mealSuggestion.name} recipe`); /* Linking.openURL would go here */ }}
                    style={{ flex: 1, backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16, alignItems: "center" }}>
                    <Text style={{ color: "#1C1C1E", fontWeight: "700", fontSize: 15 }}>Recipe</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F2F7" },
  // Header
  headerSection: { backgroundColor: "white", paddingTop: 0, paddingHorizontal: 20 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 14 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#1C1C1E", letterSpacing: -0.3 },
  streakPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "white", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  streakNum: { fontSize: 15, fontWeight: "700", color: "#1C1C1E" },
  // Date strip
  dateStrip: { flexDirection: "row", paddingBottom: 10 },
  dateItem: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  dateLetter: { fontSize: 10, fontWeight: "600", color: "#8E8E93", textTransform: "uppercase" },
  dateCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  dateNum: { fontSize: 14, fontWeight: "600", color: "#8E8E93" },
  dateDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "transparent" },
  // Sub nav
  subNav: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F2F2F7" },
  subNavTab: { flex: 1, paddingVertical: 10, alignItems: "center" },
  subNavText: { fontSize: 14, fontWeight: "600" },
  // Carousel
  calorieCard: { backgroundColor: "white", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  heroNumber: { fontSize: 52, fontWeight: "900", color: "#1C1C1E", letterSpacing: -2 },
  heroLabel: { fontSize: 14, color: "#8E8E93", fontWeight: "500" },
  burnedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#34C75918", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  burnedText: { fontSize: 11, fontWeight: "700", color: "#34C759" },
  toggleBtn: { marginTop: 8, backgroundColor: "#F2F2F7", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  toggleText: { fontSize: 11, fontWeight: "600", color: "#8E8E93" },
  ringOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  ringOverlaySmall: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  macroGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  macroCard: { flex: 1, backgroundColor: "white", borderRadius: 16, padding: 14, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  macroVal: { fontSize: 17, fontWeight: "800", color: "#1C1C1E" },
  macroLabel: { fontSize: 10, color: "#8E8E93", marginTop: 2, textAlign: "center" },
  eyebrow: { fontSize: 11, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  // Activity
  activityCard: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  waterCard: { backgroundColor: "white", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  logBtn: { backgroundColor: "#1C1C1E", borderRadius: 99, paddingHorizontal: 18, paddingVertical: 8 },
  logBtnText: { fontSize: 14, fontWeight: "700", color: "white" },
  // Dots
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#C7C7CC" },
  dotActive: { backgroundColor: "#1C1C1E" },
  // Recently logged
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#1C1C1E", marginBottom: 12 },
  emptyCard: { backgroundColor: "white", borderRadius: 20, padding: 32, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  entryCard: { backgroundColor: "white", borderRadius: 20, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  entryFood: { fontSize: 15, fontWeight: "600", color: "#1C1C1E", flex: 1, marginRight: 8 },
  entryCal: { fontSize: 17, fontWeight: "800", color: "#1C1C1E" },
  entryMacro: { fontSize: 12, color: "#8E8E93" },
  // FAB
  fab: { position: "absolute", bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: "#1C1C1E", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 8 },
  fabPlus: { fontSize: 28, color: "white", fontWeight: "300" },
  fabOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", zIndex: 140, justifyContent: "flex-end", alignItems: "flex-end", paddingBottom: 170, paddingRight: 16 },
  fabGrid: { flexDirection: "row", flexWrap: "wrap", width: 320, gap: 12 },
  fabItem: { width: 148, height: 128, backgroundColor: "white", borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 20 },
  fabIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  fabLabel: { fontSize: 13, fontWeight: "600", color: "#1C1C1E" },
});
