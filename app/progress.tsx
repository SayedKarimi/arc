import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, subDays } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { getSettings, getNutritionTotals } from "@/lib/supabase/queries";
import { ArcIcon } from "@/components/ArcIcon";

const DARK = "#1C1C1E";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";

type TimeRange = "90D" | "6M" | "1Y" | "ALL";

interface WeightEntry { date: string; weight: number; unit: string; note?: string; }

function getBMI(weightLbs: number, heightCm: number) {
  if (!weightLbs || !heightCm) return null;
  const wKg = weightLbs * 0.453592;
  const hM = heightCm / 100;
  return Math.round((wKg / (hM * hM)) * 10) / 10;
}

function getBMICategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", color: "#4FACFE" };
  if (bmi < 25) return { label: "Normal", color: "#34C759" };
  if (bmi < 30) return { label: "Overweight", color: "#FF9F43" };
  return { label: "Obese", color: "#FF3B30" };
}

export default function ProgressScreen() {
  const router = useRouter();
  const [weightHistory, setWeightHistory] = useState<WeightEntry[]>([]);
  const [streak, setStreak] = useState(0);
  const [settings, setSettings] = useState<any>({});
  const [weekNutrition, setWeekNutrition] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("90D");
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: wh }, s] = await Promise.all([
      supabase.from("body_weight").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(365),
      getSettings(),
    ]);
    setWeightHistory((wh || []) as WeightEntry[]);
    setSettings(s || {});

    // Streak from momentum
    const { data: mom } = await supabase.from("daily_momentum").select("date").eq("user_id", user.id).order("date", { ascending: false }).limit(60);
    let str = 0;
    const momDates = new Set((mom || []).map((m: any) => m.date));
    const d = new Date();
    for (let i = 0; i < 60; i++) {
      const ds = format(d, "yyyy-MM-dd");
      if (momDates.has(ds)) { str++; d.setDate(d.getDate() - 1); }
      else { if (i === 0) { d.setDate(d.getDate() - 1); continue; } break; }
    }
    setStreak(str);

    // Weekly nutrition
    const days = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const dd = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
        return getNutritionTotals(dd).then((t: any) => ({
          day: format(subDays(new Date(), 6 - i), "EEE"),
          protein: Math.round(t?.protein || 0),
          carbs: Math.round(t?.carbs || 0),
          fat: Math.round(t?.fat || 0),
        }));
      })
    );
    setWeekNutrition(days);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveWeight = async () => {
    const w = parseFloat(weightInput);
    if (!w) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("body_weight").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: format(new Date(), "yyyy-MM-dd"),
      weight: w,
      unit,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWeightInput("");
    setShowLogWeight(false);
    setSaving(false);
    load();
  };

  const rangeDays: Record<TimeRange, number> = { "90D": 90, "6M": 180, "1Y": 365, "ALL": 9999 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays[range]);
  const filteredWeight = weightHistory.filter(e => new Date(e.date + "T00:00:00") >= cutoff);
  const chartData = [...filteredWeight].reverse();

  const latest = weightHistory[0];
  const heightCm = settings?.height || 0;
  const weightLbs = latest?.weight || 0;
  const bmi = getBMI(weightLbs, heightCm);
  const bmiCat = bmi ? getBMICategory(bmi) : null;

  const goalWeight = settings?.goalWeight || 0;

  const minW = chartData.length > 0 ? Math.min(...chartData.map(d => d.weight)) : 0;
  const maxW = chartData.length > 0 ? Math.max(...chartData.map(d => d.weight)) : 1;
  const chartRange = maxW - minW || 1;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <ActivityIndicator size="large" color={DARK} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={DARK} />}
      >
        {/* Header */}
        <View style={{ backgroundColor: "white", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Progress</Text>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* Weight + Streak row */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={[styles.card, { flex: 1 }]}>
              <Text style={styles.cardLabel}>My Weight</Text>
              {latest ? (
                <Text style={{ fontSize: 26, fontWeight: "900", color: DARK, marginBottom: 4 }}>
                  {latest.weight}<Text style={{ fontSize: 13, color: SUBTITLE, fontWeight: "600" }}> {latest.unit}</Text>
                </Text>
              ) : (
                <Text style={{ fontSize: 16, color: SUBTITLE, marginBottom: 4 }}>—</Text>
              )}
              <Pressable onPress={() => setShowLogWeight(v => !v)} style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: DARK, alignSelf: "flex-start" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>Log</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { flex: 1 }]}>
              <Text style={styles.cardLabel}>Day Streak</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginBottom: 10 }}>
                <Text style={{ fontSize: 26, fontWeight: "900", color: DARK }}>{streak}</Text>
                <Text style={{ fontSize: 12, color: SUBTITLE }}>days</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 5 }}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < Math.min(streak, 7) ? "#FF9F0A" : "#E5E5EA" }} />
                ))}
              </View>
            </View>
          </View>

          {/* Log weight form */}
          {showLogWeight && (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
                <TextInput placeholder="0.0" placeholderTextColor="#C7C7CC" value={weightInput} onChangeText={setWeightInput} keyboardType="decimal-pad" autoFocus style={[styles.input, { flex: 1 }]} />
                <View style={{ flexDirection: "row", backgroundColor: BG, borderRadius: 12, overflow: "hidden" }}>
                  {(["lbs", "kg"] as const).map(u => (
                    <Pressable key={u} onPress={() => setUnit(u)} style={{ paddingHorizontal: 14, paddingVertical: 12, backgroundColor: unit === u ? DARK : "transparent" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: unit === u ? "white" : SUBTITLE }}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setShowLogWeight(false)} style={{ flex: 1, padding: 11, borderRadius: 12, backgroundColor: BG, alignItems: "center" }}>
                  <Text style={{ color: SUBTITLE, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveWeight} disabled={saving || !weightInput} style={{ flex: 2, padding: 11, borderRadius: 12, backgroundColor: weightInput ? DARK : "#C7C7CC", alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Time range selector */}
          <View style={{ backgroundColor: "white", borderRadius: 20, padding: 6, flexDirection: "row", gap: 2 }}>
            {(["90D", "6M", "1Y", "ALL"] as TimeRange[]).map(r => (
              <Pressable key={r} onPress={() => setRange(r)} style={{ flex: 1, paddingVertical: 9, borderRadius: 14, backgroundColor: range === r ? DARK : "transparent", alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: range === r ? "white" : SUBTITLE }}>
                  {r === "ALL" ? "All" : r}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Goal progress card with chart */}
          <View style={{ backgroundColor: "white", borderRadius: 24, overflow: "hidden" }}>
            <View style={{ backgroundColor: "rgba(52,199,89,0.1)", borderBottomWidth: 1, borderBottomColor: "rgba(52,199,89,0.2)", padding: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ArcIcon name="target" size={16} color={DARK} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#34C759" }}>
                {goalWeight ? `${Math.abs(weightLbs - goalWeight).toFixed(1)} lbs to goal weight` : "Keep it up — you're doing great!"}
              </Text>
            </View>
            <View style={{ padding: 20 }}>
              <Text style={styles.cardLabel}>Goal Progress</Text>
              {chartData.length > 1 ? (
                <View style={{ height: 120, flexDirection: "row", alignItems: "flex-end", gap: 2, marginTop: 12 }}>
                  {chartData.slice(-20).map((d, i) => (
                    <View key={i} style={{ flex: 1, height: `${((d.weight - minW) / chartRange) * 80 + 10}%`, backgroundColor: DARK, borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
                  ))}
                </View>
              ) : (
                <Text style={{ fontSize: 13, color: "#C7C7CC", textAlign: "center", padding: 24 }}>Log at least 2 weights to see trend</Text>
              )}
            </View>
          </View>

          {/* BMI card */}
          {bmi && bmiCat && (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={styles.cardLabel}>BMI</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, backgroundColor: bmiCat.color + "22" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: bmiCat.color }}>{bmi}</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: bmiCat.color }}>{bmiCat.label}</Text>
                </View>
              </View>
              <View style={{ height: 12, borderRadius: 99, flexDirection: "row", overflow: "hidden", marginBottom: 12 }}>
                <View style={{ flex: 1, backgroundColor: "#4FACFE" }} />
                <View style={{ flex: 1, backgroundColor: "#34C759" }} />
                <View style={{ flex: 1, backgroundColor: "#FF9F43" }} />
                <View style={{ flex: 1, backgroundColor: "#FF3B30" }} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {["Underweight", "Normal", "Overweight", "Obese"].map(label => (
                  <Text key={label} style={{ fontSize: 9, color: "#C7C7CC", fontWeight: "600" }}>{label}</Text>
                ))}
              </View>
            </View>
          )}

          {/* Macros This Week */}
          {weekNutrition.some(d => d.protein + d.carbs + d.fat > 0) && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Macros This Week</Text>
              <View style={{ flexDirection: "row", gap: 16, marginVertical: 12 }}>
                {[{ label: "Protein", color: "#FF6B6B" }, { label: "Carbs", color: "#FF9F43" }, { label: "Fat", color: "#4FACFE" }].map(({ label, color }) => (
                  <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                    <Text style={{ fontSize: 11, color: SUBTITLE }}>{label}</Text>
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 6 }}>
                {weekNutrition.map((d, i) => {
                  const total = d.protein + d.carbs + d.fat;
                  const maxTotal = Math.max(1, ...weekNutrition.map((n: any) => n.protein + n.carbs + n.fat));
                  const h = total > 0 ? (total / maxTotal) * 100 : 3;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{ width: "100%", height: `${h}%`, borderRadius: 4, overflow: "hidden" }}>
                        <View style={{ flex: d.protein, backgroundColor: "#FF6B6B" }} />
                        <View style={{ flex: d.carbs, backgroundColor: "#FF9F43" }} />
                        <View style={{ flex: d.fat, backgroundColor: "#4FACFE" }} />
                      </View>
                      <Text style={{ fontSize: 10, color: "#C7C7CC", marginTop: 4 }}>{d.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Nav links */}
          <View style={{ backgroundColor: "white", borderRadius: 20, overflow: "hidden" }}>
            {[
              { label: "Weight History", icon: "scale" as const, href: "/progress" },
              { label: "Nutrition Goals", icon: "target" as const, href: "/nutrition-goals" },
            ].map((item, i) => (
              <Pressable key={item.label} onPress={() => router.push(item.href as any)} style={{ padding: 15, paddingHorizontal: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BG }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ArcIcon name={item.icon} size={16} color={DARK} /><Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>{item.label}</Text></View>
                <ArcIcon name="chevronRight" size={18} color="#C7C7CC" />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "white", borderRadius: 20, padding: 16 },
  cardLabel: { fontSize: 10, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 18, fontWeight: "700", color: DARK },
});
