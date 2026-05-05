import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";

const BG = "#0F0A05";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface GymDef {
  gym_key: string; biome_key: string; name: string; description: string;
  icon: string; required_level: number; stat_focus: string; location_hint: string;
}

const STAT_COLORS: Record<string, string> = {
  strength: "#c84010", agility: "#f59e0b", vitality: "#22c55e",
  focus: "#8b5cf6", wealth: GOLD, discipline: "#3b82f6",
};

const XP_REWARD: Record<string, number> = {
  iron_foundry: 80, forge_gauntlet: 200, sprint_circuit: 80, endurance_trail: 200,
  mind_palace: 100, deep_focus: 220, harvest_hall: 80, grove_pinnacle: 200,
  coin_exchange: 60, vault: 180,
};

export default function GymScreen() {
  const router = useRouter();
  const { key: gymKey } = useLocalSearchParams<{ key: string }>();

  const [gym, setGym] = useState<GymDef | null>(null);
  const [completed, setCompleted] = useState(false);
  const [conditionMet, setConditionMet] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ xpBonus: number; score: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gymKey) loadData();
  }, [gymKey]);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [gymRes, checkRes] = await Promise.all([
        fetch(apiUrl("/api/rpg/world/progress"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token, action: "load" }),
        }),
        fetch(apiUrl("/api/rpg/world/progress"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token, action: "check", gymKey }),
        }),
      ]);

      const gymData = await gymRes.json();
      const checkData = await checkRes.json();

      const gymDef = (gymData.gyms ?? []).find((g: GymDef) => g.gym_key === gymKey);
      setGym(gymDef ?? null);
      const alreadyDone = (gymData.completions ?? []).some((c: any) => c.gym_key === gymKey);
      setCompleted(alreadyDone);
      setConditionMet(checkData.met ?? false);
    } catch {}
    setLoading(false);
  };

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(apiUrl("/api/rpg/world/progress"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, action: "complete", gymKey }),
      });
      const data = await res.json();
      if (data.already) { setCompleted(true); setClaiming(false); return; }
      if (!data.met) { setError("Conditions not met yet. Keep training."); setClaiming(false); return; }
      setCompleted(true);
      setResult({ xpBonus: data.xpBonus, score: data.score });
    } catch {
      setError("Something went wrong. Try again.");
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={GOLD} />
      </SafeAreaView>
    );
  }

  if (!gym) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text style={{ color: "#ef4444", fontSize: 13 }}>Gym not found.</Text>
        <Pressable onPress={() => router.push("/world-map" as any)}
          style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ color: GOLD }}>Return to Map</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const color = STAT_COLORS[gym.stat_focus] ?? GOLD;
  const xpReward = XP_REWARD[gymKey!] ?? 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 28 }}>
          <Pressable onPress={() => router.push("/world-map" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <View>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>{gym.location_hint}</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, letterSpacing: -0.5 }}>{gym.name}</Text>
          </View>
        </View>

        {/* Icon */}
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: color + "20", borderWidth: 2, borderColor: color + "40", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 44 }}>{gym.icon}</Text>
          </View>
        </View>

        {/* Result banner */}
        {result && (
          <View style={[styles.resultCard, { borderColor: GOLD }]}>
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#8B6010", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>GYM CLEARED</Text>
            <Text style={{ fontSize: 32, fontWeight: "900", color: GOLD }}>+{result.xpBonus} XP</Text>
            <Text style={{ fontSize: 11, color: "#8a6820", marginTop: 4 }}>{gym.stat_focus} stat boosted</Text>
          </View>
        )}

        {/* Challenge card */}
        <View style={styles.challengeCard}>
          <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 12 }}>Challenge</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#c8a060", lineHeight: 22, marginBottom: 16 }}>{gym.description}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 9, color: GOLD_DARK, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Reward</Text>
              <Text style={{ fontSize: 20, fontWeight: "900", color }}>+{xpReward} XP</Text>
              <Text style={{ fontSize: 9, color: GOLD_DIM }}>{gym.stat_focus} stat</Text>
            </View>
            <Text style={{ fontSize: 32 }}>{gym.icon}</Text>
          </View>
        </View>

        {/* Status */}
        {completed && !result && (
          <View style={[styles.statusCard, { borderColor: GOLD + "40" }]}>
            <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD }}>✓ Cleared</Text>
            <Text style={{ fontSize: 11, color: "#8a6820", marginTop: 4 }}>You've already conquered this gym.</Text>
          </View>
        )}
        {!completed && conditionMet === false && (
          <View style={[styles.statusCard, { borderColor: "#3a1800" }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#c87030" }}>Conditions not met</Text>
            <Text style={{ fontSize: 11, color: GOLD_DARK, marginTop: 4 }}>Complete the challenge requirements first, then return to claim.</Text>
          </View>
        )}
        {!completed && conditionMet === true && !result && (
          <View style={[styles.statusCard, { borderColor: GOLD + "50" }]}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: GOLD }}>Ready to claim!</Text>
            <Text style={{ fontSize: 11, color: "#8a6820", marginTop: 4 }}>You've met the requirements for this gym.</Text>
          </View>
        )}

        {error && <Text style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 12 }}>{error}</Text>}

        {/* Action buttons */}
        <View style={{ gap: 10, marginTop: 8 }}>
          {!completed && (
            <Pressable onPress={handleClaim} disabled={claiming || !conditionMet}
              style={[styles.claimBtn, { borderColor: conditionMet ? GOLD : BORDER, backgroundColor: conditionMet ? "rgba(212,160,23,0.12)" : "transparent", opacity: claiming ? 0.6 : 1 }]}>
              <Text style={{ color: conditionMet ? GOLD : GOLD_DARK, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 }}>
                {claiming ? "Claiming..." : conditionMet ? "Claim Reward" : "Check Back After Training"}
              </Text>
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/world-map" as any)} style={styles.returnBtn}>
            <Text style={{ color: GOLD_DIM, fontSize: 12, fontWeight: "700" }}>Return to Map</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  resultCard: { backgroundColor: "rgba(212,160,23,0.08)", borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 20 },
  challengeCard: { backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 20, marginBottom: 16 },
  statusCard: { backgroundColor: "rgba(212,160,23,0.06)", borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center", marginBottom: 16 },
  claimBtn: { borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center" },
  returnBtn: { borderWidth: 1, borderColor: "#1a1200", borderRadius: 16, padding: 14, alignItems: "center" },
});
