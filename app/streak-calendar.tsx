import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { getCurrentStreak } from "@/lib/supabase/queries";
import { ArcIcon } from "@/components/ArcIcon";

export default function StreakCalendarScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [totalDays, setTotalDays] = useState(0);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get all nutrition entry dates from last 90 days
    const since = format(subDays(new Date(), 90), "yyyy-MM-dd");
    const { data } = await supabase
      .from("nutrition_entries")
      .select("date")
      .eq("user_id", user.id)
      .gte("date", since);

    const days = new Set((data || []).map(e => e.date));
    setActiveDays(days);
    setTotalDays(days.size);

    const s = await getCurrentStreak();
    setStreak(s);

    // Calculate longest streak
    const sortedDays = Array.from(days).sort();
    let longest = 0;
    let current = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      if (diffDays === 1) {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 1;
      }
    }
    setLongestStreak(Math.max(longest, sortedDays.length > 0 ? 1 : 0));
  };

  // Generate 12 weeks of dates (84 days)
  const today = new Date();
  const startDate = startOfWeek(subDays(today, 77), { weekStartsOn: 1 });
  const weeks: string[][] = [];
  for (let w = 0; w < 12; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(format(addDays(startDate, w * 7 + d), "yyyy-MM-dd"));
    }
    weeks.push(week);
  }

  const getColor = (date: string) => {
    if (date > format(today, "yyyy-MM-dd")) return "transparent";
    if (activeDays.has(date)) return colors.green || "#00C853";
    return colors.surface2;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Streak</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Stats */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
          <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ fontSize: 32, fontWeight: "900", color: colors.text }}>{streak}</Text>
            <Text style={{ fontSize: 11, color: colors.text2, fontWeight: "600" }}>Current</Text>
          </View>
          <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ fontSize: 32, fontWeight: "900", color: colors.text }}>{longestStreak}</Text>
            <Text style={{ fontSize: 11, color: colors.text2, fontWeight: "600" }}>Longest</Text>
          </View>
          <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
            <Text style={{ fontSize: 32, fontWeight: "900", color: colors.text }}>{totalDays}</Text>
            <Text style={{ fontSize: 11, color: colors.text2, fontWeight: "600" }}>Total Days</Text>
          </View>
        </View>

        {/* Heatmap */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Last 12 Weeks</Text>

          {/* Day labels */}
          <View style={{ flexDirection: "row", marginBottom: 4 }}>
            <View style={{ width: 24 }} />
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: colors.text3 }}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
              <Text style={{ width: 24, fontSize: 9, color: colors.text3 }}>
                {wi % 4 === 0 ? format(new Date(week[0]), "MMM") : ""}
              </Text>
              {week.map(date => (
                <View key={date} style={{ flex: 1, alignItems: "center" }}>
                  <View style={{
                    width: 14, height: 14, borderRadius: 3,
                    backgroundColor: getColor(date),
                  }} />
                </View>
              ))}
            </View>
          ))}

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 8 }}>
            <Text style={{ fontSize: 10, color: colors.text3 }}>Less</Text>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.surface2 }} />
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.green || "#00C853" }} />
            <Text style={{ fontSize: 10, color: colors.text3 }}>More</Text>
          </View>
        </View>

        {/* Motivation */}
        {streak >= 7 && (
          <View style={[styles.card, { alignItems: "center" }]}>
            <ArcIcon name="flame" size={40} color="#FF6B35" />
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 8 }}>
              {streak >= 30 ? "Unstoppable!" : streak >= 14 ? "On fire!" : "Keep it up!"}
            </Text>
            <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>
              {streak} day streak — don't break the chain!
            </Text>
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
});
