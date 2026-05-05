import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { formatDistanceToNow } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

interface FeedEvent {
  id: string;
  event_type: "level_up" | "archetype_change" | "battle_win" | "prestige";
  event_data: any;
  created_at: string;
  userId: string;
  username: string;
  level: number;
  archetype: string;
}

export default function FeedScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadFeed(); }, []);

  const loadFeed = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(apiUrl("/api/rpg/social-feed"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      });
      const data = await res.json();
      setFeed(data.feed || []);
    } catch {
      setFeed([]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  const getEventIcon = (type: string): ArcIconName => {
    switch (type) {
      case "level_up": return "bolt";
      case "archetype_change": return "refresh";
      case "battle_win": return "swords";
      case "prestige": return "sparkle";
      default: return "flag";
    }
  };

  const getEventText = (event: FeedEvent) => {
    const d = event.event_data || {};
    switch (event.event_type) {
      case "level_up":
        return `reached Level ${d.new_level}`;
      case "archetype_change":
        return `became a ${(d.new_archetype || "").charAt(0).toUpperCase() + (d.new_archetype || "").slice(1)}`;
      case "battle_win":
        return `defeated ${d.opponent_name || "an opponent"} in ${d.turns_taken || "?"} turns`;
      case "prestige":
        return `prestiged! (×${d.prestige_count || 1})`;
      default:
        return "did something cool";
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Activity Feed</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFeed(); }} tintColor={colors.text} />}
      >
        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginTop: 40 }} />
        ) : feed.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ marginBottom: 8 }}><ArcIcon name="activity" size={40} color={colors.text3} /></View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>No activity yet</Text>
            <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>Your friends' achievements will show up here</Text>
          </View>
        ) : (
          feed.map(event => (
            <View key={event.id} style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <ArcIcon name={getEventIcon(event.event_type)} size={24} color={colors.text} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: colors.text }}>
                    <Text style={{ fontWeight: "700" }}>{event.username}</Text>
                    {" "}{getEventText(event)}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.text3, marginTop: 4 }}>
                    Lv.{event.level} {event.archetype} · {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
});
