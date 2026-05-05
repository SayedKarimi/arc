import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

const today = format(new Date(), "yyyy-MM-dd");

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "supplement" | "uncategorized";
const MEAL_ORDER: MealCategory[] = ["breakfast", "lunch", "dinner", "snack", "supplement", "uncategorized"];
const MEAL_LABELS: Record<MealCategory, { label: string; icon: ArcIconName }> = {
  breakfast: { label: "Breakfast", icon: "sun" },
  lunch: { label: "Lunch", icon: "flame" },
  dinner: { label: "Dinner", icon: "moon" },
  snack: { label: "Snack", icon: "food" },
  supplement: { label: "Supplement", icon: "health" },
  uncategorized: { label: "Other", icon: "plate" },
};

interface NutritionEntry {
  id: string; food: string; calories: number; protein: number;
  carbs: number; fat: number; meal: MealCategory;
}

export default function DailyBreakdownScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [totals, setTotals] = useState<any>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  const [targets, setTargets] = useState<any>({ calories: 2000, protein: 150, carbs: 200, fat: 70, fiber: 30 });
  const [hydration, setHydration] = useState(0);
  const [hydrationGoal] = useState(2500);
  const [sleep, setSleep] = useState<any>(null);
  const [sleepGoal] = useState(8);
  const [steps, setSteps] = useState(0);
  const [stepGoal] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [addingWater, setAddingWater] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [entriesRes, settingsRes, hydRes, sleepRes, stepsRes] = await Promise.all([
      supabase.from("nutrition_entries").select("*").eq("user_id", user.id).eq("date", today),
      supabase.from("user_settings").select("macro_targets,step_goal").eq("user_id", user.id).single(),
      supabase.from("hydration_entries").select("amount").eq("user_id", user.id).eq("date", today),
      supabase.from("sleep_entries").select("duration").eq("user_id", user.id).eq("date", today).maybeSingle(),
      supabase.from("step_entries").select("steps").eq("user_id", user.id).eq("date", today).maybeSingle(),
    ]);

    const e = (entriesRes.data || []) as NutritionEntry[];
    setEntries(e);

    const t = e.reduce((acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
      fiber: acc.fiber,
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    setTotals(t);

    if (settingsRes.data?.macro_targets) {
      setTargets(settingsRes.data.macro_targets);
    }

    const totalWater = (hydRes.data || []).reduce((s: number, h: any) => s + (h.amount || 0), 0);
    setHydration(totalWater);
    setSleep(sleepRes.data || null);
    setSteps(stepsRes.data?.steps || 0);
    setLoading(false);
  };

  const addWater = async (amount: number) => {
    if (addingWater) return;
    setAddingWater(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAddingWater(false); return; }
    await supabase.from("hydration_entries").insert({
      user_id: user.id, date: today, amount, timestamp: new Date().toISOString(),
    });
    setHydration(prev => prev + amount);
    setAddingWater(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  const calRemaining = Math.max(0, (targets.calories || 2000) - (totals.calories || 0));
  const calPct = Math.min((totals.calories || 0) / (targets.calories || 2000), 1);
  const calColor = calPct >= 1 ? "#FF3B30" : "#34C759";

  const healthScores = [
    Math.min((totals.calories || 0) / (targets.calories || 2000), 1),
    Math.min((totals.protein || 0) / (targets.protein || 150), 1),
    Math.min((totals.carbs || 0) / (targets.carbs || 200), 1),
    Math.min((totals.fat || 0) / (targets.fat || 70), 1),
  ];
  const healthScore = Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length * 10);
  const scoreColor = healthScore >= 7 ? "#34C759" : healthScore >= 5 ? "#FF9F0A" : "#FF3B30";

  const macroChecks = [
    { label: "Protein", val: totals.protein || 0, goal: targets.protein || 150, unit: "g" },
    { label: "Carbs", val: totals.carbs || 0, goal: targets.carbs || 200, unit: "g" },
    { label: "Fat", val: totals.fat || 0, goal: targets.fat || 70, unit: "g" },
  ];

  const grouped = MEAL_ORDER.reduce<Record<MealCategory, NutritionEntry[]>>((acc, meal) => {
    acc[meal] = entries.filter(e => e.meal === meal);
    return acc;
  }, { breakfast: [], lunch: [], dinner: [], snack: [], supplement: [], uncategorized: [] });

  const hydrationL = (hydration / 1000).toFixed(1);
  const stepsK = steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : `${steps}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ backgroundColor: SURFACE, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Daily Breakdown</Text>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* Calories Card */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Calories</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
              {/* Ring placeholder */}
              <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 10, borderColor: "#E5E5EA", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <View style={{ position: "absolute", width: 100, height: 100, borderRadius: 50, borderWidth: 10, borderColor: "transparent", borderTopColor: calColor, borderRightColor: calPct > 0.25 ? calColor : "transparent", borderBottomColor: calPct > 0.5 ? calColor : "transparent", borderLeftColor: calPct > 0.75 ? calColor : "transparent", transform: [{ rotate: "-90deg" }] }} />
                <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>{calRemaining}</Text>
                <Text style={{ fontSize: 9, fontWeight: "700", color: SUBTITLE }}>kcal left</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: SUBTITLE, marginBottom: 2 }}>Consumed</Text>
                <Text style={{ fontSize: 22, fontWeight: "900", color: DARK }}>
                  {Math.round(totals.calories || 0)} <Text style={{ fontSize: 12, color: SUBTITLE }}>/ {targets.calories}</Text>
                </Text>
                {[
                  { label: "Protein", val: totals.protein || 0, goal: targets.protein || 150, color: "#FF6B6B" },
                  { label: "Carbs", val: totals.carbs || 0, goal: targets.carbs || 200, color: "#FF9F43" },
                  { label: "Fat", val: totals.fat || 0, goal: targets.fat || 70, color: "#4FACFE" },
                ].map(({ label, val, goal, color }) => (
                  <View key={label} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ fontSize: 11, color: SUBTITLE }}>{label}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: DARK }}>{Math.round(val)}g / {goal}g</Text>
                    </View>
                    <View style={{ height: 5, borderRadius: 99, backgroundColor: BG }}>
                      <View style={{ width: `${Math.min(val / goal, 1) * 100}%`, height: "100%", backgroundColor: color, borderRadius: 99 }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
            <Pressable onPress={() => router.push("/nutrition-goals" as any)} style={styles.outlineBtn}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: DARK }}>Edit Daily Goals</Text>
            </Pressable>
          </View>

          {/* Health Score */}
          <View style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 6, borderColor: scoreColor + "30", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "900", color: DARK }}>{healthScore}</Text>
                <Text style={{ fontSize: 8, color: SUBTITLE }}>/ 10</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionLabel, { marginBottom: 10 }]}>Health Score</Text>
                {macroChecks.map(({ label, val, goal, unit }) => {
                  const pct = val / goal;
                  const good = pct >= 0.7 && pct <= 1.3;
                  return (
                    <View key={label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: good ? "#34C759" : "#FF3B30" }} />
                        <Text style={{ fontSize: 13, color: DARK, fontWeight: "500" }}>{label}</Text>
                      </View>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE }}>{Math.round(val)}{unit} / {goal}{unit}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Activity row */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { label: "Water", value: `${hydrationL}L`, icon: "water" as ArcIconName, pct: hydration / hydrationGoal, color: "#4FACFE" },
              { label: "Steps", value: stepsK, icon: "steps" as ArcIconName, pct: steps / stepGoal, color: "#FF9F0A" },
              { label: "Sleep", value: sleep ? `${sleep.duration}h` : "—", icon: "sleep" as ArcIconName, pct: sleep ? sleep.duration / sleepGoal : 0, color: "#BF5AF2" },
            ].map(({ label, value, icon, pct, color }) => (
              <View key={label} style={{ flex: 1, backgroundColor: SURFACE, borderRadius: 18, padding: 14, alignItems: "center" }}>
                <View style={{ marginBottom: 6 }}><ArcIcon name={icon} size={22} color={color} /></View>
                <View style={{ height: 4, width: "100%", borderRadius: 99, backgroundColor: BG, marginBottom: 8, overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(pct, 1) * 100}%`, height: "100%", backgroundColor: color, borderRadius: 99 }} />
                </View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: DARK }}>{value}</Text>
                <Text style={{ fontSize: 10, color: SUBTITLE }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Water quick add */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Add Water</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[250, 350, 500, 750].map(ml => (
                <Pressable key={ml} onPress={() => addWater(ml)} disabled={addingWater}
                  style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: "#E5F4F8", alignItems: "center" }}>
                  <Text style={{ color: "#4FACFE", fontWeight: "700", fontSize: 12 }}>{ml}ml</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Meal breakdown */}
          {MEAL_ORDER.map(meal => {
            const mealEntries = grouped[meal];
            if (mealEntries.length === 0) return null;
            const mealCals = mealEntries.reduce((s, e) => s + (e.calories || 0), 0);
            const { label, icon } = MEAL_LABELS[meal];
            return (
              <View key={meal} style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ArcIcon name={icon} size={15} color={DARK} /><Text style={{ fontSize: 15, fontWeight: "800", color: DARK }}>{label}</Text></View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: SUBTITLE }}>{Math.round(mealCals)} kcal</Text>
                </View>
                {mealEntries.map((entry) => (
                  <View key={entry.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: BG }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }} numberOfLines={1}>{entry.food}</Text>
                      <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>P{Math.round(entry.protein || 0)}g · C{Math.round(entry.carbs || 0)}g · F{Math.round(entry.fat || 0)}g</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: DARK }}>{entry.calories} kcal</Text>
                  </View>
                ))}
              </View>
            );
          })}

          {entries.length === 0 && (
            <View style={[styles.card, { alignItems: "center", paddingVertical: 32 }]}>
              <View style={{ marginBottom: 8 }}><ArcIcon name="plate" size={32} color="#C7C7CC" /></View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Nothing logged today</Text>
              <Text style={{ fontSize: 13, color: SUBTITLE, marginTop: 4 }}>Tap + Add on the home screen to log meals</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: SURFACE, borderRadius: 24, padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
  outlineBtn: { width: "100%", padding: 12, borderRadius: 99, borderWidth: 1.5, borderColor: DARK, alignItems: "center", marginTop: 12 },
});
