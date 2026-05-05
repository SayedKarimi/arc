import { useEffect, useState, useRef } from "react";
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
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

interface BattleState {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  challenger_hp: number;
  opponent_hp: number;
  turns_played: number;
  result: string | null;
  battle_state: any;
  myRole: "challenger" | "opponent";
  opponentName: string;
  myTurn: boolean;
}

const MOVE_POOL: BattleMove[] = [
  { key: "strike", name: "Strike", type: "physical", power: 15, accuracy: 95, description: "Basic attack", icon: "swords" },
  { key: "guard", name: "Guard", type: "defense", power: 0, accuracy: 100, description: "Reduce damage", icon: "shield" },
  { key: "focus_blast", name: "Focus Blast", type: "special", power: 25, accuracy: 80, description: "Powerful but risky", icon: "bolt" },
  { key: "heal", name: "Heal", type: "support", power: 0, accuracy: 100, description: "Restore HP", icon: "heart" },
];

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const barColor = pct > 50 ? color : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <View style={{ height: 8, backgroundColor: "#1a1200", borderRadius: 999, overflow: "hidden", borderWidth: 1, borderColor: BORDER }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: barColor, borderRadius: 999 }} />
    </View>
  );
}

export default function BattleFriendScreen() {
  const router = useRouter();
  const { id: battleId } = useLocalSearchParams<{ id: string }>();

  const [battle, setBattle] = useState<BattleState | null>(null);
  const [myMoves, setMyMoves] = useState<BattleMove[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<ScrollView>(null);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: b } = await supabase.from("rpg_friend_battles").select("*").eq("id", battleId).single();
    if (!b) return;

    const myId = session.user.id;
    const oppId = b.challenger_id === myId ? b.opponent_id : b.challenger_id;
    const myRole: "challenger" | "opponent" = b.challenger_id === myId ? "challenger" : "opponent";

    const { data: oppProfile } = await supabase.from("profiles").select("username").eq("id", oppId).single();

    const myMoveKeys: string[] = b.battle_state?.[`${myRole}Moves`] ?? [];
    const moves = myMoveKeys.map((k: string) => MOVE_POOL.find(m => m.key === k)).filter(Boolean) as BattleMove[];
    if (moves.length === 0) setMyMoves(MOVE_POOL.slice(0, 4));
    else setMyMoves(moves);

    setLog(b.battle_state?.log ?? []);

    setBattle({
      ...b,
      myRole,
      opponentName: oppProfile?.username ?? "Opponent",
      myTurn: b.battle_state?.currentTurn === myRole,
    });
  };

  useEffect(() => {
    if (battleId) {
      (async () => {
        try { await load(); } catch {}
        setLoading(false);
      })();
    }
  }, [battleId]);

  // Poll if waiting
  useEffect(() => {
    if (!battle || battle.myTurn || battle.status === "complete") return;
    const interval = setInterval(async () => {
      try { await load(); } catch {}
    }, 6000);
    return () => clearInterval(interval);
  }, [battle?.myTurn, battle?.status]);

  const handleMove = async (move: BattleMove) => {
    if (processing || !battle?.myTurn) return;
    setProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(apiUrl("/api/rpg/friends-battle/action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, battleId, moveKey: move.key }),
      });
      const data = await res.json();
      setLog(data.log ?? []);
      if (data.result) {
        await load();
      } else {
        setBattle(prev => prev ? { ...prev, myTurn: false, turns_played: data.turns } : prev);
        if (battle.myRole === "challenger") {
          setBattle(prev => prev ? { ...prev, challenger_hp: data.myHp, opponent_hp: data.oppHp } : prev);
        } else {
          setBattle(prev => prev ? { ...prev, opponent_hp: data.myHp, challenger_hp: data.oppHp } : prev);
        }
      }
    } catch {}
    setProcessing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: GOLD_DIM, fontSize: 13, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!battle) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <Text style={{ color: "#ef4444", fontSize: 13 }}>Battle not found.</Text>
        <Pressable onPress={() => router.push("/battle" as any)} style={styles.returnBtn}>
          <Text style={{ color: GOLD }}>Return</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const myHp = battle.myRole === "challenger" ? battle.challenger_hp : battle.opponent_hp;
  const oppHp = battle.myRole === "challenger" ? battle.opponent_hp : battle.challenger_hp;
  const myHpMax = battle.battle_state?.[`${battle.myRole}HpMax`] ?? myHp;
  const oppHpMax = battle.battle_state?.[`${battle.myRole === "challenger" ? "opponent" : "challenger"}HpMax`] ?? oppHp;
  const isComplete = battle.status === "complete";
  const didWin = battle.result === `${battle.myRole}_wins`;
  const isDraw = battle.result === "draw";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => router.push("/battle" as any)}>
          <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase" }}>FRIEND BATTLE</Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: GOLD }}>vs {battle.opponentName}</Text>
        </View>
        <Text style={{ fontSize: 10, color: GOLD_DARK, fontWeight: "700" }}>T{battle.turns_played}</Text>
      </View>

      {/* Opponent HP */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#c84010" }}>{battle.opponentName}</Text>
          <Text style={{ fontSize: 11, fontWeight: "900", color: GOLD }}>{oppHp} / {oppHpMax}</Text>
        </View>
        <HpBar current={oppHp} max={oppHpMax} color="#c84010" />
      </View>

      {/* Battle log */}
      <ScrollView ref={logRef} style={{ flex: 1, marginHorizontal: 16 }}
        contentContainerStyle={{ padding: 14, backgroundColor: "rgba(10,6,0,0.7)", borderWidth: 1, borderColor: "#1a1200", borderRadius: 14, minHeight: 100 }}
        onContentSizeChange={() => logRef.current?.scrollToEnd()}>
        {isComplete && (
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: didWin ? GOLD : isDraw ? "#f59e0b" : "#ef4444", marginBottom: 4 }}>
              {didWin ? "Victory!" : isDraw ? "Draw" : "Defeated"}
            </Text>
            <Text style={{ fontSize: 11, color: GOLD_DIM }}>{battle.turns_played} turns</Text>
          </View>
        )}
        {!isComplete && !battle.myTurn && (
          <Text style={{ fontSize: 11, color: "#8a6820", fontStyle: "italic", fontWeight: "600", textAlign: "center", paddingVertical: 8 }}>
            Waiting for {battle.opponentName}...
          </Text>
        )}
        {log.map((line, i) => (
          <Text key={i} style={{ fontSize: 11, color: i === log.length - 1 ? GOLD : GOLD_DIM, fontWeight: i === log.length - 1 ? "700" : "500", marginBottom: 3 }}>
            {line}
          </Text>
        ))}
      </ScrollView>

      {/* My HP */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }}>You</Text>
          <Text style={{ fontSize: 11, fontWeight: "900", color: GOLD }}>{myHp} / {myHpMax}</Text>
        </View>
        <HpBar current={myHp} max={myHpMax} color={GOLD} />
      </View>

      {/* Moves or result */}
      {isComplete ? (
        <View style={{ padding: 16, paddingBottom: 24 }}>
          <Pressable onPress={() => router.push("/battle" as any)} style={styles.hubBtn}>
            <Text style={{ color: GOLD, fontSize: 13, fontWeight: "800" }}>Return to Battle Hub</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 16, paddingBottom: 24 }}>
          {myMoves.map(move => (
            <Pressable key={move.key} onPress={() => handleMove(move)} disabled={processing || !battle.myTurn}
              style={[styles.moveCard, { opacity: processing || !battle.myTurn ? 0.5 : 1 }]}>
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
