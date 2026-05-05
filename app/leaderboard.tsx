import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

interface LeaderboardEntry {
  userId: string;
  username: string;
  level: number;
  archetype: string;
  todayXp: number;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => { loadLeaderboard(); }, []);

  const loadLeaderboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // Get friends
    const { data: fships } = await supabase
      .from("friendships")
      .select("requester_id,addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");

    const friendIds = (fships || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    const allIds = [user.id, ...friendIds];

    // Get today's XP for all
    const today = format(new Date(), "yyyy-MM-dd");
    const { data: xpLogs } = await supabase
      .from("rpg_xp_log")
      .select("user_id,xp_awarded")
      .in("user_id", allIds)
      .eq("source_date", today);

    // Sum XP per user
    const xpMap: Record<string, number> = {};
    for (const log of xpLogs || []) {
      xpMap[log.user_id] = (xpMap[log.user_id] || 0) + (log.xp_awarded || 0);
    }

    // Get profiles + stats
    const { data: profiles } = await supabase.from("profiles").select("id,username").in("id", allIds);
    const { data: stats } = await supabase.from("rpg_stats").select("user_id,level,archetype").in("user_id", allIds);

    const leaderboard: LeaderboardEntry[] = allIds.map(id => ({
      userId: id,
      username: profiles?.find(p => p.id === id)?.username || "User",
      level: stats?.find(s => s.user_id === id)?.level || 1,
      archetype: stats?.find(s => s.user_id === id)?.archetype || "novice",
      todayXp: xpMap[id] || 0,
    }));

    leaderboard.sort((a, b) => b.todayXp - a.todayXp);
    setEntries(leaderboard);
    setLoading(false);
  };

  const getMedalColor = (i: number) => i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : "#CD7F32";
  const getMedal = (i: number) => i <= 2 ? null : `${i + 1}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Leaderboard</Text>
          <Text style={{ fontSize: 12, color: colors.text2 }}>{format(new Date(), "MMMM d")} · Daily XP</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 40 }} />
        ) : entries.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <ArcIcon name="trophy" size={40} color="#FFD700" />
            <Text style={{ fontSize: 14, color: colors.text2, marginTop: 8 }}>Add friends to see the leaderboard</Text>
          </View>
        ) : (
          entries.map((entry, i) => {
            const isMe = entry.userId === currentUserId;
            return (
              <View key={entry.userId} style={[styles.row, isMe && { backgroundColor: colors.text + "10", borderWidth: 1.5, borderColor: colors.text }]}>
                <View style={{ width: 36, alignItems: "center" }}>{i <= 2 ? <ArcIcon name="trophy" size={22} color={getMedalColor(i)} /> : <Text style={{ fontSize: 14, textAlign: "center" }}>{i + 1}</Text>}</View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                    {entry.username} {isMe ? "(you)" : ""}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text2 }}>
                    Lv.{entry.level} · {entry.archetype[0].toUpperCase() + entry.archetype.slice(1)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{entry.todayXp}</Text>
                  <Text style={{ fontSize: 10, color: colors.text2 }}>XP</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
});
