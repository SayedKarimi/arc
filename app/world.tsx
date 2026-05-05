import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#0F0A05";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";
const CARD_BG = "rgba(212,160,23,0.04)";

type RPGStatKey = "strength" | "agility" | "vitality" | "focus" | "wealth" | "discipline" | "willpower";

interface RPGStats {
  strength: number; agility: number; vitality: number;
  focus: number; wealth: number; discipline: number; willpower: number;
  level: number; totalXP: number; archetype: string; archetypeWindowDays: number;
}

const DEFAULT_STATS: RPGStats = {
  strength: 0, agility: 0, vitality: 0, focus: 0, wealth: 0, discipline: 0, willpower: 0,
  level: 1, totalXP: 0, archetype: "novice", archetypeWindowDays: 14,
};

const STAT_LABELS: Record<RPGStatKey, { abbr: string; icon: ArcIconName }> = {
  strength: { abbr: "STR", icon: "workout" },
  agility: { abbr: "AGI", icon: "steps" },
  vitality: { abbr: "VIT", icon: "heart" },
  focus: { abbr: "FOC", icon: "brain" },
  wealth: { abbr: "WLT", icon: "moneybag" },
  discipline: { abbr: "DIS", icon: "bolt" },
  willpower: { abbr: "WIL", icon: "flame" },
};

const TABS = ["CHARACTER", "SKILLS", "ITEMS", "BATTLE"] as const;

function StatBadge({ stat, value, onPress }: { stat: RPGStatKey; value: number; onPress?: () => void }) {
  const { abbr, icon } = STAT_LABELS[stat];
  return (
    <Pressable onPress={onPress} style={styles.statBadge}>
      <ArcIcon name={icon} size={14} color={GOLD} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statAbbr}>{abbr}</Text>
    </Pressable>
  );
}

function XPBar({ totalXP, archetype }: { totalXP: number; archetype: string }) {
  const level = Math.floor(totalXP / 100) + 1;
  const xpInLevel = totalXP % 100;
  const pct = Math.min(xpInLevel / 100, 1) * 100;
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase" }}>Level {level}</Text>
        <Text style={{ fontSize: 10, fontWeight: "700", color: GOLD_DIM }}>{xpInLevel} / 100 XP</Text>
      </View>
      <View style={{ height: 6, backgroundColor: BORDER, borderRadius: 99, overflow: "hidden" }}>
        <View style={{ height: "100%", width: `${pct}%`, backgroundColor: GOLD, borderRadius: 99 }} />
      </View>
      <Text style={{ fontSize: 10, fontWeight: "800", color: GOLD, textAlign: "center", marginTop: 8, letterSpacing: 2, textTransform: "uppercase" }}>{archetype.replace(/_/g, " ")}</Text>
    </View>
  );
}

export default function WorldScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<RPGStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [xpStatus, setXpStatus] = useState<"idle" | "updating">("idle");
  const [recalculating, setRecalculating] = useState(false);
  const [selectedStat, setSelectedStat] = useState<RPGStatKey | null>(null);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("rpg_stats").select("*").eq("user_id", user.id).single();
    if (data) {
      setStats({
        strength: data.strength || 0,
        agility: data.agility || 0,
        vitality: data.vitality || 0,
        focus: data.focus || 0,
        wealth: data.wealth || 0,
        discipline: data.discipline || 0,
        willpower: data.willpower || 0,
        level: data.level || 1,
        totalXP: data.total_xp || 0,
        archetype: data.archetype || "novice",
        archetypeWindowDays: data.archetype_window_days || 14,
      });
    }
    setLoading(false);
  };

  const triggerXP = async () => {
    setXpStatus("updating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const today = new Date().toISOString().slice(0, 10);
      await fetch(apiUrl("/api/rpg/xp"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, accessToken: session.access_token }),
      });
      await loadStats();
    } catch {}
    setXpStatus("idle");
  };

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(apiUrl("/api/rpg/retroactive"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      });
      await loadStats();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setRecalculating(false);
  };

  useEffect(() => {
    loadStats().then(triggerXP);
  }, []);

  const handleTabClick = (i: number) => {
    if (i === 0) { setActiveTab(0); return; }
    if (i === 1) { router.push("/character" as any); return; }
    if (i === 2) { return; } // Items - not yet implemented
    if (i === 3) { router.push("/battle" as any); return; }
  };

  const leftStats: RPGStatKey[] = ["strength", "agility", "vitality"];
  const rightStats: RPGStatKey[] = ["focus", "wealth", "discipline"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 16, paddingBottom: 4 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: 22, color: GOLD_DIM }}>‹</Text>
          </Pressable>
          <Text style={{ fontSize: 10, fontWeight: "900", letterSpacing: 3, color: GOLD, textTransform: "uppercase" }}>LIFEOS WORLD</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minWidth: 40, justifyContent: "flex-end" }}>
            {stats.totalXP > 0 && <Text style={{ fontSize: 10, color: GOLD_DIM, fontWeight: "700" }}>{stats.totalXP.toLocaleString()} XP</Text>}
          </View>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 4, paddingTop: 8, paddingBottom: 16 }}>
          {TABS.map((tab, i) => (
            <Pressable key={tab} onPress={() => handleTabClick(i)} style={[styles.tab, i === activeTab && styles.tabActive]}>
              <Text style={[styles.tabText, i === activeTab && { color: GOLD }]}>{tab}</Text>
            </Pressable>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 80 }} />
        ) : (
          <>
            {/* Stats + Character layout */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              {/* Left stats */}
              <View style={{ gap: 14 }}>
                {leftStats.map(stat => (
                  <StatBadge key={stat} stat={stat} value={stats[stat]} onPress={() => setSelectedStat(stat)} />
                ))}
              </View>

              {/* Character placeholder */}
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", height: 215 }}>
                <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(212,160,23,0.08)", borderWidth: 2, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
                  <ArcIcon name="swords" size={48} color={GOLD} />
                </View>
                <Text style={{ fontSize: 12, fontWeight: "800", color: GOLD, letterSpacing: 2, textTransform: "uppercase", marginTop: 12 }}>{stats.archetype.replace(/_/g, " ")}</Text>
              </View>

              {/* Right stats */}
              <View style={{ gap: 14 }}>
                {rightStats.map(stat => (
                  <StatBadge key={stat} stat={stat} value={stats[stat]} onPress={() => setSelectedStat(stat)} />
                ))}
              </View>
            </View>

            {/* Willpower centered */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <StatBadge stat="willpower" value={stats.willpower} onPress={() => setSelectedStat("willpower")} />
            </View>

            {/* XP Bar */}
            <View style={styles.xpCard}>
              <XPBar totalXP={stats.totalXP} archetype={stats.archetype} />
            </View>

            {/* Archetype window selector */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 16 }}>
              {([7, 14, 30] as const).map(d => (
                <Pressable key={d} style={[styles.windowBtn, stats.archetypeWindowDays === d && styles.windowBtnActive]}>
                  <Text style={[styles.windowBtnText, stats.archetypeWindowDays === d && { color: GOLD }]}>{d}D</Text>
                </Pressable>
              ))}
            </View>

            {/* Story + Map buttons */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 }}>
              <Pressable style={styles.navBtn}>
                <ArcIcon name="book" size={14} color={GOLD} />
                <Text style={styles.navBtnText}>Story</Text>
              </Pressable>
              <Pressable style={styles.navBtn}>
                <ArcIcon name="compass" size={14} color={GOLD} />
                <Text style={styles.navBtnText}>World Map</Text>
              </Pressable>
            </View>

            {/* Recalculate */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <Pressable onPress={recalculate} disabled={recalculating}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: recalculating ? GOLD_DARK : GOLD_DIM, letterSpacing: 0.6, textDecorationLine: recalculating ? "none" : "underline", textDecorationColor: GOLD_DARK }}>
                  {recalculating ? "Recalculating..." : "Recalculate from history"}
                </Text>
              </Pressable>
            </View>

            {/* XP status */}
            {xpStatus === "updating" && (
              <Text style={{ textAlign: "center", color: GOLD_DARK, fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Updating XP...</Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Stat detail sheet */}
      {selectedStat && (
        <Pressable style={styles.statOverlay} onPress={() => setSelectedStat(null)}>
          <View style={styles.statSheet}>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <ArcIcon name={STAT_LABELS[selectedStat].icon} size={32} color={GOLD} />
              <Text style={{ fontSize: 20, fontWeight: "900", color: GOLD, marginTop: 8, letterSpacing: 2, textTransform: "uppercase" }}>{selectedStat}</Text>
              <Text style={{ fontSize: 48, fontWeight: "900", color: GOLD, marginTop: 4 }}>{stats[selectedStat]}</Text>
            </View>
            <Pressable onPress={() => setSelectedStat(null)} style={{ padding: 14, borderRadius: 12, backgroundColor: BORDER, alignItems: "center" }}>
              <Text style={{ color: GOLD_DIM, fontWeight: "700", fontSize: 13 }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tab: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center" },
  tabActive: { borderColor: GOLD, backgroundColor: "rgba(212,160,23,0.12)" },
  tabText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", color: GOLD_DIM },
  statBadge: { alignItems: "center", backgroundColor: "rgba(212,160,23,0.06)", borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 8, paddingHorizontal: 12, minWidth: 56 },
  statValue: { fontSize: 18, fontWeight: "900", color: GOLD, marginTop: 2 },
  statAbbr: { fontSize: 8, fontWeight: "800", letterSpacing: 1, color: GOLD_DIM, marginTop: 2 },
  xpCard: { backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 16, paddingHorizontal: 20, marginBottom: 10 },
  windowBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: BORDER },
  windowBtnActive: { borderColor: GOLD, backgroundColor: "rgba(212,160,23,0.12)" },
  windowBtnText: { fontSize: 9, fontWeight: "800", letterSpacing: 1, color: GOLD_DARK },
  navBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: CARD_BG, borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 10 },
  navBtnText: { color: "#8a6820", fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  statOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  statSheet: { backgroundColor: "#1a1200", borderWidth: 1, borderColor: BORDER, borderRadius: 24, padding: 24, width: "80%" },
});
