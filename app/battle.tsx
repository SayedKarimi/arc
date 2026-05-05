import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#050510";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface BattleMove {
  key: string; name: string; icon: string;
  damage: number; heal: number; effect?: string; unlockedBy: string;
}

interface FriendBattle {
  id: string; opponentName: string; opponentId: string;
  myTurn: boolean; isChallenger: boolean; status: string;
  result: string | null; turns_played: number; myRole: string;
}

interface RPGFriend { id: string; username: string; }

const BATTLE_TYPES: { type: string; label: string; icon: ArcIconName; desc: string; detail: string; minLevel: number }[] = [
  { type: "boss", label: "Boss Battle", icon: "trophy", desc: "Face your best week", detail: "Your peak performance comes back to haunt you. Beat your own record.", minLevel: 1 },
  { type: "arena", label: "Arena", icon: "swords", desc: "Random opponent", detail: "A rival of similar level appears. Their moves reflect their training — and yours.", minLevel: 3 },
  { type: "shadow", label: "Shadow Clone", icon: "moon", desc: "Battle your past self", detail: "Fight the version of you from 2 weeks ago. Have you improved?", minLevel: 1 },
];

export default function BattleScreen() {
  const router = useRouter();
  const [moves, setMoves] = useState<BattleMove[]>([]);
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [friendBattles, setFriendBattles] = useState<FriendBattle[]>([]);
  const [rpgFriends, setRpgFriends] = useState<RPGFriend[]>([]);
  const [showChallengeSheet, setShowChallengeSheet] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [decliningId, setDecliningId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [statsRes, genRes] = await Promise.all([
        supabase.from("rpg_stats").select("level").eq("user_id", user.id).single(),
        fetch(apiUrl("/api/rpg/battle/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken: session.access_token }),
        }),
      ]);

      setLevel(statsRes.data?.level ?? 1);
      const genData = await genRes.json();
      setMoves(genData.moves ?? []);

      // Load friend battles
      const fbRes = await fetch(apiUrl("/api/rpg/friends-battle/pending"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      });
      const fbData = await fbRes.json();
      setFriendBattles(fbData.battles ?? []);
      setRpgFriends(fbData.rpgFriends ?? []);
    } catch {}
    setLoading(false);
  };

  const startBattle = async (battleType: string) => {
    setError(null);
    setStarting(battleType);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated"); setStarting(null); return; }
      const res = await fetch(apiUrl("/api/rpg/battle/start"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, battleType }),
      });
      const data = await res.json();
      if (!data.battleId) { setError("Failed to start battle. Try again."); setStarting(null); return; }
      // Navigate to battle instance (would need a dynamic route)
      setStarting(null);
    } catch {
      setError("Failed to start battle. Try again.");
      setStarting(null);
    }
  };

  const sendChallenge = async (friendId: string) => {
    setChallenging(friendId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(apiUrl("/api/rpg/friends-battle/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, opponentId: friendId }),
      });
      setShowChallengeSheet(false);
      await loadData();
    } catch {}
    setChallenging(null);
  };

  const acceptBattle = async (battleId: string) => {
    setAcceptingId(battleId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(apiUrl("/api/rpg/friends-battle/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, action: "accept", battleId }),
      });
      await loadData();
    } catch {}
    setAcceptingId(null);
  };

  const declineBattle = async (battleId: string) => {
    setDecliningId(battleId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(apiUrl("/api/rpg/friends-battle/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, action: "decline", battleId }),
      });
      setFriendBattles(prev => prev.filter(b => b.id !== battleId));
    } catch {}
    setDecliningId(null);
  };

  const myTurnBattles = friendBattles.filter(b => b.status === "active" && b.myTurn);
  const incomingPending = friendBattles.filter(b => b.status === "pending" && !b.isChallenger);
  const theirTurnBattles = friendBattles.filter(b => b.status === "active" && !b.myTurn);
  const outgoingPending = friendBattles.filter(b => b.status === "pending" && b.isChallenger);
  const completedBattles = friendBattles.filter(b => b.status === "complete" && b.result !== "declined").slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 20 }}>
          <Pressable onPress={() => router.push("/world" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <View>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>BATTLE ARENA</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, letterSpacing: -0.5 }}>Battle</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Moveset */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Your Moveset — This Week</Text>
              {moves.length === 0 ? (
                <Text style={{ fontSize: 12, color: "#3a2800", textAlign: "center", paddingVertical: 8 }}>Log data this week to unlock moves</Text>
              ) : (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {moves.map(move => (
                    <View key={move.key} style={styles.moveCard}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <ArcIcon name={(move.icon || "swords") as ArcIconName} size={14} color={GOLD} />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }}>{move.name}</Text>
                      </View>
                      <Text style={{ fontSize: 9, color: GOLD_DIM, lineHeight: 14 }}>{move.unlockedBy}</Text>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: GOLD, marginTop: 3 }}>
                        {move.damage > 0 ? `${move.damage} DMG` : move.heal > 0 ? `+${move.heal} HP` : move.effect?.replace(/_/g, " ") ?? ""}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={{ fontSize: 10, color: "#3a2800", textAlign: "center", marginTop: 10 }}>Log more to unlock stronger moves — updates daily</Text>
            </View>

            {/* Friend Battles */}
            <View style={styles.sectionCard}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <Text style={styles.sectionLabel}>Friend Battles</Text>
                <Pressable onPress={() => setShowChallengeSheet(true)} style={styles.challengeBtn}>
                  <Text style={{ color: GOLD, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 }}>+ Challenge</Text>
                </Pressable>
              </View>

              {myTurnBattles.map(fb => (
                <View key={fb.id} style={[styles.battleRow, { borderColor: GOLD, backgroundColor: "rgba(212,160,23,0.1)" }]}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: GOLD, marginBottom: 2 }}>vs {fb.opponentName}</Text>
                    <Text style={{ fontSize: 10, color: "#8a6820" }}>Turn {fb.turns_played} · Active</Text>
                  </View>
                  <View style={{ backgroundColor: GOLD, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: "#0d0800", letterSpacing: 0.8 }}>TAKE YOUR TURN</Text>
                  </View>
                </View>
              ))}

              {incomingPending.map(fb => (
                <View key={fb.id} style={[styles.battleRow, { borderColor: "#3a1800", backgroundColor: "rgba(200,64,16,0.06)" }]}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#c87030", marginBottom: 2 }}>Challenge from {fb.opponentName}</Text>
                    <Text style={{ fontSize: 10, color: GOLD_DIM }}>Awaiting your response</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable onPress={() => declineBattle(fb.id)} disabled={decliningId === fb.id}
                      style={{ borderWidth: 1, borderColor: BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: GOLD_DARK, fontSize: 10, fontWeight: "700" }}>Decline</Text>
                    </Pressable>
                    <Pressable onPress={() => acceptBattle(fb.id)} disabled={acceptingId === fb.id}
                      style={{ backgroundColor: "rgba(212,160,23,0.12)", borderWidth: 1, borderColor: GOLD, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ color: GOLD, fontSize: 10, fontWeight: "800" }}>{acceptingId === fb.id ? "..." : "Accept"}</Text>
                    </Pressable>
                  </View>
                </View>
              ))}

              {theirTurnBattles.map(fb => (
                <View key={fb.id} style={[styles.battleRow, { borderColor: "#1a1200" }]}>
                  <View>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: "#8a6820", marginBottom: 2 }}>vs {fb.opponentName}</Text>
                    <Text style={{ fontSize: 10, color: GOLD_DARK }}>Turn {fb.turns_played} · Waiting for them</Text>
                  </View>
                  <Text style={{ fontSize: 9, color: "#3a2800" }}>→</Text>
                </View>
              ))}

              {outgoingPending.map(fb => (
                <View key={fb.id} style={[styles.battleRow, { borderColor: "#1a1200" }]}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: GOLD_DIM }}>Waiting for {fb.opponentName} to accept</Text>
                  <ArcIcon name="timer" size={9} color="#3a2800" />
                </View>
              ))}

              {completedBattles.map(fb => {
                const won = fb.result === `${fb.myRole}_wins`;
                const draw = fb.result === "draw";
                return (
                  <View key={fb.id} style={[styles.battleRow, { borderColor: "#1a1200", opacity: 0.7 }]}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: GOLD_DIM }}>vs {fb.opponentName}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: won ? GOLD : draw ? "#f59e0b" : "#ef4444" }}>
                      {won ? "WIN" : draw ? "DRAW" : "LOSS"}
                    </Text>
                  </View>
                );
              })}

              {myTurnBattles.length === 0 && incomingPending.length === 0 && theirTurnBattles.length === 0 && outgoingPending.length === 0 && completedBattles.length === 0 && (
                <Text style={{ fontSize: 12, color: "#3a2800", textAlign: "center", paddingVertical: 8 }}>No active battles. Challenge a friend to start.</Text>
              )}
            </View>

            {error && <Text style={{ color: "#ef4444", fontSize: 12, textAlign: "center", marginBottom: 12 }}>{error}</Text>}

            {/* Battle Types */}
            <View style={{ gap: 10 }}>
              {BATTLE_TYPES.map(bt => {
                const locked = bt.minLevel > level;
                const isStarting = starting === bt.type;
                return (
                  <Pressable key={bt.type} onPress={() => !locked && !starting && startBattle(bt.type)} disabled={locked || !!starting}
                    style={[styles.battleTypeCard, { borderColor: locked ? "#1a1200" : isStarting ? GOLD : BORDER, opacity: locked ? 0.4 : 1 }]}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}>
                      <ArcIcon name={bt.icon} size={28} color={GOLD} />
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Text style={{ fontSize: 14, fontWeight: "900", color: GOLD }}>{bt.label}</Text>
                          {locked && (
                            <View style={{ backgroundColor: "#1a1200", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                              <Text style={{ fontSize: 9, fontWeight: "800", color: GOLD_DARK, letterSpacing: 0.8 }}>LVL {bt.minLevel}+</Text>
                            </View>
                          )}
                          {isStarting && <Text style={{ fontSize: 9, fontWeight: "800", color: GOLD, letterSpacing: 1 }}>Starting...</Text>}
                        </View>
                        <Text style={{ fontSize: 11, color: "#8a6820", fontWeight: "700", marginBottom: 4 }}>{bt.desc}</Text>
                        <Text style={{ fontSize: 11, color: GOLD_DARK, lineHeight: 16 }}>{bt.detail}</Text>
                      </View>
                      <Text style={{ fontSize: 18, color: "#3a2800" }}>→</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Challenge sheet */}
      {showChallengeSheet && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setShowChallengeSheet(false)} />
          <View style={styles.sheet}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>SELECT OPPONENT</Text>
                <Text style={{ fontSize: 18, fontWeight: "900", color: GOLD }}>Challenge a Friend</Text>
              </View>
              <Pressable onPress={() => setShowChallengeSheet(false)}>
                <Text style={{ color: GOLD_DIM, fontSize: 22 }}>×</Text>
              </Pressable>
            </View>

            {rpgFriends.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 24 }}>
                <Text style={{ fontSize: 13, color: GOLD_DARK, marginBottom: 8 }}>No RPG-enabled friends yet.</Text>
                <Text style={{ fontSize: 11, color: "#3a2800" }}>Friends need to enable the RPG system to battle.</Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {rpgFriends.map(f => (
                  <Pressable key={f.id} onPress={() => sendChallenge(f.id)} disabled={challenging === f.id}
                    style={[styles.friendRow, { opacity: challenging === f.id ? 0.6 : 1 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(212,160,23,0.1)", borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ fontSize: 14, fontWeight: "800", color: GOLD }}>{f.username[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#c8a060" }}>{f.username}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: challenging === f.id ? GOLD_DIM : GOLD, fontWeight: "800" }}>
                      {challenging === f.id ? "Sending..." : "Battle"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionCard: { backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 20, padding: 16, marginBottom: 20 },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 12 },
  moveCard: { width: "47%", backgroundColor: "#0d0800", borderWidth: 1, borderColor: "#1a1200", borderRadius: 12, padding: 10 },
  challengeBtn: { backgroundColor: "rgba(212,160,23,0.1)", borderWidth: 1, borderColor: GOLD + "60", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  battleRow: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  battleTypeCard: { backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderRadius: 20, padding: 18 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 200 },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#120a00", borderWidth: 1, borderColor: BORDER, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, zIndex: 201, maxHeight: "70%" },
  friendRow: { backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
