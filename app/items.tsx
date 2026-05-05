import { useEffect, useRef, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";

const BG = "#0F0A05";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface InventoryItem {
  id: string; item_key: string; item_name: string;
  item_type: string; item_description: string;
  acquired_at: string; equipped: boolean;
}

interface PassiveStatus { dojo: boolean; scrolls: boolean; meditate: boolean; }

const SCROLL_TIPS = [
  "Consistency compounds. Show up every day, even imperfectly.",
  "What gets measured gets managed. Track what matters to you.",
  "Recovery is training. Sleep, rest, and eat to perform.",
];

export default function ItemsScreen() {
  const router = useRouter();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [passiveDone, setPassiveDone] = useState<PassiveStatus>({ dojo: false, scrolls: false, meditate: false });
  const [loading, setLoading] = useState(true);

  // Dojo
  const [dojoActive, setDojoActive] = useState(false);
  const [dojoRound, setDojoRound] = useState(0);
  const [dojoHits, setDojoHits] = useState(0);
  const [dojoResult, setDojoResult] = useState<{ xp: number; hits: number } | null>(null);

  // Scrolls
  const [scrollsActive, setScrollsActive] = useState(false);
  const [currentTip, setCurrentTip] = useState("");
  const [scrollsResult, setScrollsResult] = useState<{ xp: number } | null>(null);

  // Meditate
  const [meditateActive, setMeditateActive] = useState(false);
  const [meditatePhase, setMeditatePhase] = useState<"inhale" | "hold" | "exhale" | "done">("inhale");
  const [meditateSeconds, setMeditateSeconds] = useState(4);
  const [meditateResult, setMeditateResult] = useState<{ xp: number } | null>(null);
  const meditateTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [xpToast, setXpToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setXpToast(msg); setTimeout(() => setXpToast(null), 3000); };

  useEffect(() => { loadData(); return () => { if (meditateTimer.current) clearInterval(meditateTimer.current); }; }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStart = new Date().toISOString().slice(0, 10) + "T00:00:00";

      const [invRes, dojoRes, scrollsRes, meditRes] = await Promise.all([
        supabase.from("rpg_inventory").select("*").eq("user_id", user.id).order("acquired_at", { ascending: false }),
        supabase.from("rpg_passive_actions").select("action_type").eq("user_id", user.id).eq("action_type", "dojo").gte("performed_at", todayStart).maybeSingle(),
        supabase.from("rpg_passive_actions").select("action_type").eq("user_id", user.id).eq("action_type", "scrolls").gte("performed_at", todayStart).maybeSingle(),
        supabase.from("rpg_passive_actions").select("action_type").eq("user_id", user.id).eq("action_type", "meditate").gte("performed_at", todayStart).maybeSingle(),
      ]);

      setInventory((invRes.data ?? []) as InventoryItem[]);
      setPassiveDone({ dojo: !!dojoRes.data, scrolls: !!scrollsRes.data, meditate: !!meditRes.data });
    } catch {}
    setLoading(false);
  };

  const toggleEquip = async (item: InventoryItem) => {
    await supabase.from("rpg_inventory").update({ equipped: !item.equipped }).eq("id", item.id);
    setInventory(prev => prev.map(i => i.id === item.id ? { ...i, equipped: !i.equipped } : i));
  };

  const claimPassive = async (actionType: string, score?: number) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(apiUrl("/api/rpg/passive"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session.access_token, actionType, score }),
    });
    const data = await res.json();
    if (!data.alreadyDone) {
      if (actionType === "dojo") {
        setDojoResult({ xp: data.xpEarned, hits: score ?? 0 });
        setPassiveDone(prev => ({ ...prev, dojo: true }));
      }
      showToast(`+${data.xpEarned} XP (${data.stat})`);
    }
  };

  // Dojo — simplified tap challenge
  const startDojo = () => { setDojoActive(true); setDojoRound(1); setDojoHits(0); setDojoResult(null); };
  const dojoHit = () => {
    const hit = Math.random() > 0.4; // Simplified
    const newHits = hit ? dojoHits + 1 : dojoHits;
    const newRound = dojoRound + 1;
    if (newRound > 10) {
      setDojoActive(false);
      setDojoResult({ xp: 0, hits: newHits });
      claimPassive("dojo", newHits);
    } else {
      setDojoHits(newHits);
      setDojoRound(newRound);
    }
  };

  // Scrolls
  const startScrolls = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(apiUrl("/api/rpg/passive"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session.access_token, actionType: "scrolls" }),
    });
    const data = await res.json();
    if (data.alreadyDone) { setPassiveDone(prev => ({ ...prev, scrolls: true })); return; }
    setCurrentTip(data.tip ?? SCROLL_TIPS[Math.floor(Math.random() * SCROLL_TIPS.length)]);
    setScrollsResult({ xp: data.xpEarned });
    setScrollsActive(true);
    setPassiveDone(prev => ({ ...prev, scrolls: true }));
    showToast(`+${data.xpEarned} XP (${data.stat})`);
  };

  // Meditate
  const startMeditate = () => {
    setMeditateActive(true);
    setMeditatePhase("inhale");
    setMeditateSeconds(4);
    setMeditateResult(null);
    let phase: "inhale" | "hold" | "exhale" | "done" = "inhale";
    let remaining = 4;
    meditateTimer.current = setInterval(() => {
      remaining--;
      setMeditateSeconds(remaining);
      if (remaining <= 0) {
        if (phase === "inhale") { phase = "hold"; remaining = 4; setMeditatePhase("hold"); setMeditateSeconds(4); }
        else if (phase === "hold") { phase = "exhale"; remaining = 6; setMeditatePhase("exhale"); setMeditateSeconds(6); }
        else if (phase === "exhale") {
          if (meditateTimer.current) clearInterval(meditateTimer.current);
          setMeditatePhase("done");
          finishMeditate();
        }
      }
    }, 1000);
  };

  const finishMeditate = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(apiUrl("/api/rpg/passive"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session.access_token, actionType: "meditate" }),
    });
    const data = await res.json();
    if (!data.alreadyDone) {
      setMeditateResult({ xp: data.xpEarned });
      setPassiveDone(prev => ({ ...prev, meditate: true }));
      showToast(`+${data.xpEarned} XP (${data.stat})`);
    }
  };

  const ITEM_TYPE_COLOR: Record<string, string> = { Cosmetic: GOLD, Trophy: "#c84010", Boost: "#22c55e" };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* XP Toast */}
      {xpToast && (
        <View style={styles.toast}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#0d0800" }}>{xpToast}</Text>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 20 }}>
          <Pressable onPress={() => router.push("/world" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <View>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>ITEMS</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, letterSpacing: -0.5 }}>Inventory</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <View style={{ gap: 20 }}>
            {/* Inventory */}
            <View>
              <Text style={styles.sectionLabel}>YOUR ITEMS</Text>
              {inventory.length === 0 ? (
                <View style={[styles.passiveCard, { alignItems: "center", paddingVertical: 24 }]}>
                  <Text style={{ fontSize: 12, color: "#3a2800" }}>No items yet.</Text>
                  <Text style={{ fontSize: 11, color: BORDER, marginTop: 4 }}>Complete story chapters and gym challenges to earn items.</Text>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  {inventory.map(item => {
                    const color = ITEM_TYPE_COLOR[item.item_type] ?? GOLD;
                    return (
                      <View key={item.id} style={[styles.itemCard, item.equipped && { borderColor: GOLD + "50", backgroundColor: "rgba(212,160,23,0.06)" }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: "#c8a060" }}>{item.item_name}</Text>
                            <View style={{ backgroundColor: color + "18", borderWidth: 1, borderColor: color + "40", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 }}>
                              <Text style={{ fontSize: 9, fontWeight: "700", color, letterSpacing: 0.6 }}>{item.item_type.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 10, color: GOLD_DARK }}>{item.item_description}</Text>
                        </View>
                        {item.item_type === "Cosmetic" && (
                          <Pressable onPress={() => toggleEquip(item)}
                            style={{ backgroundColor: item.equipped ? "rgba(212,160,23,0.15)" : "transparent", borderWidth: 1, borderColor: item.equipped ? GOLD : BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                            <Text style={{ color: item.equipped ? GOLD : GOLD_DIM, fontSize: 10, fontWeight: "800" }}>{item.equipped ? "Equipped" : "Equip"}</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Character button */}
            <View>
              <Text style={styles.sectionLabel}>CHARACTER</Text>
              <Pressable onPress={() => router.push("/character" as any)} style={styles.navCard}>
                <View>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD, marginBottom: 3 }}>Edit Character</Text>
                  <Text style={{ fontSize: 10, color: GOLD_DIM }}>Change appearance, hairstyle, skin tone</Text>
                </View>
                <Text style={{ fontSize: 18, color: "#3a2800" }}>→</Text>
              </Pressable>
            </View>

            {/* Daily Training */}
            <View>
              <Text style={styles.sectionLabel}>DAILY TRAINING</Text>
              <Text style={{ fontSize: 10, color: "#3a2800", marginBottom: 12 }}>Small daily activities for passive XP. Resets each day.</Text>

              {/* Dojo */}
              <View style={styles.passiveCard}>
                {!dojoActive && !dojoResult && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: passiveDone.dojo ? GOLD_DARK : GOLD }}>Train in the Dojo</Text>
                      <Text style={{ fontSize: 10, color: GOLD_DARK, marginTop: 2 }}>Tap timing challenge · 10 rounds · Up to 25 XP</Text>
                    </View>
                    {passiveDone.dojo ? (
                      <Text style={{ fontSize: 10, fontWeight: "800", color: GOLD_DIM }}>Done today ✓</Text>
                    ) : (
                      <Pressable onPress={startDojo} style={styles.beginBtn}>
                        <Text style={{ color: GOLD, fontSize: 11, fontWeight: "800" }}>Begin</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                {dojoActive && (
                  <View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }}>Round {dojoRound}/10</Text>
                      <Text style={{ fontSize: 11, color: "#8a6820" }}>Hits: {dojoHits}</Text>
                    </View>
                    <Pressable onPress={dojoHit} style={styles.hitBtn}>
                      <Text style={{ color: GOLD, fontSize: 14, fontWeight: "900", letterSpacing: 1 }}>HIT!</Text>
                    </Pressable>
                  </View>
                )}
                {dojoResult && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD, marginBottom: 4 }}>{dojoResult.hits}/10 hits · +{dojoResult.xp} XP</Text>
                    <Text style={{ fontSize: 10, color: GOLD_DIM }}>Come back tomorrow for another session</Text>
                  </View>
                )}
              </View>

              {/* Scrolls */}
              <View style={[styles.passiveCard, { marginTop: 10 }]}>
                {!scrollsActive ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: passiveDone.scrolls ? GOLD_DARK : GOLD }}>Study Scrolls</Text>
                      <Text style={{ fontSize: 10, color: GOLD_DARK, marginTop: 2 }}>Read a tip for your weakest stat · 10 XP</Text>
                    </View>
                    {passiveDone.scrolls ? (
                      <Text style={{ fontSize: 10, fontWeight: "800", color: GOLD_DIM }}>Done today ✓</Text>
                    ) : (
                      <Pressable onPress={startScrolls} style={styles.beginBtn}>
                        <Text style={{ color: GOLD, fontSize: 11, fontWeight: "800" }}>Study</Text>
                      </Pressable>
                    )}
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 8 }}>SCROLL OF KNOWLEDGE</Text>
                    <Text style={{ fontSize: 13, color: "#a08040", lineHeight: 20, fontStyle: "italic", marginBottom: 14 }}>"{currentTip}"</Text>
                    <Pressable onPress={() => setScrollsActive(false)} style={[styles.hitBtn, { backgroundColor: "rgba(212,160,23,0.08)" }]}>
                      <Text style={{ color: GOLD, fontSize: 12, fontWeight: "800" }}>I got it ✓</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Meditate */}
              <View style={[styles.passiveCard, { marginTop: 10 }]}>
                {!meditateActive && !meditateResult && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: passiveDone.meditate ? GOLD_DARK : GOLD }}>Meditate</Text>
                      <Text style={{ fontSize: 10, color: GOLD_DARK, marginTop: 2 }}>One breathing cycle (14 sec) · 15 XP</Text>
                    </View>
                    {passiveDone.meditate ? (
                      <Text style={{ fontSize: 10, fontWeight: "800", color: GOLD_DIM }}>Done today ✓</Text>
                    ) : (
                      <Pressable onPress={startMeditate} style={styles.beginBtn}>
                        <Text style={{ color: GOLD, fontSize: 11, fontWeight: "800" }}>Begin</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                {meditateActive && meditatePhase !== "done" && (
                  <View style={{ alignItems: "center", paddingVertical: 8 }}>
                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: "rgba(212,160,23,0.1)", borderWidth: 1, borderColor: GOLD + "50", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: GOLD, opacity: 0.6 }} />
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: GOLD, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>{meditatePhase}</Text>
                    <Text style={{ fontSize: 28, fontWeight: "900", color: "#8a6820" }}>{meditateSeconds}</Text>
                  </View>
                )}
                {(meditateResult || (meditateActive && meditatePhase === "done")) && (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: GOLD }}>+{meditateResult?.xp ?? 15} XP · Mind cleared</Text>
                    <Text style={{ fontSize: 10, color: GOLD_DIM, marginTop: 4 }}>Come back tomorrow</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 12 },
  passiveCard: { backgroundColor: "#0d0800", borderWidth: 1, borderColor: "#3a2000", borderRadius: 16, padding: 16 },
  itemCard: { backgroundColor: "#0d0800", borderWidth: 1, borderColor: "#1a1200", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  navCard: { backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  beginBtn: { backgroundColor: "rgba(212,160,23,0.1)", borderWidth: 1, borderColor: GOLD + "50", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  hitBtn: { backgroundColor: "rgba(212,160,23,0.12)", borderWidth: 1, borderColor: GOLD, borderRadius: 12, padding: 14, alignItems: "center" },
  toast: { position: "absolute", top: 80, alignSelf: "center", backgroundColor: "rgba(212,160,23,0.95)", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, zIndex: 300 },
});
