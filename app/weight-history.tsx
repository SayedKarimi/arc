import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  unit: string;
  note?: string;
}

export default function WeightHistoryScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("body_weight_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false })
      .limit(90);
    setEntries((data || []).map((d: any) => ({
      id: d.id,
      date: format(new Date(d.timestamp), "MMM d, yyyy"),
      weight: d.weight,
      unit: d.unit || "lbs",
      note: d.note,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const w = parseFloat(weightInput);
    if (!w || w <= 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("body_weight_entries").insert({
      user_id: user.id,
      weight: w,
      unit,
      note: note || null,
      timestamp: new Date().toISOString(),
    });
    setWeightInput("");
    setNote("");
    setShowLog(false);
    setSaving(false);
    await load();
  };

  // Chart data
  const chartEntries = [...entries].reverse().slice(-14);
  const weights = chartEntries.map(e => e.weight);
  const minW = weights.length ? Math.min(...weights) - 2 : 0;
  const maxW = weights.length ? Math.max(...weights) + 2 : 100;
  const range = maxW - minW || 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ backgroundColor: SURFACE, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Weight History</Text>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* Chart */}
          {chartEntries.length > 1 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Last 14 Entries</Text>
              <View style={{ height: 100, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
                {chartEntries.map((e, i) => {
                  const h = ((e.weight - minW) / range) * 100;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                      <View style={{ width: 8, height: `${Math.max(h, 4)}%`, backgroundColor: "#007AFF", borderRadius: 4 }} />
                    </View>
                  );
                })}
              </View>
              {chartEntries.length >= 2 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ fontSize: 11, color: SUBTITLE }}>{chartEntries[0]?.date}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: weights[weights.length - 1] < weights[0] ? "#34C759" : "#FF3B30" }}>
                    {weights[weights.length - 1] < weights[0] ? "▼" : "▲"} {Math.abs(weights[weights.length - 1] - weights[0]).toFixed(1)} {entries[0]?.unit || "lbs"}
                  </Text>
                  <Text style={{ fontSize: 11, color: SUBTITLE }}>{chartEntries[chartEntries.length - 1]?.date}</Text>
                </View>
              )}
            </View>
          )}

          {/* Log Weight */}
          {showLog ? (
            <View style={[styles.card, { gap: 12 }]}>
              <Text style={{ fontSize: 15, fontWeight: "800", color: DARK }}>Log Weight</Text>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <TextInput
                  value={weightInput}
                  onChangeText={setWeightInput}
                  keyboardType="decimal-pad"
                  placeholder="0.0"
                  autoFocus
                  style={{ flex: 1, backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 20, fontWeight: "700", color: DARK }}
                />
                <View style={{ flexDirection: "row", backgroundColor: BG, borderRadius: 10, overflow: "hidden" }}>
                  {(["lbs", "kg"] as const).map(u => (
                    <Pressable key={u} onPress={() => setUnit(u)}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, backgroundColor: unit === u ? DARK : "transparent" }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: unit === u ? "white" : SUBTITLE }}>{u}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Note (optional)"
                placeholderTextColor="#C7C7CC"
                style={{ backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 14, color: DARK }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable onPress={() => setShowLog(false)} style={{ flex: 1, padding: 12, borderRadius: 14, backgroundColor: BG, alignItems: "center" }}>
                  <Text style={{ color: SUBTITLE, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={save} disabled={saving || !weightInput}
                  style={{ flex: 2, padding: 12, borderRadius: 14, backgroundColor: weightInput ? DARK : "#C7C7CC", alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "800" }}>{saving ? "Saving..." : "Save"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setShowLog(true)} style={{ padding: 15, borderRadius: 18, backgroundColor: DARK, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>+ Log Weight</Text>
            </Pressable>
          )}

          {/* History */}
          {loading ? (
            <View style={[styles.card, { alignItems: "center" }]}>
              <ActivityIndicator size="small" color={DARK} />
            </View>
          ) : entries.length === 0 ? (
            <View style={[styles.card, { alignItems: "center", paddingVertical: 24 }]}>
              <View style={{ marginBottom: 8 }}><ArcIcon name="scale" size={32} color="#C7C7CC" /></View>
              <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>No entries yet</Text>
              <Text style={{ fontSize: 13, color: SUBTITLE, marginTop: 4 }}>Tap Log Weight to start tracking</Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>History</Text>
              {entries.map((e, i) => {
                const prev = entries[i + 1];
                const diff = prev ? e.weight - prev.weight : 0;
                return (
                  <View key={e.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: BG }}>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: DARK }}>
                        {e.weight} {e.unit}
                        {diff !== 0 && (
                          <Text style={{ fontSize: 11, color: diff < 0 ? "#34C759" : "#FF3B30" }}>
                            {" "}{diff < 0 ? "▼" : "▲"} {Math.abs(diff).toFixed(1)}
                          </Text>
                        )}
                      </Text>
                      {e.note ? <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{e.note}</Text> : null}
                    </View>
                    <Text style={{ fontSize: 12, color: SUBTITLE }}>{e.date}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: SURFACE, borderRadius: 20, padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
});
