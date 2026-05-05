import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@/lib/storage";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

interface Item {
  food: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const emptyItem = (): Item => ({ food: "", calories: "", protein: "", carbs: "", fat: "" });

export default function CreateMealScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Item>(emptyItem());
  const [showAdd, setShowAdd] = useState(false);

  const addItem = () => {
    if (!draft.food.trim()) return;
    setItems(p => [...p, { ...draft }]);
    setDraft(emptyItem());
    setShowAdd(false);
  };

  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!name.trim() || items.length === 0) return;
    const raw = await AsyncStorage.getItem("mealTemplates");
    const saved = raw ? JSON.parse(raw) : {};
    saved[name.trim()] = items.map(it => ({
      food: it.food,
      calories: parseFloat(it.calories) || 0,
      protein: parseFloat(it.protein) || 0,
      carbs: parseFloat(it.carbs) || 0,
      fat: parseFloat(it.fat) || 0,
      fiber: 0,
      meal: "snack",
    }));
    await AsyncStorage.setItem("mealTemplates", JSON.stringify(saved));
    router.back();
  };

  const totalCals = items.reduce((s, i) => s + (parseFloat(i.calories) || 0), 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ backgroundColor: SURFACE, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Create Meal</Text>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* Meal name */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Meal Name</Text>
            <TextInput
              placeholder="e.g. My High Protein Breakfast"
              placeholderTextColor="#C7C7CC"
              value={name}
              onChangeText={setName}
              autoFocus
              style={{ backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 16, fontWeight: "600", color: DARK }}
            />
          </View>

          {/* Items list */}
          {items.length > 0 && (
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={styles.sectionLabel}>Items</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#007AFF" }}>{totalCals} kcal total</Text>
              </View>
              {items.map((item, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BG }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: DARK }}>{item.food}</Text>
                    <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>
                      {item.calories || 0} kcal · P{item.protein || 0}g · C{item.carbs || 0}g · F{item.fat || 0}g
                    </Text>
                  </View>
                  <Pressable onPress={() => removeItem(i)}
                    style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: "#FFE5E5", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: "#FF3B30", fontSize: 16 }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Add item */}
          {showAdd ? (
            <View style={[styles.card, { gap: 10 }]}>
              <Text style={styles.sectionLabel}>Add Item</Text>
              <TextInput
                placeholder="Food name"
                placeholderTextColor="#C7C7CC"
                value={draft.food}
                onChangeText={v => setDraft(p => ({ ...p, food: v }))}
                autoFocus
                style={styles.input}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["calories", "protein", "carbs", "fat"] as const).map(k => (
                  <View key={k} style={{ width: "47%" }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>{k}</Text>
                    <TextInput
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#C7C7CC"
                      value={draft[k]}
                      onChangeText={v => setDraft(p => ({ ...p, [k]: v }))}
                      style={styles.input}
                    />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setShowAdd(false)} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: BG, alignItems: "center" }}>
                  <Text style={{ color: SUBTITLE, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={addItem} disabled={!draft.food.trim()}
                  style={{ flex: 2, padding: 12, borderRadius: 14, backgroundColor: draft.food.trim() ? "#007AFF" : "#C7C7CC", alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>Add Item</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowAdd(true)}
              style={{ padding: 15, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "#C7C7CC", alignItems: "center" }}>
              <Text style={{ color: "#007AFF", fontWeight: "700", fontSize: 15 }}>+ Add Food Item</Text>
            </Pressable>
          )}

          {/* Save */}
          <Pressable onPress={save} disabled={!name.trim() || items.length === 0}
            style={{ padding: 16, borderRadius: 18, backgroundColor: name.trim() && items.length > 0 ? "#007AFF" : "#C7C7CC", alignItems: "center" }}>
            <Text style={{ color: "white", fontWeight: "800", fontSize: 16 }}>Save Meal Template</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: SURFACE, borderRadius: 20, padding: 16 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 },
  input: { backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 14, fontWeight: "600", color: DARK },
});
