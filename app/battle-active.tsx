import { useEffect, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#0F0A05";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface BattleMove {
  key: string; name: string; type: string; power: number;
  accuracy: number; description: string; icon: string;
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? color : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <View style={{ height: 8, backgroundColor: "#1a1200", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: BORDER }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: barColor, borderRadius: 999 }} />
    </View>
  );
}

export default function BattleActiveScreen() {
  const router = useRouter();
  const { id: battleId } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userHp, setUserHp] = useState(100);
  const [userHpMax, setUserHpMax] = useState(100);
  const [oppHp, setOppHp] = useState(100);
  const [oppHpMax, setOppHpMax] = useState(100);
  const [oppName, setOppName] = useState("Opponent");
  const [moves, setMoves] = useState<BattleMove[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    if (battleId) loadBattle();
  }, [battleId]);

  const loadBattle = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated"); setLoading(false); return; }

      const { data: battle } = await supabase
        .from("rpg_battles")
        .select("*")
        .eq("id", battleId)
        .eq("user_id", session.user.id)
        .single();

      if (!battle) { setError("Battle not found"); setLoading(false); return; }

      const { data: movesetData } = await supabase
        .from("rpg_battle_movesets")
        .select("moves")
        .eq("user_id", session.user.id)
        .maybeSingle();

      const { data: statsData } = await supabase
        .from("rpg_stats")
        .select("level")
        .eq("user_id", session.user.id)
        .single();

      const level = statsData?.level ?? 1;
      const hpMax = 50 + level * 5;
      const state = battle.battle_state ?? {};

      setUserHpMax(hpMax);
      setUserHp(state.userHp ?? battle.user_hp_start ?? hpMax);
      setOppHpMax(battle.opponent_hp_start ?? 100);
      setOppHp(state.opponentHp ?? battle.opponent_hp_start ?? 100);
      setOppName(battle.opponent_name ?? "Opponent");
      setMoves((movesetData?.moves ?? []) as BattleMove[]);
      setTurns(battle.turns_played ?? 0);
      setFinished(!!battle.result);
      setResult(battle.result);
      setLog(state.log ?? []);
    } catch {
      setError("Failed to load battle.");
    }
    setLoading(false);
  };

  const handleMove = async (move: BattleMove) => {
    if (processing || finished) return;
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(apiUrl("/api/rpg/battle/action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, battleId, moveKey: move.key }),
      });
      const data = await res.json();
      if (data.userHp !== undefined) setUserHp(data.userHp);
      if (data.opponentHp !== undefined) setOppHp(data.opponentHp);
      if (data.log) setLog(data.log);
      if (data.turns) setTurns(data.turns);
      if (data.result) { setFinished(true); setResult(data.result); }
    } catch {}
    setProcessing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: GOLD_DIM, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Entering Battle...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text style={{ color: "#ef4444", fontSize: 13 }}>{error}</Text>
        <Pressable onPress={() => router.push("/battle" as any)} style={styles.returnBtn}>
          <Text style={{ color: GOLD }}>Return</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const didWin = result === "win";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.push("/battle" as any)}>
          <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase" }}>BATTLE</Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: GOLD }}>vs {oppName}</Text>
        </View>
        <Text style={{ fontSize: 10, color: GOLD_DARK, fontWeight: "700" }}>T{turns}</Text>
      </View>

      {/* Opponent HP */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#c84010" }}>{oppName}</Text>
          <Text style={{ fontSize: 11, fontWeight: "900", color: GOLD }}>{oppHp} / {oppHpMax}</Text>
        </View>
        <HpBar current={oppHp} max={oppHpMax} color="#c84010" />
      </View>

      {/* Battle log */}
      <ScrollView style={{ flex: 1, marginHorizontal: 16, marginVertical: 8 }}
        contentContainerStyle={{ padding: 14, backgroundColor: "rgba(10,6,0,0.7)", borderWidth: 1, borderColor: "#1a1200", borderRadius: 14 }}>
        {finished && (
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: didWin ? GOLD : "#ef4444", marginBottom: 4 }}>
              {didWin ? "Victory!" : "Defeated"}
            </Text>
            <Text style={{ fontSize: 11, color: GOLD_DIM }}>{turns} turns</Text>
          </View>
        )}
        {log.map((line, i) => (
          <Text key={i} style={{ fontSize: 11, color: i === log.length - 1 ? GOLD : GOLD_DIM, fontWeight: i === log.length - 1 ? "700" : "500", marginBottom: 3 }}>
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* User HP */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }}>You</Text>
          <Text style={{ fontSize: 11, fontWeight: "900", color: GOLD }}>{userHp} / {userHpMax}</Text>
        </View>
        <HpBar current={userHp} max={userHpMax} color={GOLD} />
      </View>

      {/* Moves or result */}
      {finished ? (
        <View style={{ padding: 16, paddingBottom: 24 }}>
          <Pressable onPress={() => router.push("/battle" as any)} style={styles.hubBtn}>
            <Text style={{ color: GOLD, fontSize: 13, fontWeight: "800" }}>Return to Battle Hub</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, paddingBottom: 24 }}>
          {moves.map(move => (
            <Pressable key={move.key} onPress={() => handleMove(move)} disabled={processing}
              style={[styles.moveCard, { opacity: processing ? 0.5 : 1 }]}>
              <ArcIcon name={(move.icon || "swords") as ArcIconName} size={18} color={GOLD} />
              <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }} numberOfLines={1}>{move.name}</Text>
              <Text style={{ fontSize: 9, color: GOLD_DIM, marginTop: 2 }}>Pow: {move.power}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  returnBtn: { borderWidth: 1, borderColor: BORDER, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  hubBtn: { backgroundColor: "rgba(212,160,23,0.08)", borderWidth: 1, borderColor: GOLD + "50", borderRadius: 16, padding: 16, alignItems: "center" },
  moveCard: { width: "47%", backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, alignItems: "center" },
});
