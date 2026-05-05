import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, Dimensions,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { format, startOfWeek, subMonths, startOfMonth } from "date-fns";
import { useColors } from "@/lib/ThemeContext";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";
import { supabase } from "@/lib/supabase/client";

const ACCENT = "#4B6BFB";
const DARK1 = "#1F1C36";
const DARK_CARD_TOP = "#3B4296";
const DARK_CARD_BOT = "#252D6E";
const SUBTITLE = "#AEAFCE";
const STAT_LABEL = "#9BA3BC";
const CHART_BAR = "#4A52BB";
const CHART_BAR_LAST = "#6171FB";
const WEEKLY_GOAL = 4;
const { width: SCREEN_W } = Dimensions.get("window");

type Tab = "home" | "plans" | "stats";

interface WorkoutSession {
  id: string;
  date: string;
  type: string;
  duration: number;
  intensity: number;
  exercises: any[];
}

interface Plan {
  id: string;
  name: string;
  type: string;
  exercises: any[];
}

function formatTonnage(lbs: number) {
  if (lbs >= 1000) return `${(lbs / 1000).toFixed(0)}k`;
  return `${lbs}`;
}

function sessionTonnage(s: WorkoutSession) {
  return (s.exercises || []).reduce((es: number, ex: any) =>
    es + (ex.sets || []).filter((st: any) => st.completed).reduce((ss: number, st: any) => ss + ((st.weight || 0) * (st.reps || 0)), 0), 0);
}

function getPlanChartData(plan: Plan, sessions: WorkoutSession[]) {
  const planExNames = plan.exercises.map((e: any) => e.name?.toLowerCase());
  const relevant = sessions
    .filter(s => (s.exercises || []).some((ex: any) => planExNames.includes(ex.name?.toLowerCase())))
    .slice(0, 6)
    .reverse();
  return relevant.map(s => ({
    volume: (s.exercises || []).reduce((sum: number, ex: any) =>
      sum + (ex.sets || []).filter((st: any) => st.completed).reduce((ss: number, st: any) => ss + ((st.weight || 0) * (st.reps || 0)), 0), 0)
  }));
}

function getWeeklyPercent(sessions: WorkoutSession[]): number {
  const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeek = sessions.filter(s => new Date(s.date + "T00:00:00") >= ws).length;
  return Math.min(100, Math.round((thisWeek / WEEKLY_GOAL) * 100));
}

function getMonthlyData(sessions: WorkoutSession[]) {
  const months: { month: string; tonnage: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const label = format(d, "MMM");
    const monthStart = startOfMonth(d);
    const monthEnd = startOfMonth(subMonths(d, -1));
    const tonnage = sessions
      .filter(s => { const sd = new Date(s.date + "T00:00:00"); return sd >= monthStart && sd < monthEnd; })
      .reduce((sum, s) => sum + sessionTonnage(s), 0);
    months.push({ month: label, tonnage });
  }
  return months;
}

// Mini bar chart component
function MiniBarChart({ data, height = 100 }: { data: { volume: number }[]; height?: number }) {
  const bars = data.length > 0 ? data : Array(6).fill({ volume: 0 });
  const maxVol = Math.max(1, ...bars.map(b => b.volume));

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height, flex: 1 }}>
      {bars.map((bar, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(bar.volume > 0 ? 8 : 3, (bar.volume / maxVol) * 100)}%`,
            backgroundColor: i === bars.length - 1 ? CHART_BAR_LAST : CHART_BAR,
            borderRadius: 2,
            opacity: bar.volume === 0 ? 0.2 : 1,
          }}
        />
      ))}
    </View>
  );
}

const WORKOUT_TYPES = ["Push", "Pull", "Legs", "Upper", "Lower", "Full Body", "Cardio", "Custom"];

export default function WorkoutScreen() {
  const colors = useColors();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [showLog, setShowLog] = useState(false);
  const [logType, setLogType] = useState("Push");
  const [logDuration, setLogDuration] = useState("45");
  const [logIntensity, setLogIntensity] = useState(3);
  const [exercises, setExercises] = useState<{ name: string; sets: string; reps: string; weight: string }[]>([
    { name: "", sets: "3", reps: "10", weight: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: sess }, { data: plns }] = await Promise.all([
      supabase.from("workout_sessions").select("*").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(365),
      supabase.from("workout_templates").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    setSessions(sess || []);
    setPlans((plns || []).map((p: any) => ({ id: p.id, name: p.name, type: p.type, exercises: p.exercises || [] })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalWorkouts = sessions.length;
  const totalTonnage = sessions.reduce((sum, s) => sum + sessionTonnage(s), 0);
  const weeklyPercent = getWeeklyPercent(sessions);
  const monthlyData = getMonthlyData(sessions);

  const dashboardPlans = plans.map(plan => {
    const chartData = getPlanChartData(plan, sessions);
    return { ...plan, timesCompleted: chartData.length, volumeHistory: chartData, exerciseCount: plan.exercises.length };
  });

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  const saveWorkout = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const validExercises = exercises.filter(e => e.name.trim()).map(e => ({
      name: e.name, sets: parseInt(e.sets) || 3, reps: parseInt(e.reps) || 10, weight: parseFloat(e.weight) || 0,
    }));
    await supabase.from("workout_sessions").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: format(new Date(), "yyyy-MM-dd"),
      type: logType,
      duration: parseInt(logDuration) || 45,
      intensity: logIntensity,
      exercises: validExercises,
      timestamp: Date.now(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowLog(false);
    setExercises([{ name: "", sets: "3", reps: "10", weight: "" }]);
    setSaving(false);
    loadData();
  };

  const deletePlan = (id: string) => {
    Alert.alert("Delete plan?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("workout_templates").delete().eq("id", id);
        setPlans(prev => prev.filter(p => p.id !== id));
      }},
    ]);
  };

  const addExercise = () => setExercises(prev => [...prev, { name: "", sets: "3", reps: "10", weight: "" }]);
  const updateExercise = (i: number, field: string, value: string) => {
    setExercises(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  };

  // Tab bar component
  const TabBar = () => (
    <View style={styles.tabBar}>
      {([
        { key: "home" as Tab, label: "Home", icon: "home" as ArcIconName },
        { key: "plans" as Tab, label: "Plans", icon: "workout" as ArcIconName },
        { key: "stats" as Tab, label: "Stats", icon: "barchart" as ArcIconName },
      ]).map(({ key, label, icon }) => {
        const active = activeTab === key;
        return (
          <Pressable key={key} onPress={() => { setActiveTab(key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} style={{ flex: 1, alignItems: "center" }}>
            {active ? (
              <View style={styles.tabPillActive}>
                <ArcIcon name={icon} size={16} color="white" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: "white" }}>{label}</Text>
              </View>
            ) : (
              <View style={styles.tabPill}>
                <ArcIcon name={icon} size={20} color={STAT_LABEL} />
                <Text style={{ fontSize: 10, fontWeight: "600", color: STAT_LABEL }}>{label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F6F8" }}>
        <ActivityIndicator size="large" color={ACCENT} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F6F8" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 160 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={ACCENT} />}
      >
        {/* ── HOME TAB ── */}
        {activeTab === "home" && (
          <>
            {/* Header */}
            <View style={{ backgroundColor: "white", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}>
              <Text style={{ fontSize: 11, fontWeight: "500", color: SUBTITLE, marginBottom: 8 }}>{today}</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 30, fontWeight: "900", color: DARK1, letterSpacing: -0.5 }}>Dashboard</Text>
                <View style={{ width: 36, height: 36, borderRadius: 12, overflow: "hidden", backgroundColor: "#5C47FF" }} />
              </View>
            </View>

            {/* Stats card */}
            <View style={styles.statsCard}>
              <View style={styles.statCol}>
                <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: "#EEF0FF", alignItems: "center", justifyContent: "center" }}>
                  <ArcIcon name="workout" size={16} color={ACCENT} />
                </View>
                <View>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: DARK1 }}>{totalWorkouts}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "500", color: SUBTITLE }}>workouts</Text>
                </View>
              </View>
              <View style={styles.statDivider} />
              <View style={[styles.statCol, { alignItems: "flex-start", gap: 0 }]}>
                <Text style={{ fontSize: 22, fontWeight: "900", color: ACCENT }}>{formatTonnage(totalTonnage)}</Text>
                <Text style={{ fontSize: 10, fontWeight: "500", color: SUBTITLE }}>lbs lifted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={[styles.statCol, { alignItems: "flex-start", gap: 0 }]}>
                <Text style={{ fontSize: 22, fontWeight: "900", color: DARK1 }}>{weeklyPercent}<Text style={{ fontSize: 16 }}>%</Text></Text>
                <Text style={{ fontSize: 10, fontWeight: "500", color: SUBTITLE }}>this week</Text>
              </View>
            </View>

            {/* Section label */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginTop: 24, marginBottom: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "900", color: SUBTITLE, letterSpacing: 1.5, textTransform: "uppercase" }}>
                {dashboardPlans.length > 0 ? (dashboardPlans[activeCardIdx]?.type || "My Workouts") : "My Workouts"}
              </Text>
              <Pressable onPress={() => setActiveTab("plans")}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: ACCENT }}>Show All</Text>
              </Pressable>
            </View>

            {/* Plan cards carousel */}
            {dashboardPlans.length === 0 ? (
              <View style={styles.emptyPlanCard}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "white", marginBottom: 8 }}>Start your journey</Text>
                <Text style={{ fontSize: 14, color: "#8896C8", marginBottom: 20 }}>Create a plan to track your progress</Text>
                <Pressable onPress={() => setActiveTab("plans")} style={styles.accentBtn}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "white" }}>Create a Plan</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <ScrollView
                  ref={scrollRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 40));
                    setActiveCardIdx(idx);
                  }}
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
                  snapToInterval={SCREEN_W - 40 + 16}
                  decelerationRate="fast"
                >
                  {dashboardPlans.map((plan) => (
                    <View key={plan.id} style={styles.planCard}>
                      <Text style={{ fontSize: 18, fontWeight: "900", color: "white", marginBottom: 2 }}>{plan.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: "#8896C8", marginBottom: 16 }}>{plan.timesCompleted} times completed</Text>

                      <View style={{ flexDirection: "row", gap: 12, height: 110, marginBottom: 16 }}>
                        <MiniBarChart data={plan.volumeHistory} height={110} />
                        <View style={{ justifyContent: "space-between", paddingBottom: 2 }}>
                          {["5k", "3k", "1k", "0"].map(l => (
                            <Text key={l} style={{ fontSize: 10, fontWeight: "500", color: "rgba(255,255,255,0.3)" }}>{l}</Text>
                          ))}
                        </View>
                      </View>

                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 14, fontWeight: "500", color: "#8896C8" }}>
                          <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{plan.exerciseCount}</Text> exercises
                        </Text>
                        <Pressable style={styles.startBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowLog(true); }}>
                          <Text style={{ fontSize: 12, fontWeight: "900", color: "white", letterSpacing: 1, textTransform: "uppercase" }}>START</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>

                {/* Dots */}
                {dashboardPlans.length > 1 && (
                  <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 }}>
                    {dashboardPlans.map((_, i) => (
                      <View key={i} style={{ width: i === activeCardIdx ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === activeCardIdx ? ACCENT : "#C7CDE8" }} />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ── PLANS TAB ── */}
        {activeTab === "plans" && (
          <>
            <View style={{ backgroundColor: "white", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#EEEEF3" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 28, fontWeight: "900", color: DARK1, letterSpacing: -0.5 }}>My Workouts</Text>
                <Pressable onPress={() => setShowLog(true)} style={[styles.accentBtn, { paddingHorizontal: 16, paddingVertical: 10 }]}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "white" }}>+ Create</Text>
                </Pressable>
              </View>
            </View>

            <View style={{ paddingTop: 12, gap: 6 }}>
              {dashboardPlans.length === 0 ? (
                <View style={{ marginHorizontal: 20, backgroundColor: "white", borderRadius: 16, padding: 40, alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: STAT_LABEL, marginBottom: 8 }}>No plans yet</Text>
                  <Text style={{ fontSize: 14, color: "#C7CDE8" }}>Create a plan to pre-load exercises and track progression</Text>
                </View>
              ) : (
                dashboardPlans.map((plan) => (
                  <Pressable key={plan.id} style={styles.planListCard} onLongPress={() => deletePlan(plan.id)}>
                    <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 }}>
                      <Text style={{ fontSize: 17, fontWeight: "900", color: "white", letterSpacing: -0.3 }}>{plan.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "500", color: "#8896C8", marginTop: 2 }}>{plan.type}</Text>
                    </View>

                    <View style={{ flexDirection: "row", gap: 12, paddingHorizontal: 20, marginTop: 12, marginBottom: 12, height: 100 }}>
                      <MiniBarChart data={plan.volumeHistory} height={100} />
                      <View style={{ justifyContent: "space-between", paddingBottom: 2 }}>
                        {["5k", "3k", "1k", "0"].map(l => (
                          <Text key={l} style={{ fontSize: 10, fontWeight: "500", color: "rgba(255,255,255,0.3)" }}>{l}</Text>
                        ))}
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#8896C8" }}>
                        <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>{plan.timesCompleted}</Text> times completed
                      </Text>
                      <Pressable style={styles.startBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowLog(true); }}>
                        <Text style={{ fontSize: 12, fontWeight: "900", color: "white", letterSpacing: 1, textTransform: "uppercase" }}>START</Text>
                      </Pressable>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <>
            <View style={{ backgroundColor: "white", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#EEEEF3" }}>
              <Text style={{ fontSize: 30, fontWeight: "900", color: "#0F1729", letterSpacing: -0.5 }}>Statistics</Text>
            </View>

            <View style={{ padding: 20, gap: 12 }}>
              {/* Tonnage chart card */}
              <View style={styles.tonnageCard}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 14, fontWeight: "500", color: "#8896C8", marginBottom: 4 }}>Tonnage Lifted</Text>
                  <Text style={{ fontSize: 36, fontWeight: "900", color: "white", letterSpacing: -1 }}>
                    {formatTonnage(monthlyData.reduce((s, d) => s + d.tonnage, 0))}<Text style={{ fontSize: 18, color: "#8896C8" }}> lbs</Text>
                  </Text>
                </View>

                {/* Bar chart */}
                <View style={{ height: 120, flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
                  {monthlyData.map((d, i) => {
                    const maxT = Math.max(1, ...monthlyData.map(m => m.tonnage));
                    return (
                      <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <View style={{
                          width: "100%",
                          height: `${Math.max(d.tonnage > 0 ? 8 : 3, (d.tonnage / maxT) * 100)}%`,
                          backgroundColor: ACCENT,
                          borderTopLeftRadius: 4,
                          borderTopRightRadius: 4,
                        }} />
                        <Text style={{ fontSize: 11, fontWeight: "500", color: "#8896C8", marginTop: 6 }}>{d.month}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* 2x2 stat cards */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={styles.statCard}>
                  <View style={{ marginBottom: 8 }}><ArcIcon name="workout" size={24} color={ACCENT} /></View>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#0F1729" }}>{totalWorkouts}</Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: STAT_LABEL, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Workouts</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={{ marginBottom: 8 }}><ArcIcon name="scale" size={24} color={ACCENT} /></View>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#0F1729" }}>{formatTonnage(totalTonnage)}<Text style={{ fontSize: 14, color: STAT_LABEL }}> lbs</Text></Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: STAT_LABEL, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Total Tonnage</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={styles.statCard}>
                  <View style={{ marginBottom: 8 }}><ArcIcon name="timer" size={24} color={ACCENT} /></View>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#0F1729" }}>
                    {sessions.length > 0 ? (sessions.filter(s => s.duration > 0).reduce((s, w) => s + w.duration, 0) / Math.max(1, sessions.filter(s => s.duration > 0).length) / 60).toFixed(2) : "0"}<Text style={{ fontSize: 14, color: STAT_LABEL }}> h</Text>
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: STAT_LABEL, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Avg Duration</Text>
                </View>
                <View style={styles.statCard}>
                  <View style={{ marginBottom: 8 }}><ArcIcon name="bolt" size={24} color="#FFB800" /></View>
                  <Text style={{ fontSize: 24, fontWeight: "900", color: "#0F1729" }}>
                    {sessions.length > 0 ? (sessions.filter(s => s.intensity > 0).reduce((s, w) => s + w.intensity, 0) / Math.max(1, sessions.filter(s => s.intensity > 0).length)).toFixed(1) : "0"}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: STAT_LABEL, letterSpacing: 1, textTransform: "uppercase", marginTop: 4 }}>Avg RPE</Text>
                </View>
              </View>

              {/* By month list */}
              {monthlyData.length > 0 && (
                <View style={styles.monthListCard}>
                  <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F0F0F6" }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: STAT_LABEL, letterSpacing: 1.5, textTransform: "uppercase" }}>By Month</Text>
                  </View>
                  {monthlyData.map((item) => (
                    <View key={item.month} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F0F0F6" }}>
                      <Text style={{ fontSize: 16, fontWeight: "600", color: "#0F1729" }}>{item.month}</Text>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: item.tonnage > 0 ? ACCENT : "#C7CDE8" }}>
                        {item.tonnage > 0 ? `${formatTonnage(item.tonnage)} lbs` : "0 lbs"}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Bottom tab bar */}
      <TabBar />

      {/* Log workout modal */}
      <Modal visible={showLog} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#F6F6F8" }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: DARK1 }}>Log Workout</Text>
              <Pressable onPress={() => setShowLog(false)}>
                <Text style={{ fontSize: 16, color: STAT_LABEL }}>Cancel</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {WORKOUT_TYPES.map(t => (
                  <Pressable key={t} onPress={() => setLogType(t)} style={[styles.chip, logType === t && styles.chipActive]}>
                    <Text style={[styles.chipText, logType === t && styles.chipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Duration (min)</Text>
                <TextInput style={styles.input} value={logDuration} onChangeText={setLogDuration} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Intensity</Text>
                <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Pressable key={i} onPress={() => setLogIntensity(i)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: i <= logIntensity ? DARK1 : "#EEEEF3", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: i <= logIntensity ? "white" : STAT_LABEL }}>{i}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.label}>Exercises</Text>
            {exercises.map((ex, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                <TextInput style={[styles.input, { flex: 2 }]} placeholder="Exercise name" placeholderTextColor="#C7CDE8" value={ex.name} onChangeText={v => updateExercise(i, "name", v)} />
                <TextInput style={[styles.input, { flex: 0.5 }]} placeholder="Sets" placeholderTextColor="#C7CDE8" value={ex.sets} onChangeText={v => updateExercise(i, "sets", v)} keyboardType="number-pad" />
                <TextInput style={[styles.input, { flex: 0.5 }]} placeholder="Reps" placeholderTextColor="#C7CDE8" value={ex.reps} onChangeText={v => updateExercise(i, "reps", v)} keyboardType="number-pad" />
                <TextInput style={[styles.input, { flex: 0.7 }]} placeholder="lbs" placeholderTextColor="#C7CDE8" value={ex.weight} onChangeText={v => updateExercise(i, "weight", v)} keyboardType="decimal-pad" />
              </View>
            ))}
            <Pressable onPress={addExercise} style={{ paddingVertical: 12 }}>
              <Text style={{ color: ACCENT, fontWeight: "700", fontSize: 14 }}>+ Add exercise</Text>
            </Pressable>

            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={saveWorkout} disabled={saving}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{saving ? "Saving..." : "Save Workout"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#E5E8EF",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: "row",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  tabPillActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: ACCENT,
  },
  tabPill: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
  },
  statsCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "white",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#EEEEF3",
  },
  statCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#EEEEF3",
    marginVertical: 12,
  },
  emptyPlanCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
    backgroundColor: DARK_CARD_BOT,
  },
  planCard: {
    width: SCREEN_W - 40,
    borderRadius: 24,
    padding: 20,
    backgroundColor: DARK_CARD_BOT,
    minHeight: 220,
  },
  planListCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: DARK_CARD_BOT,
  },
  accentBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: ACCENT,
  },
  startBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  tonnageCard: {
    backgroundColor: "#1A2B5E",
    borderRadius: 16,
    padding: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  monthListCard: {
    backgroundColor: "white",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  label: { fontSize: 12, fontWeight: "700", color: STAT_LABEL, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 14, fontSize: 15, color: DARK1, borderWidth: 1, borderColor: "#EEEEF3" },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99, backgroundColor: "white" },
  chipActive: { backgroundColor: DARK1 },
  chipText: { fontSize: 13, fontWeight: "700", color: DARK1 },
  chipTextActive: { color: "white" },
  saveBtn: { backgroundColor: DARK1, borderRadius: 14, padding: 18, alignItems: "center", marginTop: 20 },
});
