import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format, subDays } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SURFACE = "#FFFFFF";
const SUBTITLE = "#8E8E93";

interface MomentumSnapshot {
  date: string;
  score: number;
  breakdown: Record<string, number>;
}

const DOMAINS = ["nutrition", "workout", "sleep", "tasks", "finance", "steps"];
const DOMAIN_MAX: Record<string, number> = { nutrition: 30, workout: 20, sleep: 15, tasks: 15, finance: 10, steps: 10 };
const DOMAIN_ICON: Record<string, ArcIconName> = { nutrition: "plate", workout: "workout", sleep: "sleep", tasks: "checkSquare", finance: "moneybag", steps: "steps" };
const DOMAIN_COLOR: Record<string, string> = { nutrition: "#22c55e", workout: "#111118", sleep: "#8b5cf6", tasks: "#6366f1", finance: "#f59e0b", steps: "#f59e0b" };

export default function RecapScreen() {
  const router = useRouter();
  const [data, setData] = useState<MomentumSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const since = format(subDays(new Date(), 6), "yyyy-MM-dd");
    const { data: snaps } = await supabase
      .from("momentum_snapshots")
      .select("date,score,breakdown")
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date", { ascending: true });
    setData(snaps || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.score, 0) / data.length) : 0;
  const best = data.reduce((b, d) => d.score > b.score ? d : b, data[0] || { score: 0, date: "" });
  const maxScore = Math.max(...data.map(d => d.score), 1);

  const domainAvgs: Record<string, number> = {};
  DOMAINS.forEach(d => {
    const vals = data.map(snap => (snap.breakdown as any)?.[d] ?? 0);
    domainAvgs[d] = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  });

  const sorted = [...DOMAINS].sort((a, b) => (domainAvgs[b] / DOMAIN_MAX[b]) - (domainAvgs[a] / DOMAIN_MAX[a]));
  const bestDomain = sorted[0];
  const worstDomain = sorted[sorted.length - 1];

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ paddingTop: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase", marginBottom: 4 }}>This Week</Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: DARK, letterSpacing: -0.5 }}>Recap</Text>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
          <View style={[styles.statCard, { backgroundColor: DARK }]}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Avg Score</Text>
            <Text style={{ fontSize: 42, fontWeight: "900", color: "white", letterSpacing: -2 }}>{avg}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#fef3c7" }]}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#92400e", textTransform: "uppercase", letterSpacing: 1.5, opacity: 0.7, marginBottom: 6 }}>Best Day</Text>
            <Text style={{ fontSize: 42, fontWeight: "900", color: "#92400e", letterSpacing: -2 }}>{best?.score ?? 0}</Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: "#b45309", marginTop: 2 }}>
              {best?.date ? format(new Date(best.date + "T00:00:00"), "EEE, MMM d") : "—"}
            </Text>
          </View>
        </View>

        {/* 7-Day Bar chart */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>7-Day Scores</Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 }}>
            {data.map(d => {
              const h = (d.score / maxScore) * 100;
              const isToday = d.date === today;
              return (
                <View key={d.date} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: isToday ? DARK : SUBTITLE, marginBottom: 4 }}>{d.score}</Text>
                  <View style={{ width: "100%", height: `${Math.max(h, 6)}%`, backgroundColor: isToday ? DARK : "#e5e7eb", borderTopLeftRadius: 4, borderTopRightRadius: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
                  <Text style={{ fontSize: 8, fontWeight: "600", color: isToday ? DARK : SUBTITLE, marginTop: 4 }}>{format(new Date(d.date + "T00:00:00"), "EEE")}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Domain Averages */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Domain Averages</Text>
          <View style={{ gap: 12 }}>
            {DOMAINS.map(d => {
              const pct = domainAvgs[d] / DOMAIN_MAX[d];
              return (
                <View key={d} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 22, alignItems: "center" }}><ArcIcon name={DOMAIN_ICON[d]} size={16} color={DOMAIN_COLOR[d]} /></View>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: DARK, width: 70, textTransform: "capitalize" }}>{d}</Text>
                  <View style={{ flex: 1, height: 6, backgroundColor: "#f1f5f9", borderRadius: 99, overflow: "hidden" }}>
                    <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: DOMAIN_COLOR[d], borderRadius: 99 }} />
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: SUBTITLE, width: 40, textAlign: "right" }}>{Math.round(pct * 100)}%</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Domain Streaks */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>This Week — Domain Streaks</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {DOMAINS.map(d => {
              const consecutiveDays = data.filter(snap => (snap.breakdown as any)?.[d] > 0).length;
              const pct = consecutiveDays / Math.max(data.length, 1);
              return (
                <View key={d} style={{ width: "30%", backgroundColor: pct >= 0.8 ? "#dcfce7" : pct >= 0.5 ? "#fef3c7" : "#f7f8fc", borderRadius: 14, padding: 12, alignItems: "center" }}>
                  <View style={{ marginBottom: 4 }}><ArcIcon name={DOMAIN_ICON[d]} size={16} color={DOMAIN_COLOR[d]} /></View>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: DARK }}>{consecutiveDays}/{data.length}</Text>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: SUBTITLE, textTransform: "capitalize", marginTop: 2 }}>{d}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Insights */}
        <View style={{ gap: 8 }}>
          <View style={[styles.insightCard, { backgroundColor: "#dcfce7" }]}>
            <ArcIcon name="workout" size={20} color="#14532d" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#14532d", flex: 1 }}>Best at {bestDomain} this week ({Math.round((domainAvgs[bestDomain] / DOMAIN_MAX[bestDomain]) * 100)}%)</Text>
          </View>
          <View style={[styles.insightCard, { backgroundColor: "#fef3c7" }]}>
            <ArcIcon name="flag" size={20} color="#78350f" />
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#78350f", flex: 1 }}>Work on {worstDomain} next week ({Math.round((domainAvgs[worstDomain] / DOMAIN_MAX[worstDomain]) * 100)}%)</Text>
          </View>
          {avg >= 70 ? (
            <View style={[styles.insightCard, { backgroundColor: "#e0e7ff" }]}>
              <ArcIcon name="flame" size={20} color="#3730a3" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#3730a3", flex: 1 }}>Strong week! Avg above 70</Text>
            </View>
          ) : (
            <View style={[styles.insightCard, { backgroundColor: "#fce7f3" }]}>
              <ArcIcon name="recap" size={20} color="#4338ca" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#831843", flex: 1 }}>Tough week — every small log counts</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SURFACE, borderRadius: 24, padding: 20, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 16 },
  statCard: { flex: 1, borderRadius: 20, padding: 18 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase", marginBottom: 16 },
  insightCard: { borderRadius: 16, padding: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
});
