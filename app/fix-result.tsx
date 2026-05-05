import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { format } from "date-fns";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack";

const today = format(new Date(), "yyyy-MM-dd");

export default function FixResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ food?: string; calories?: string; protein?: string; carbs?: string; fat?: string; fiber?: string }>();

  const [food, setFood] = useState(params.food || "");
  const [calories, setCalories] = useState(params.calories || "");
  const [protein, setProtein] = useState(params.protein || "");
  const [carbs, setCarbs] = useState(params.carbs || "");
  const [fat, setFat] = useState(params.fat || "");
  const [fiber, setFiber] = useState(params.fiber || "");
  const [meal, setMeal] = useState<MealCategory>("snack");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!food.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("nutrition_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: session.user.id,
        date: today,
        timestamp: Date.now(),
        food,
        meal,
        amount: "1 serving",
        calories: parseFloat(calories) || 0,
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        fiber: parseFloat(fiber) || 0,
        source: "manual",
      });
      router.back();
    } finally { setSaving(false); }
  };

  const macroFields = [
    { label: "Calories (kcal)", value: calories, set: setCalories },
    { label: "Protein (g)", value: protein, set: setProtein },
    { label: "Carbs (g)", value: carbs, set: setCarbs },
    { label: "Fat (g)", value: fat, set: setFat },
    { label: "Fiber (g)", value: fiber, set: setFiber },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Fix Result</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Food Details</Text>

          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>Food Name</Text>
            <TextInput
              placeholder="e.g. Grilled Chicken Breast"
              placeholderTextColor="#C7C7CC"
              value={food}
              onChangeText={setFood}
              style={styles.input}
            />
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {macroFields.map(({ label, value, set }) => (
              <View key={label} style={{ width: "47%" }}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  placeholder="0"
                  placeholderTextColor="#C7C7CC"
                  value={value}
                  onChangeText={set}
                  keyboardType="numeric"
                  style={styles.input}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Meal picker */}
        <View>
          <Text style={[styles.sectionLabel, { marginLeft: 4, marginBottom: 10 }]}>Meal</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["breakfast", "lunch", "dinner", "snack"] as MealCategory[]).map(m => (
              <Pressable key={m} onPress={() => setMeal(m)}
                style={[styles.mealChip, { backgroundColor: meal === m ? DARK : "white" }]}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: meal === m ? "white" : SUBTITLE }}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          onPress={save}
          disabled={saving || !food.trim()}
          style={[styles.saveBtn, { backgroundColor: food.trim() ? "#007AFF" : "#C7C7CC", opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>
            {saving ? "Saving..." : "Save Entry"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "white", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900", color: "#1C1C1E" },
  card: { backgroundColor: "white", borderRadius: 20, padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  input: { backgroundColor: "#F2F2F7", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: "600", color: "#1C1C1E" },
  mealChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 99 },
  saveBtn: { borderRadius: 18, padding: 16, alignItems: "center" },
});
