import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, subDays } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SURFACE = "#FFFFFF";
const BORDER = "#E5E5EA";
const SUBTITLE = "#8E8E93";
const TEXT3 = "#C7C7CC";

interface FoodResult {
  name: string; brand: string; serving: string; servingGrams: number;
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
}

type Tab = "all" | "my-foods" | "my-meals" | "saved";
type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "supplement";

const MEALS: { key: MealCategory; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
  { key: "supplement", label: "Supplement" },
];

const SUGGESTIONS: FoodResult[] = [
  { name: "Peanut Butter", brand: "Generic", serving: "1 tbsp", servingGrams: 16, calories: 94, protein: 4, carbs: 3, fat: 8, fiber: 1 },
  { name: "Avocado", brand: "Generic", serving: "1 serving", servingGrams: 100, calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7 },
  { name: "Egg", brand: "Generic", serving: "1 large", servingGrams: 50, calories: 74, protein: 6, carbs: 1, fat: 5, fiber: 0 },
  { name: "Banana", brand: "Generic", serving: "1 medium", servingGrams: 118, calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3 },
  { name: "Chicken Breast", brand: "Generic", serving: "100g", servingGrams: 100, calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0 },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "my-foods", label: "My foods" },
  { key: "my-meals", label: "My meals" },
  { key: "saved", label: "Saved foods" },
];

export default function FoodSearchScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [meal, setMeal] = useState<MealCategory>("snack");
  const [loggedIdx, setLoggedIdx] = useState<Set<number>>(new Set());
  const [recentFoods, setRecentFoods] = useState<FoodResult[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ food: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const [saving, setSaving] = useState(false);
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    loadRecents();
  }, []);

  const loadRecents = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: settings } = await supabase.from("user_settings").select("recentFoods").eq("user_id", user.id).single();
    if (settings?.recentFoods) {
      const all = Object.values(settings.recentFoods).flat() as FoodResult[];
      const seen = new Set<string>();
      setRecentFoods(all.filter(f => { const k = f.name; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20));
    }
  };

  const searchFoods = async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(apiUrl(`/api/nutrition/search?q=${encodeURIComponent(q)}`));
      const data = await res.json();
      setResults(data.foods || []);
    } catch { setResults([]); }
    setSearching(false);
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchFoods(val), 300);
  };

  const logFood = async (food: FoodResult, idx: number) => {
    setLoggedIdx(prev => { const s = new Set(prev); s.add(idx); return s; });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("nutrition_entries").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: today,
      timestamp: Date.now(),
      food: food.name,
      amount: food.serving,
      meal,
      calories: Math.round(food.calories),
      protein: Math.round(food.protein * 10) / 10,
      carbs: Math.round(food.carbs * 10) / 10,
      fat: Math.round(food.fat * 10) / 10,
      fiber: Math.round(food.fiber * 10) / 10,
      source: "search",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const generateWithAI = async () => {
    if (!query.trim()) return;
    setGeneratingAI(true);
    try {
      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Log this food: "${query}". Estimate the calories and macros for a standard serving. Return a JSON object with: name, calories, protein, carbs, fat, fiber, serving.`,
        }),
      });
      const data = await res.json();
      const text: string = data.response ?? data.message ?? JSON.stringify(data);
      const match = text.match(/\{[\s\S]*?\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        const aiResult: FoodResult = {
          name: parsed.name || query,
          brand: "AI Estimate",
          serving: parsed.serving || "1 serving",
          servingGrams: 100,
          calories: parsed.calories || 0,
          protein: parsed.protein || 0,
          carbs: parsed.carbs || 0,
          fat: parsed.fat || 0,
          fiber: parsed.fiber || 0,
        };
        setResults([aiResult, ...results]);
      }
    } catch {}
    setGeneratingAI(false);
  };

  const saveManual = async () => {
    if (!manual.food.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("nutrition_entries").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: today,
      timestamp: Date.now(),
      food: manual.food,
      amount: "custom",
      meal,
      calories: parseFloat(manual.calories) || 0,
      protein: parseFloat(manual.protein) || 0,
      carbs: parseFloat(manual.carbs) || 0,
      fat: parseFloat(manual.fat) || 0,
      fiber: parseFloat(manual.fiber) || 0,
      source: "manual",
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaving(false);
    router.back();
  };

  const copyYesterday = async () => {
    setCopyingYesterday(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: yEntries } = await supabase.from("nutrition_entries")
        .select("*").eq("user_id", user.id).eq("date", yesterday);
      if (yEntries && yEntries.length > 0) {
        for (const e of yEntries) {
          const { id: _id, ...rest } = e;
          await supabase.from("nutrition_entries").insert({ ...rest, id: Math.random().toString(36).slice(2), date: today, timestamp: Date.now() });
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      } else {
        Alert.alert("No Entries", "No food entries found for yesterday.");
      }
    } catch {}
    setCopyingYesterday(false);
  };

  const displayList = query.length >= 2 ? results : SUGGESTIONS;
  const sectionHeader = query.length >= 2 ? "Select from database" : "Suggestions";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ backgroundColor: SURFACE }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "700", color: DARK, flex: 1 }}>Log Food</Text>
          <Pressable onPress={() => router.push("/scan" as any)} style={styles.headerBtn}>
            <ArcIcon name="camera" size={16} color={DARK} />
          </Pressable>
        </View>

        {/* Search box */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={styles.searchBox}>
            <ArcIcon name="search" size={16} color={SUBTITLE} />
            <TextInput
              placeholder="Describe what you ate"
              placeholderTextColor={SUBTITLE}
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              style={{ flex: 1, fontSize: 15, color: DARK }}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => { setQuery(""); setResults([]); }} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: TEXT3, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "white", fontSize: 12, marginTop: -1 }}>×</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: BG }}>
          {TABS.map(({ key, label }) => (
            <Pressable key={key} onPress={() => setTab(key)} style={{ paddingVertical: 10, paddingHorizontal: 4, marginRight: 24, borderBottomWidth: 2, borderBottomColor: tab === key ? DARK : "transparent" }}>
              <Text style={{ fontSize: 14, fontWeight: tab === key ? "700" : "400", color: tab === key ? DARK : SUBTITLE }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {/* Meal selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, maxHeight: 34 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {MEALS.map(m => (
              <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.mealPill, meal === m.key && { backgroundColor: DARK }]}>
                <Text style={[{ fontSize: 12, fontWeight: "700", color: SUBTITLE }, meal === m.key && { color: "white" }]}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* AI Generate button */}
        {query.length >= 2 && tab === "all" && (
          <Pressable onPress={generateWithAI} disabled={generatingAI} style={styles.aiBtn}>
            <ArcIcon name={generatingAI ? "timer" : "sparkle"} size={15} color={DARK} />
            <Text style={{ fontSize: 14, fontWeight: "500", color: DARK }}>{generatingAI ? "Generating..." : "Generate results using AI"}</Text>
          </Pressable>
        )}

        {/* ALL tab */}
        {tab === "all" && (
          <>
            {searching && <ActivityIndicator size="large" color={DARK} style={{ marginTop: 20 }} />}
            {!searching && (
              <>
                <Text style={{ fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 10 }}>{sectionHeader}</Text>
                {displayList.map((food, idx) => {
                  const isLogged = loggedIdx.has(idx);
                  return (
                    <View key={idx} style={styles.foodRow}>
                      <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }} numberOfLines={1}>{food.name}</Text>
                        <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>
                          {food.calories} cal{food.brand && food.brand !== "Generic" ? ` · ${food.brand}` : ""} · {food.serving}
                        </Text>
                      </View>
                      <Pressable onPress={() => !isLogged && logFood(food, idx)} style={[styles.addBtn, isLogged && { backgroundColor: DARK }]}>
                        <Text style={{ fontSize: 22, color: isLogged ? "white" : DARK }}>{isLogged ? "✓" : "+"}</Text>
                      </Pressable>
                    </View>
                  );
                })}

                {/* Copy Yesterday */}
                {!query && (
                  <Pressable onPress={copyYesterday} disabled={copyingYesterday} style={styles.copyBtn}>
                    <ArcIcon name="plans" size={18} color={DARK} />
                    <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{copyingYesterday ? "Copying..." : "Copy Yesterday's Meals"}</Text>
                  </Pressable>
                )}
              </>
            )}
          </>
        )}

        {/* MY FOODS tab */}
        {tab === "my-foods" && (
          <>
            {recentFoods.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <View style={{ marginBottom: 12 }}><ArcIcon name="plate" size={40} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: DARK }}>My Foods</Text>
                <Text style={{ fontSize: 14, color: SUBTITLE, marginTop: 8, marginBottom: 24 }}>Add a custom food to your personal list.</Text>
                <Pressable onPress={() => setShowManual(true)} style={styles.darkBtn}>
                  <Text style={{ color: "white", fontWeight: "600", fontSize: 15 }}>Add food</Text>
                </Pressable>
              </View>
            ) : (
              recentFoods.map((food, idx) => (
                <View key={idx} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>{food.name}{food.brand && food.brand !== "Generic" ? ` · ${food.brand}` : ""}</Text>
                    <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>{food.calories} cal</Text>
                  </View>
                  <Pressable onPress={() => logFood(food, 1000 + idx)} style={styles.addBtn}>
                    <Text style={{ fontSize: 22, color: DARK }}>+</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {/* MY MEALS tab */}
        {tab === "my-meals" && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ marginBottom: 12 }}><ArcIcon name="plate" size={40} color="#C7C7CC" /></View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: DARK }}>My Meals</Text>
            <Text style={{ fontSize: 14, color: SUBTITLE, marginTop: 8 }}>Quickly log your go-to meal combinations.</Text>
          </View>
        )}

        {/* SAVED tab */}
        {tab === "saved" && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ width: 80, height: 80, backgroundColor: BG, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <ArcIcon name="bookmark" size={36} color="#C7C7CC" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: DARK }}>No saved foods yet</Text>
            <Text style={{ fontSize: 14, color: SUBTITLE, marginTop: 8 }}>Tap the bookmark on any logged food to save here.</Text>
          </View>
        )}

        {/* Manual entry form */}
        {showManual && (
          <View style={styles.manualCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: DARK }}>Manual Entry</Text>
              <Pressable onPress={() => setShowManual(false)}>
                <Text style={{ fontSize: 22, color: SUBTITLE }}>×</Text>
              </Pressable>
            </View>
            <TextInput placeholder="Food name *" placeholderTextColor={TEXT3} value={manual.food} onChangeText={v => setManual(p => ({ ...p, food: v }))} style={[styles.manualInput, { marginBottom: 10 }]} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["calories", "protein", "carbs", "fat", "fiber"] as const).map(key => (
                <View key={key} style={{ width: "48%" }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{key}</Text>
                  <TextInput placeholder="0" placeholderTextColor={TEXT3} value={(manual as any)[key]} onChangeText={v => setManual(p => ({ ...p, [key]: v }))} keyboardType="numeric" style={styles.manualInput} />
                </View>
              ))}
            </View>
            <Pressable onPress={saveManual} disabled={saving || !manual.food.trim()} style={[styles.darkBtn, { marginTop: 12 }, !manual.food.trim() && { backgroundColor: TEXT3 }]}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>{saving ? "Adding..." : "Add Food"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.bottomBar}>
        <Pressable onPress={() => setShowManual(true)} style={styles.bottomBtn}>
          <ArcIcon name="plans" size={14} color={DARK} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>Manual Add</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/chat" as any)} style={styles.bottomBtn}>
          <ArcIcon name="mic" size={14} color={DARK} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>Voice Log</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: DARK, borderRadius: 14, backgroundColor: SURFACE, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  mealPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, backgroundColor: BG },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 12, marginBottom: 12 },
  foodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: BG, borderRadius: 14, padding: 13, paddingHorizontal: 14, marginBottom: 8 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: SURFACE, borderRadius: 14, padding: 12, paddingHorizontal: 16, marginTop: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  darkBtn: { backgroundColor: DARK, borderRadius: 99, padding: 14, alignItems: "center" },
  manualCard: { backgroundColor: SURFACE, borderRadius: 20, padding: 20, marginTop: 16 },
  manualInput: { backgroundColor: BG, borderRadius: 12, padding: 12, paddingHorizontal: 14, fontSize: 14, fontWeight: "600", color: DARK },
  bottomBar: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: BG, backgroundColor: SURFACE },
  bottomBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 12, borderRadius: 99, borderWidth: 1.5, borderColor: BORDER, backgroundColor: SURFACE },
});
