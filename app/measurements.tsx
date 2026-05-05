import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

interface Measurement {
  id: string;
  date: string;
  waist?: number;
  chest?: number;
  hips?: number;
  left_arm?: number;
  right_arm?: number;
  left_thigh?: number;
  right_thigh?: number;
}

const FIELDS: { key: string; label: string; icon: ArcIconName }[] = [
  { key: "waist", label: "Waist", icon: "target" },
  { key: "chest", label: "Chest", icon: "workout" },
  { key: "hips", label: "Hips", icon: "target" },
  { key: "left_arm", label: "Left Arm", icon: "workout" },
  { key: "right_arm", label: "Right Arm", icon: "workout" },
  { key: "left_thigh", label: "Left Thigh", icon: "leg" },
  { key: "right_thigh", label: "Right Thigh", icon: "leg" },
];

export default function MeasurementsScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [entries, setEntries] = useState<Measurement[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("body_measurements")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(20);
    setEntries(data || []);
  };

  const save = async () => {
    const hasValue = FIELDS.some(f => values[f.key]?.trim());
    if (!hasValue) { Alert.alert("Enter at least one measurement"); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const entry: any = {
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: format(new Date(), "yyyy-MM-dd"),
      timestamp: Date.now(),
    };
    FIELDS.forEach(f => {
      const v = parseFloat(values[f.key] || "");
      if (v > 0) entry[f.key] = v;
    });

    await supabase.from("body_measurements").insert(entry);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowAdd(false);
    setValues({});
    load();
  };

  const deleteEntry = (id: string) => {
    Alert.alert("Delete measurement?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("body_measurements").delete().eq("id", id);
        setEntries(prev => prev.filter(e => e.id !== id));
      }},
    ]);
  };

  const latest = entries[0];
  const prev = entries[1];

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Measurements</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Current stats */}
        {latest && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Latest — {latest.date}</Text>
            {FIELDS.map(f => {
              const val = (latest as any)[f.key];
              if (!val) return null;
              const prevVal = prev ? (prev as any)[f.key] : null;
              const diff = prevVal ? val - prevVal : null;
              return (
                <View key={f.key} style={styles.measureRow}>
                  <ArcIcon name={f.icon} size={16} color={colors.text} />
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.text }}>{f.label}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{val}"</Text>
                  {diff !== null && diff !== 0 && (
                    <Text style={{ fontSize: 12, fontWeight: "700", color: diff < 0 ? colors.green : colors.red, marginLeft: 8 }}>
                      {diff > 0 ? "+" : ""}{diff.toFixed(1)}"
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Add new */}
        {showAdd ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>New Measurement</Text>
            {FIELDS.map(f => (
              <View key={f.key} style={styles.inputRow}>
                <ArcIcon name={f.icon} size={14} color={colors.text} />
                <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>{f.label}</Text>
                <TextInput
                  style={styles.measureInput}
                  value={values[f.key] || ""}
                  onChangeText={v => setValues(prev => ({ ...prev, [f.key]: v }))}
                  keyboardType="decimal-pad"
                  placeholder='—"'
                  placeholderTextColor={colors.text3}
                />
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable style={[styles.saveBtn, { flex: 1 }]} onPress={save}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.bg }}>Save</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={() => { setShowAdd(false); setValues({}); }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={[styles.card, { alignItems: "center" }]} onPress={() => setShowAdd(true)}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>+ New Measurement</Text>
          </Pressable>
        )}

        {/* History */}
        {entries.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>History</Text>
            {entries.map(entry => (
              <Pressable key={entry.id} style={styles.historyRow} onLongPress={() => deleteEntry(entry.id)}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{entry.date}</Text>
                <Text style={{ fontSize: 12, color: colors.text2 }}>
                  {FIELDS.filter(f => (entry as any)[f.key]).map(f => `${f.label}: ${(entry as any)[f.key]}"`).join(" · ")}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {entries.length === 0 && !showAdd && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ marginBottom: 8 }}><ArcIcon name="target" size={40} color={colors.text3} /></View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>No measurements yet</Text>
            <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>Track your body measurements over time</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  measureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  measureInput: { width: 60, height: 36, borderRadius: radius.md, backgroundColor: colors.bg, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.text, borderWidth: 1, borderColor: colors.border },
  historyRow: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 6 },
  saveBtn: { backgroundColor: colors.text, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  cancelBtn: { backgroundColor: colors.surface2, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
});
