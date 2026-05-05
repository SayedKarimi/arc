import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@/lib/storage";
import { supabase } from "@/lib/supabase/client";
import { getSettings, updateSettings } from "@/lib/supabase/queries";
import { apiUrl } from "@/lib/api";
import { ArcIcon } from "@/components/ArcIcon";
import { format, subDays } from "date-fns";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack" | "supplement";
type Tab = "all" | "my-foods" | "my-meals" | "saved";

interface FoodResult {
  name: string; brand: string; serving: string; servingGrams: number;
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
  source: string;
}

const MEALS: { key: MealCategory; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snack" },
  { key: "supplement", label: "Supplement" },
];

const SUGGESTIONS: FoodResult[] = [
  { name: "Peanut Butter", brand: "Generic", serving: "1 tbsp", servingGrams: 16, calories: 94, protein: 4, carbs: 3, fat: 8, fiber: 1, source: "search" },
  { name: "Avocado", brand: "Generic", serving: "1 serving", servingGrams: 100, calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, source: "search" },
  { name: "Egg", brand: "Generic", serving: "1 large", servingGrams: 50, calories: 74, protein: 6, carbs: 1, fat: 5, fiber: 0, source: "search" },
  { name: "Banana", brand: "Generic", serving: "1 medium", servingGrams: 118, calories: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, source: "search" },
  { name: "Chicken Breast", brand: "Generic", serving: "100g", servingGrams: 100, calories: 165, protein: 31, carbs: 0, fat: 4, fiber: 0, source: "search" },
];

const today = format(new Date(), "yyyy-MM-dd");

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "my-foods", label: "My foods" },
  { key: "my-meals", label: "My meals" },
  { key: "saved", label: "Saved foods" },
];

export default function LogFoodScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [meal, setMeal] = useState<MealCategory>("snack");
  const [loggedIdx, setLoggedIdx] = useState<Set<number>>(new Set());
  const [templates, setTemplates] = useState<Record<string, any[]>>({});
  const [recentFoods, setRecentFoods] = useState<FoodResult[]>([]);
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ food: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" });
  const [saving, setSaving] = useState(false);
  const searchTimeout = useRef<any>(null);

  useEffect(() => {
    loadTemplates();
    loadRecentFoods();
  }, []);

  const loadTemplates = async () => {
    try {
      const saved = await AsyncStorage.getItem("mealTemplates");
      if (saved) setTemplates(JSON.parse(saved));
    } catch {}
  };

  const loadRecentFoods = async () => {
    try {
      const s = await getSettings();
      if ((s as any).recentFoods) {
        const all: FoodResult[] = Object.values((s as any).recentFoods || {}).flat() as FoodResult[];
        const seen = new Set<string>();
        setRecentFoods(all.filter(f => { const k = f.name; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20));
      }
    } catch {}
  };

  const search = async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(apiUrl("/api/nutrition/search?q=" + encodeURIComponent(q)));
      const data = await res.json();
      setResults(data.foods || []);
    } catch { setResults([]); }
    finally { setSearching(false); }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => search(val), 300);
  };

  const logFood = async (food: FoodResult, idx: number) => {
    setLoggedIdx(prev => { const s = new Set(prev); s.add(idx); return s; });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("nutrition_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: session.user.id,
        date: today, timestamp: Date.now(),
        food: food.name, amount: food.serving, meal,
        calories: Math.round(food.calories),
        protein: Math.round(food.protein * 10) / 10,
        carbs: Math.round(food.carbs * 10) / 10,
        fat: Math.round(food.fat * 10) / 10,
        fiber: Math.round(food.fiber * 10) / 10,
        source: "search",
      });
      try {
        const s = await getSettings();
        const existing = ((s as any).recentFoods || {}) as Record<string, FoodResult[]>;
        const mealList = existing[meal] || [];
        const updated = [food, ...mealList.filter((f: FoodResult) => f.name !== food.name)].slice(0, 8);
        await updateSettings({ ...s, recentFoods: { ...existing, [meal]: updated } } as any);
      } catch {}
    } catch {
      setLoggedIdx(prev => { const next = new Set(prev); next.delete(idx); return next; });
    }
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
          name: parsed.name || query, brand: "AI Estimate",
          serving: parsed.serving || "1 serving", servingGrams: 100,
          calories: parsed.calories || 0, protein: parsed.protein || 0,
          carbs: parsed.carbs || 0, fat: parsed.fat || 0, fiber: parsed.fiber || 0,
          source: "search",
        };
        setResults([aiResult, ...results]);
      }
    } catch {}
    finally { setGeneratingAI(false); }
  };

  const saveManual = async () => {
    if (!manual.food.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.from("nutrition_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: session.user.id,
        date: today, timestamp: Date.now(),
        food: manual.food, amount: "custom", meal,
        calories: parseFloat(manual.calories) || 0,
        protein: parseFloat(manual.protein) || 0,
        carbs: parseFloat(manual.carbs) || 0,
        fat: parseFloat(manual.fat) || 0,
        fiber: parseFloat(manual.fiber) || 0,
        source: "manual",
      });
      router.back();
    } finally { setSaving(false); }
  };

  const copyYesterday = async () => {
    setCopyingYesterday(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
      const { data: yEntries } = await supabase.from("nutrition_entries")
        .select("*").eq("user_id", session.user.id).eq("date", yesterday);
      if (yEntries && yEntries.length > 0) {
        for (const e of yEntries as any[]) {
          const { id: _id, ...rest } = e;
          await supabase.from("nutrition_entries").insert({ ...rest, id: Math.random().toString(36).slice(2), date: today, timestamp: Date.now() });
        }
        router.back();
      }
    } finally { setCopyingYesterday(false); }
  };

  const loadTemplate = async (name: string) => {
    const tmpl = templates[name];
    if (!tmpl) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    for (const e of tmpl) {
      await supabase.from("nutrition_entries").insert({ ...e, user_id: session.user.id, id: Math.random().toString(36).slice(2), date: today, timestamp: Date.now() });
    }
    router.back();
  };

  const displayList = query.length >= 2 ? results : SUGGESTIONS;
  const sectionHeader = query.length >= 2 ? "Select from database" : "Suggestions";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ backgroundColor: "white" }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ flex: 1, fontSize: 20, fontWeight: "700", color: DARK }}>Log Food</Text>
          <Pressable onPress={() => router.push("/scan" as any)} style={styles.backBtn}>
            <ArcIcon name="camera" size={16} color={DARK} />
          </Pressable>
        </View>

        {/* Search */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <View style={styles.searchBox}>
            <ArcIcon name="search" size={16} color={SUBTITLE} />
            <TextInput
              placeholder="Describe what you ate"
              placeholderTextColor="#C7C7CC"
              value={query}
              onChangeText={handleQueryChange}
              autoFocus
              style={styles.searchInput}
            />
            {!!query && (
              <Pressable onPress={() => { setQuery(""); setResults([]); }} style={styles.clearBtn}>
                <Text style={{ color: "white", fontSize: 12 }}>×</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 24, paddingBottom: 0 }}>
          {TABS.map(({ key, label }) => (
            <Pressable key={key} onPress={() => setTab(key)}
              style={{ paddingBottom: 10, borderBottomWidth: 2, borderBottomColor: tab === key ? DARK : "transparent" }}>
              <Text style={{ fontSize: 14, fontWeight: tab === key ? "700" : "400", color: tab === key ? DARK : SUBTITLE }}>{label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Meal selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 6 }}>
          {MEALS.map(m => (
            <Pressable key={m.key} onPress={() => setMeal(m.key)}
              style={[styles.mealChip, { backgroundColor: meal === m.key ? DARK : BG }]}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: meal === m.key ? "white" : SUBTITLE }}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* AI Generate */}
        {query.length >= 2 && (
          <Pressable onPress={generateWithAI} disabled={generatingAI}
            style={styles.aiBtn}>
            <ArcIcon name={generatingAI ? "timer" : "sparkle"} size={15} color={DARK} />
            <Text style={{ fontSize: 14, fontWeight: "500", color: DARK }}>
              {generatingAI ? "Generating..." : "Generate results using AI"}
            </Text>
          </Pressable>
        )}

        {/* All tab */}
        {tab === "all" && (
          <>
            {searching && <ActivityIndicator style={{ marginTop: 20 }} color={DARK} />}
            {!searching && (
              <>
                <Text style={{ fontSize: 15, fontWeight: "700", color: DARK, marginBottom: 10 }}>{sectionHeader}</Text>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {displayList.map((food, idx) => {
                    const isLogged = loggedIdx.has(idx);
                    return (
                      <View key={idx} style={styles.foodRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }} numberOfLines={1}>{food.name}</Text>
                          <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>
                            {food.calories} cal{food.brand && food.brand !== "Generic" ? ` · ${food.brand}` : ""} · {food.serving}
                          </Text>
                        </View>
                        <Pressable onPress={() => !isLogged && logFood(food, idx)}
                          style={[styles.addBtn, { backgroundColor: isLogged ? DARK : "transparent" }]}>
                          <Text style={{ fontSize: 22, color: isLogged ? "white" : DARK }}>{isLogged ? "✓" : "+"}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
            {/* Copy Yesterday */}
            {!query && (
              <Pressable onPress={copyYesterday} disabled={copyingYesterday} style={styles.copyBtn}>
                <ArcIcon name="plans" size={18} color={DARK} />
                <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>
                  {copyingYesterday ? "Copying..." : "Copy Yesterday's Meals"}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {/* My Meals tab */}
        {tab === "my-meals" && (
          <>
            {Object.keys(templates).length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <View style={{ marginBottom: 12 }}><ArcIcon name="plate" size={40} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 8 }}>My Meals</Text>
                <Text style={{ fontSize: 14, color: SUBTITLE, marginBottom: 24 }}>Quickly log your go-to meal combinations.</Text>
                <Pressable onPress={() => router.push("/create-meal" as any)} style={styles.createBtn}>
                  <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>Create meal</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={{ gap: 8, marginBottom: 16 }}>
                  {Object.keys(templates).map(name => (
                    <View key={name} style={styles.foodRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>{name} · {templates[name].length} items</Text>
                        <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>
                          {templates[name].reduce((s: number, e: any) => s + (e.calories || 0), 0)} cal
                        </Text>
                      </View>
                      <Pressable onPress={() => loadTemplate(name)} style={styles.addBtn}>
                        <Text style={{ fontSize: 22, color: DARK }}>+</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Pressable onPress={() => router.push("/create-meal" as any)}
                  style={{ padding: 14, borderRadius: 99, backgroundColor: "white", borderWidth: 1, borderColor: "#E5E5EA", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>Create meal</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {/* My Foods tab */}
        {tab === "my-foods" && (
          <>
            {recentFoods.length === 0 ? (
              <View style={{ alignItems: "center", paddingTop: 60 }}>
                <View style={{ marginBottom: 12 }}><ArcIcon name="plate" size={40} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 8 }}>My Foods</Text>
                <Text style={{ fontSize: 14, color: SUBTITLE, marginBottom: 24 }}>Add a custom food to your personal list.</Text>
                <Pressable onPress={() => setShowManual(true)} style={styles.createBtn}>
                  <Text style={{ color: "white", fontSize: 15, fontWeight: "600" }}>Add food</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {recentFoods.map((food, idx) => (
                  <View key={idx} style={styles.foodRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>{food.name}</Text>
                      <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>{food.calories} cal</Text>
                    </View>
                    <Pressable onPress={() => logFood(food, 1000 + idx)} style={styles.addBtn}>
                      <Text style={{ fontSize: 22, color: DARK }}>+</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Saved Foods tab */}
        {tab === "saved" && (
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <View style={{ width: 80, height: 80, backgroundColor: BG, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <ArcIcon name="bookmark" size={36} color="#C7C7CC" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 8 }}>No saved foods yet</Text>
            <Text style={{ fontSize: 14, color: SUBTITLE }}>Tap the bookmark on any logged food to save here.</Text>
          </View>
        )}

        {/* Manual form */}
        {showManual && (
          <View style={styles.manualCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: DARK }}>Manual Entry</Text>
              <Pressable onPress={() => setShowManual(false)}>
                <Text style={{ color: SUBTITLE, fontSize: 22 }}>×</Text>
              </Pressable>
            </View>
            <TextInput placeholder="Food name *" placeholderTextColor="#C7C7CC" value={manual.food}
              onChangeText={v => setManual(p => ({ ...p, food: v }))} style={[styles.manualInput, { marginBottom: 10 }]} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["calories", "protein", "carbs", "fat", "fiber"] as const).map(key => (
                <View key={key} style={{ width: "47%" }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{key}</Text>
                  <TextInput placeholder="0" placeholderTextColor="#C7C7CC" keyboardType="numeric"
                    value={(manual as any)[key]} onChangeText={v => setManual(p => ({ ...p, [key]: v }))} style={styles.manualInput} />
                </View>
              ))}
            </View>
            <Pressable onPress={saveManual} disabled={saving || !manual.food.trim()}
              style={[styles.createBtn, { marginTop: 12, opacity: !manual.food.trim() ? 0.5 : 1 }]}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>{saving ? "Adding..." : "Add Food"}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <Pressable onPress={() => setShowManual(true)} style={styles.bottomBtn}>
          <ArcIcon name="plans" size={14} color={DARK} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>Manual Add</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/scan" as any)} style={styles.bottomBtn}>
          <ArcIcon name="mic" size={14} color={DARK} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>Voice Log</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#1C1C1E", borderRadius: 14, backgroundColor: "white", paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  searchInput: { flex: 1, fontSize: 15, color: "#1C1C1E" },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#C7C7CC", alignItems: "center", justifyContent: "center" },
  mealChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99 },
  aiBtn: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E5EA", borderRadius: 14, padding: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  foodRow: { backgroundColor: "#F2F2F7", borderRadius: 14, padding: 13, flexDirection: "row", alignItems: "center" },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  copyBtn: { backgroundColor: "white", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  createBtn: { backgroundColor: "#1C1C1E", borderRadius: 99, paddingHorizontal: 32, paddingVertical: 14, alignItems: "center", width: "100%" },
  manualCard: { backgroundColor: "white", borderRadius: 20, padding: 20, marginTop: 16 },
  manualInput: { backgroundColor: "#F2F2F7", borderRadius: 12, padding: 12, fontSize: 14, fontWeight: "600", color: "#1C1C1E" },
  bottomBar: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#F2F2F7", paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, flexDirection: "row", gap: 12 },
  bottomBtn: { flex: 1, padding: 12, borderRadius: 99, borderWidth: 1.5, borderColor: "#E5E5EA", backgroundColor: "white", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
});
