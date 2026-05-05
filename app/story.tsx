import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";

const BG = "#0c0600";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface ChapterData {
  chapter: number; title: string; storyText: string;
  goalDesc: string; xpReward: number; completed: boolean;
  isCurrent: boolean; isUnlocked: boolean;
}

interface CompletionEvent {
  chapter: number; storyText: string; xpReward: number;
  itemReward: { key: string; name: string; type: string; desc: string } | null;
}

export default function StoryScreen() {
  const router = useRouter();
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [goalProgress, setGoalProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completionEvent, setCompletionEvent] = useState<CompletionEvent | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(apiUrl("/api/rpg/story/check"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      });
      const data = await res.json();
      setChapters(data.chapters ?? []);
      setGoalProgress(data.goalProgress ?? 0);
      if (data.completionEvent) setCompletionEvent(data.completionEvent);
    } catch {}
    setLoading(false);
  };

  const currentChDef = chapters.find(c => c.isCurrent);
  const completedChapters = chapters.filter(c => c.completed).reverse();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 16 }}>
          <Pressable onPress={() => router.push("/world" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <View>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>STORY MODE</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, letterSpacing: -0.5 }}>The Chronicles</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Active chapter */}
            {currentChDef && !currentChDef.completed && (
              <View style={styles.activeCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: "#8B6010", textTransform: "uppercase", marginBottom: 4 }}>CHAPTER {currentChDef.chapter + 1} — ACTIVE</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: GOLD }}>{currentChDef.title}</Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(212,160,23,0.15)", borderWidth: 1, borderColor: GOLD + "50", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: GOLD, letterSpacing: 0.8 }}>+{currentChDef.xpReward} XP</Text>
                  </View>
                </View>

                {/* Story text */}
                <View style={{ backgroundColor: "rgba(255,200,80,0.03)", borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, color: "#a08040", lineHeight: 20, fontStyle: "italic" }}>"{currentChDef.storyText}"</Text>
                </View>

                {/* Goal */}
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 8 }}>CURRENT GOAL</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#c8a060", marginBottom: 10 }}>{currentChDef.goalDesc}</Text>

                {/* Progress bar */}
                <View style={{ height: 6, backgroundColor: "#1a1200", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: BORDER }}>
                  <View style={{ height: "100%", width: `${goalProgress}%`, backgroundColor: goalProgress >= 100 ? GOLD : "#8B6010", borderRadius: 999 }} />
                </View>
                <Text style={{ fontSize: 10, color: GOLD_DIM, marginTop: 4, textAlign: "right" }}>{goalProgress}%</Text>
              </View>
            )}

            {/* Completed chapters */}
            {completedChapters.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DARK, textTransform: "uppercase", marginBottom: 10 }}>COMPLETED</Text>
                <View style={{ gap: 6 }}>
                  {completedChapters.map(ch => (
                    <View key={ch.chapter} style={styles.completedCard}>
                      <Text style={{ fontSize: 14, color: GOLD }}>✓</Text>
                      <Text style={{ flex: 1, fontSize: 13, fontWeight: "800", color: GOLD_DIM }}>{ch.title}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: GOLD_DARK }}>+{ch.xpReward} XP</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {completedChapters.length === 0 && !currentChDef?.isCurrent && (
              <Text style={{ textAlign: "center", color: "#3a2800", fontSize: 12, paddingVertical: 20 }}>Your story has not yet begun.</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Completion cinematic */}
      {completionEvent && (
        <Pressable style={styles.cinematic} onPress={() => setCompletionEvent(null)}>
          <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: "#8B6010", textTransform: "uppercase", marginBottom: 16 }}>CHAPTER COMPLETE</Text>
          <Text style={{ fontSize: 24, fontWeight: "900", color: GOLD, marginBottom: 16 }}>Chapter {completionEvent.chapter + 1}</Text>
          <View style={{ backgroundColor: "rgba(255,200,80,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 20, marginBottom: 20, width: "100%" }}>
            <Text style={{ fontSize: 13, color: "#a08040", lineHeight: 22, fontStyle: "italic", textAlign: "center" }}>"{completionEvent.storyText}"</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "900", color: GOLD, marginBottom: 8 }}>+{completionEvent.xpReward} XP</Text>
          {completionEvent.itemReward && (
            <Text style={{ fontSize: 12, color: "#8a6820", marginBottom: 16 }}>Item unlocked: {completionEvent.itemReward.name}</Text>
          )}
          <Text style={{ fontSize: 10, color: GOLD_DARK, marginTop: 12 }}>Tap anywhere to continue</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  activeCard: { backgroundColor: "rgba(212,160,23,0.05)", borderWidth: 1, borderColor: GOLD + "40", borderRadius: 20, padding: 20 },
  completedCard: { backgroundColor: "rgba(212,160,23,0.02)", borderWidth: 1, borderColor: "#1a1200", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  cinematic: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.97)", alignItems: "center", justifyContent: "center", padding: 32, zIndex: 400 },
});
