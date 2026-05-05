import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format, subDays } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";

interface MoodEntry {
  id: string;
  date: string;
  mood: number;
  energy: number;
  note?: string;
}

const MOOD_LEVELS = [
  { value: 1, emoji: "😞", label: "Bad" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😊", label: "Great" },
];

const ENERGY_LEVELS = [
  { value: 1, emoji: "🔋", label: "Drained" },
  { value: 2, emoji: "🪫", label: "Low" },
  { value: 3, emoji: "⚡", label: "Normal" },
  { value: 4, emoji: "💪", label: "High" },
  { value: 5, emoji: "🔥", label: "Charged" },
];

export default function MoodScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState("");
  const [todayLogged, setTodayLogged] = useState(false);
  const [history, setHistory] = useState<MoodEntry[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("mood_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: false })
      .limit(30);
    setHistory(data || []);
    const todayEntry = (data || []).find(e => e.date === today);
    if (todayEntry) {
      setMood(todayEntry.mood);
      setEnergy(todayEntry.energy);
      setNote(todayEntry.note || "");
      setTodayLogged(true);
    }
  };

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (todayLogged) {
      const existing = history.find(e => e.date === today);
      if (existing) {
        await supabase.from("mood_entries").update({ mood, energy, note }).eq("id", existing.id);
      }
    } else {
      await supabase.from("mood_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: user.id,
        date: today,
        mood,
        energy,
        note,
        timestamp: Date.now(),
      });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTodayLogged(true);
    load();
  };

  // 7-day averages
  const last7 = history.filter(e => {
    const d = new Date(e.date);
    return d >= subDays(new Date(), 7);
  });
  const avgMood = last7.length > 0 ? (last7.reduce((s, e) => s + e.mood, 0) / last7.length).toFixed(1) : "—";
  const avgEnergy = last7.length > 0 ? (last7.reduce((s, e) => s + e.energy, 0) / last7.length).toFixed(1) : "—";

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Mood & Energy</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Today's check-in */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>
            {todayLogged ? "Today's Check-in (tap to update)" : "How are you feeling?"}
          </Text>

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Mood</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
            {MOOD_LEVELS.map(m => (
              <Pressable key={m.value} onPress={() => setMood(m.value)} style={[styles.moodBtn, mood === m.value && styles.moodBtnActive]}>
                <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                <Text style={{ fontSize: 10, fontWeight: "600", color: mood === m.value ? colors.bg : colors.text2, marginTop: 2 }}>{m.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 8 }}>Energy</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
            {ENERGY_LEVELS.map(e => (
              <Pressable key={e.value} onPress={() => setEnergy(e.value)} style={[styles.moodBtn, energy === e.value && styles.moodBtnActive]}>
                <Text style={{ fontSize: 28 }}>{e.emoji}</Text>
                <Text style={{ fontSize: 10, fontWeight: "600", color: energy === e.value ? colors.bg : colors.text2, marginTop: 2 }}>{e.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={styles.noteInput}
            placeholder="Any notes? (optional)"
            placeholderTextColor={colors.text3}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
          />

          <Pressable style={styles.saveBtn} onPress={save}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: colors.bg }}>
              {todayLogged ? "Update" : "Log Check-in"}
            </Text>
          </Pressable>
        </View>

        {/* 7-day averages */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>{avgMood}</Text>
            <Text style={{ fontSize: 11, color: colors.text2 }}>Avg Mood (7d)</Text>
          </View>
          <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>{avgEnergy}</Text>
            <Text style={{ fontSize: 11, color: colors.text2 }}>Avg Energy (7d)</Text>
          </View>
        </View>

        {/* History */}
        {history.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Recent</Text>
            {history.slice(0, 14).map(entry => (
              <View key={entry.id} style={styles.historyRow}>
                <Text style={{ fontSize: 22 }}>{MOOD_LEVELS[entry.mood - 1]?.emoji || "😐"}</Text>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{entry.date}</Text>
                    <Text style={{ fontSize: 11, color: colors.text2 }}>
                      Mood: {entry.mood}/5 · Energy: {entry.energy}/5
                    </Text>
                  </View>
                  {entry.note ? <Text style={{ fontSize: 12, color: colors.text3, marginTop: 2 }}>{entry.note}</Text> : null}
                </View>
              </View>
            ))}
          </>
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
  moodBtn: { alignItems: "center", paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.lg },
  moodBtnActive: { backgroundColor: colors.text },
  noteInput: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 60, textAlignVertical: "top", marginBottom: 12 },
  saveBtn: { backgroundColor: colors.text, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 6 },
});
