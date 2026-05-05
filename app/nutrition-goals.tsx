import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

interface MacroTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
}

const DEFAULTS: MacroTargets = { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50, sodium: 2300 };

const MAIN_ROWS = [
  { key: "calories" as keyof MacroTargets, label: "Daily Calories", unit: "kcal", color: "#1C1C1E", icon: "flame" as ArcIconName },
  { key: "protein" as keyof MacroTargets, label: "Protein", unit: "g", color: "#FF6B6B", icon: "protein" as ArcIconName },
  { key: "carbs" as keyof MacroTargets, label: "Carbohydrates", unit: "g", color: "#FF9F43", icon: "carbs" as ArcIconName },
  { key: "fat" as keyof MacroTargets, label: "Fat", unit: "g", color: "#4FACFE", icon: "fat" as ArcIconName },
];

const MICRO_ROWS = [
  { key: "fiber" as keyof MacroTargets, label: "Fiber", unit: "g", color: "#34C759", icon: "fiber" as ArcIconName },
  { key: "sugar" as keyof MacroTargets, label: "Sugar", unit: "g", color: "#FF9F43", icon: "sugar" as ArcIconName },
  { key: "sodium" as keyof MacroTargets, label: "Sodium", unit: "mg", color: "#8E8E93", icon: "sodium" as ArcIconName },
];

export default function NutritionGoalsScreen() {
  const router = useRouter();
  const [goals, setGoals] = useState<MacroTargets>({ ...DEFAULTS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");
  const [showMicro, setShowMicro] = useState(false);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: settings } = await supabase
      .from("user_settings")
      .select("macro_targets")
      .eq("user_id", user.id)
      .single();
    if (settings?.macro_targets) {
      const mt = settings.macro_targets as any;
      setGoals({
        calories: mt.calories ?? DEFAULTS.calories,
        protein: mt.protein ?? DEFAULTS.protein,
        carbs: mt.carbs ?? DEFAULTS.carbs,
        fat: mt.fat ?? DEFAULTS.fat,
        fiber: mt.fiber ?? DEFAULTS.fiber,
        sugar: mt.sugar ?? DEFAULTS.sugar,
        sodium: mt.sodium ?? DEFAULTS.sodium,
      });
    }
    setLoading(false);
  };

  const handleChange = (key: keyof MacroTargets, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      setGoals(prev => ({ ...prev, [key]: num }));
    } else if (value === "") {
      setGoals(prev => ({ ...prev, [key]: 0 }));
    }
  };

  const handleAutoGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not signed in");
      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          message: "Based on my body stats, goal, and activity, generate optimal macro targets for me. Return a macro_targets_update action with the values.",
          history: [],
        }),
      });
      if (!res.ok) throw new Error("Agent request failed");
      const data = await res.json();
      const macroAction = (data.actions || []).find((a: any) => a.type === "macro_targets_update");
      if (macroAction?.data) {
        const p = macroAction.data;
        setGoals(prev => ({
          ...prev,
          calories: p.calories ?? prev.calories,
          protein: p.protein ?? prev.protein,
          carbs: p.carbs ?? prev.carbs,
          fat: p.fat ?? prev.fat,
          fiber: p.fiber ?? prev.fiber,
        }));
      } else {
        const text: string = data.text ?? "";
        const stripped = text.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "");
        const match = stripped.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]) as Partial<MacroTargets>;
          setGoals(prev => ({
            ...prev,
            calories: parsed.calories ?? prev.calories,
            protein: parsed.protein ?? prev.protein,
            carbs: parsed.carbs ?? prev.carbs,
            fat: parsed.fat ?? prev.fat,
            fiber: parsed.fiber ?? prev.fiber,
          }));
        } else {
          throw new Error("Could not parse macro targets from AI response");
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate targets");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedOk(false);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await supabase.from("user_settings").upsert({
        user_id: user.id,
        macro_targets: goals,
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  const renderRow = (row: typeof MAIN_ROWS[0], isFirst: boolean) => (
    <View key={row.key} style={[styles.macroRow, !isFirst && { borderTopWidth: 1, borderTopColor: BG }]}>
      <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: row.color + "30", alignItems: "center", justifyContent: "center" }}>
        <ArcIcon name={row.icon} size={12} color={row.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: DARK, fontWeight: "600" }}>{row.label}</Text>
        <Text style={{ fontSize: 12, color: SUBTITLE }}>{row.unit}</Text>
      </View>
      <TextInput
        value={goals[row.key] ? String(goals[row.key]) : ""}
        onChangeText={(v) => handleChange(row.key, v)}
        keyboardType="numeric"
        style={{ width: 80, textAlign: "right", fontSize: 17, fontWeight: "700", color: DARK, padding: 0 }}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ backgroundColor: SURFACE, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Nutrition Goals</Text>
        </View>

        <View style={{ padding: 16 }}>
          {/* Main Rows */}
          <View style={styles.card}>
            {MAIN_ROWS.map((row, i) => renderRow(row, i === 0))}

            {/* Micronutrients toggle */}
            <Pressable onPress={() => setShowMicro(v => !v)}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 13, borderTopWidth: 1, borderTopColor: BG }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: SUBTITLE }}>View micronutrients</Text>
              <Text style={{ fontSize: 18, color: "#C7C7CC" }}>{showMicro ? "∧" : "∨"}</Text>
            </Pressable>

            {showMicro && MICRO_ROWS.map((row) => renderRow(row as any, false))}
          </View>

          {error ? (
            <View style={{ backgroundColor: "#FF3B3015", borderWidth: 1, borderColor: "#FF3B3040", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ color: "#FF3B30", fontSize: 14 }}>{error}</Text>
            </View>
          ) : null}

          {/* Auto Generate */}
          <Pressable onPress={handleAutoGenerate} disabled={generating}
            style={[styles.outlineBtn, generating && { opacity: 0.5 }]}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>
              {generating ? "Generating..." : "Auto Generate Goals"}
            </Text>
          </Pressable>

          {/* Save */}
          <Pressable onPress={handleSave} disabled={saving}
            style={[styles.saveBtn, { backgroundColor: savedOk ? "#34C759" : DARK, opacity: saving ? 0.7 : 1 }]}>
            <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>
              {saving ? "Saving..." : savedOk ? "Saved ✓" : "Save Goals"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: SURFACE, borderRadius: 20, overflow: "hidden", marginBottom: 12, paddingHorizontal: 16 },
  macroRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  outlineBtn: { width: "100%", padding: 14, borderRadius: 99, borderWidth: 1.5, borderColor: DARK, alignItems: "center", marginBottom: 12 },
  saveBtn: { width: "100%", padding: 16, borderRadius: 20, alignItems: "center" },
});
