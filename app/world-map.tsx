import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#0F0A05";
const GOLD = "#D4A017";
const GOLD_DIM = "#6a5010";
const BORDER = "#2a1800";

interface GymDef {
  gym_key: string; biome_key: string; name: string; description: string;
  icon: string; required_level: number; stat_focus: string; location_hint: string;
}

const BIOMES: { key: string; name: string; icon: ArcIconName; color: string; desc: string }[] = [
  { key: "forge", name: "THE FORGE", icon: "flame", color: "#c84010", desc: "Strength & Iron" },
  { key: "wilds", name: "THE WILDS", icon: "steps", color: "#22c55e", desc: "Speed & Endurance" },
  { key: "sanctum", name: "THE SANCTUM", icon: "brain", color: "#8b5cf6", desc: "Focus & Mastery" },
  { key: "grove", name: "THE GROVE", icon: "heart", color: "#f59e0b", desc: "Vitality & Fuel" },
  { key: "market", name: "THE MARKET", icon: "moneybag", color: GOLD, desc: "Wealth & Strategy" },
];

export default function WorldMapScreen() {
  const router = useRouter();
  const [gyms, setGyms] = useState<GymDef[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [level, setLevel] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedBiome, setExpandedBiome] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(apiUrl("/api/rpg/world/progress"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token, action: "load" }),
      });
      const data = await res.json();
      setGyms(data.gyms ?? []);
      setCompletions(data.completions ?? []);
      setLevel(data.level ?? 1);
    } catch {}
    setLoading(false);
  };

  const completedSet = new Set(completions.map((c: any) => c.gym_key));
  const totalCleared = completedSet.size;
  const totalGyms = gyms.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 20 }}>
          <Pressable onPress={() => router.push("/world" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 3, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>WORLD MAP</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, letterSpacing: -0.5 }}>Regions</Text>
          </View>
          {!loading && (
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: GOLD }}>{totalCleared}/{totalGyms}</Text>
              <Text style={{ fontSize: 9, color: GOLD_DIM, fontWeight: "700", letterSpacing: 1 }}>CLEARED</Text>
            </View>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Biome grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
              {BIOMES.map(biome => {
                const biomeGyms = gyms.filter(g => g.biome_key === biome.key);
                const biomeCleared = biomeGyms.filter(g => completedSet.has(g.gym_key)).length;
                const allCleared = biomeCleared === biomeGyms.length && biomeGyms.length > 0;
                const isExpanded = expandedBiome === biome.key;

                return (
                  <Pressable key={biome.key} onPress={() => setExpandedBiome(isExpanded ? null : biome.key)}
                    style={[styles.biomeCard, { borderColor: allCleared ? biome.color + "60" : isExpanded ? GOLD + "60" : "#1a0d00" }]}>
                    {allCleared && <Text style={{ position: "absolute", top: 10, right: 10, fontSize: 11, color: biome.color, fontWeight: "900" }}>✓</Text>}
                    <View style={{ marginBottom: 8 }}><ArcIcon name={biome.icon} size={32} color={biome.color} /></View>
                    <Text style={{ fontSize: 9, fontWeight: "900", letterSpacing: 1.5, color: allCleared ? biome.color : GOLD, textTransform: "uppercase", marginBottom: 4 }}>{biome.name}</Text>
                    <Text style={{ fontSize: 11, color: GOLD_DIM, fontWeight: "600" }}>{biomeCleared}/{biomeGyms.length} gym{biomeGyms.length !== 1 ? "s" : ""}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Expanded gym list */}
            {expandedBiome && (() => {
              const biome = BIOMES.find(b => b.key === expandedBiome);
              const biomeGyms = gyms.filter(g => g.biome_key === expandedBiome);
              if (!biome || biomeGyms.length === 0) return null;
              return (
                <View style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 10 }}>{biome.name} GYMS</Text>
                  <View style={{ gap: 8 }}>
                    {biomeGyms.map(gym => {
                      const done = completedSet.has(gym.gym_key);
                      const locked = gym.required_level > level;
                      return (
                        <Pressable key={gym.gym_key} onPress={() => !locked && router.push(`/gym?key=${gym.gym_key}` as any)} disabled={locked}
                          style={[styles.gymCard, { opacity: locked ? 0.4 : 1, borderColor: done ? GOLD + "60" : locked ? "#1a1200" : BORDER }]}>
                          <ArcIcon name={(gym.icon || "workout") as ArcIconName} size={22} color={GOLD} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: done ? GOLD : "#8a6820" }}>{gym.name}</Text>
                            <Text style={{ fontSize: 10, color: "#4a3008", marginTop: 2 }}>{locked ? `Requires Level ${gym.required_level}` : gym.location_hint}</Text>
                          </View>
                          {done && <Text style={{ fontSize: 14, color: GOLD }}>✓</Text>}
                          {!done && !locked && <Text style={{ fontSize: 14, color: "#3a2800" }}>→</Text>}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  biomeCard: { width: "47%", backgroundColor: "rgba(212,160,23,0.03)", borderWidth: 1, borderRadius: 16, padding: 20, position: "relative" },
  gymCard: { backgroundColor: "rgba(212,160,23,0.02)", borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
});
