import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { getSettings } from "@/lib/supabase/queries";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

interface MealItem {
  meal: string;
  food: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const DIET_STYLES: { key: string; label: string; icon: ArcIconName }[] = [
  { key: "balanced", label: "Balanced", icon: "plate" },
  { key: "high_protein", label: "High Protein", icon: "protein" },
  { key: "low_carb", label: "Low Carb", icon: "fat" },
  { key: "vegetarian", label: "Vegetarian", icon: "food" },
  { key: "quick_easy", label: "Quick & Easy", icon: "bolt" },
];

export default function MealPlanScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<MealItem[]>([]);
  const [style, setStyle] = useState("balanced");
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const settings = await getSettings();
      const mt = settings?.macro_targets || settings?.macroTargets || {};
      const goals = {
        calories: mt.calories || 2000,
        protein: mt.protein || 150,
        carbs: mt.carbs || 250,
        fat: mt.fat || 65,
      };

      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          message: `Generate a full day meal plan (breakfast, lunch, dinner, snack) that hits these macro targets: ${goals.calories} cal, ${goals.protein}g protein, ${goals.carbs}g carbs, ${goals.fat}g fat. Style: ${style}. Return ONLY a JSON array of objects with fields: meal, food, calories, protein, carbs, fat. No other text.`,
          history: [],
        }),
      });

      const data = await res.json();
      const text = data.text || "";

      // Try to parse JSON from the response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const meals: MealItem[] = JSON.parse(jsonMatch[0]);
        setPlan(meals);
        const t = meals.reduce((acc, m) => ({
          calories: acc.calories + (m.calories || 0),
          protein: acc.protein + (m.protein || 0),
          carbs: acc.carbs + (m.carbs || 0),
          fat: acc.fat + (m.fat || 0),
        }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
        setTotals(t);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Couldn't parse meal plan", "The AI response wasn't in the expected format. Try again.");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setGenerating(false);
  };

  const logAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const entries = plan.map(m => ({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: today,
      food: m.food,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      fiber: 0,
      meal: m.meal.toLowerCase(),
      serving: "1 serving",
      timestamp: Date.now(),
    }));
    await supabase.from("nutrition_entries").insert(entries);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Logged!", `${entries.length} meals added to today's log.`);
  };

  const MEAL_ICONS: Record<string, ArcIconName> = {
    breakfast: "sun", lunch: "flame", dinner: "moon", snack: "food",
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Meal Plan</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {plan.length === 0 && (
          <>
            <Text style={{ fontSize: 14, color: colors.text2, textAlign: "center", marginBottom: 20 }}>
              AI will generate a full day of meals hitting your macro targets
            </Text>

            <Text style={styles.sectionLabel}>Diet Style</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {DIET_STYLES.map(d => (
                <Pressable key={d.key} onPress={() => setStyle(d.key)} style={[styles.chip, style === d.key && styles.chipActive]}>
                  <ArcIcon name={d.icon} size={16} color={colors.text} />
                  <Text style={[styles.chipText, style === d.key && styles.chipTextActive]}>{d.label}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable style={[styles.generateBtn, generating && { opacity: 0.6 }]} onPress={generate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color={colors.bg} />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.bg }}>Generate Meal Plan</Text>
              )}
            </Pressable>
          </>
        )}

        {plan.length > 0 && (
          <>
            {/* Totals */}
            <View style={[styles.card, { flexDirection: "row", justifyContent: "space-around" }]}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{totals.calories}</Text>
                <Text style={{ fontSize: 10, color: colors.text2 }}>Calories</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{totals.protein}g</Text>
                <Text style={{ fontSize: 10, color: colors.text2 }}>Protein</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{totals.carbs}g</Text>
                <Text style={{ fontSize: 10, color: colors.text2 }}>Carbs</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{totals.fat}g</Text>
                <Text style={{ fontSize: 10, color: colors.text2 }}>Fat</Text>
              </View>
            </View>

            {/* Meals */}
            {plan.map((meal, i) => (
              <View key={i} style={styles.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ArcIcon name={MEAL_ICONS[meal.meal.toLowerCase()] || "plate"} size={24} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: colors.text2, textTransform: "uppercase" }}>{meal.meal}</Text>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 2 }}>{meal.food}</Text>
                    <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>
                      {meal.calories} cal · {meal.protein}g P · {meal.carbs}g C · {meal.fat}g F
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable style={[styles.generateBtn, { flex: 1 }]} onPress={logAll}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.bg }}>Log All Meals</Text>
              </Pressable>
              <Pressable style={[styles.regenBtn, { flex: 1 }]} onPress={() => { setPlan([]); setTotals({ calories: 0, protein: 0, carbs: 0, fat: 0 }); }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Regenerate</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.bg },
  generateBtn: { backgroundColor: colors.text, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
  regenBtn: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center" },
});
