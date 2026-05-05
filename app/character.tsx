import { useEffect, useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

interface Stats {
  strength: number;
  agility: number;
  vitality: number;
  focus: number;
  wealth: number;
  discipline: number;
  willpower: number;
  total_xp: number;
  level: number;
  archetype: string;
}

interface PrestigeData {
  prestige_count: number;
  prestige_badges: string[];
  legacy_total_xp: number;
}

const STAT_CONFIG: { key: string; label: string; icon: ArcIconName; color: string }[] = [
  { key: "strength", label: "Strength", icon: "workout", color: "#FF4444" },
  { key: "agility", label: "Agility", icon: "bolt", color: "#FFB800" },
  { key: "vitality", label: "Vitality", icon: "heart", color: "#FF6B9D" },
  { key: "focus", label: "Focus", icon: "brain", color: "#7C4DFF" },
  { key: "wealth", label: "Wealth", icon: "moneybag", color: "#00C853" },
  { key: "discipline", label: "Discipline", icon: "target", color: "#2196F3" },
  { key: "willpower", label: "Willpower", icon: "flame", color: "#FF6D00" },
];

const ARCHETYPE_ICONS: Record<string, ArcIconName> = {
  novice: "sparkle", warrior: "swords", runner: "steps", lifter: "workout",
  scholar: "book", entrepreneur: "briefcase", monk: "lotus",
};

export default function CharacterScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [prestige, setPrestige] = useState<PrestigeData | null>(null);
  const [skillPoints, setSkillPoints] = useState(0);

  useEffect(() => { loadCharacter(); }, []);

  const loadCharacter = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: rpgStats } = await supabase.from("rpg_stats").select("*").eq("user_id", user.id).single();
    if (rpgStats) setStats(rpgStats);

    const { data: prestigeData } = await supabase.from("rpg_prestige").select("*").eq("user_id", user.id).single();
    if (prestigeData) setPrestige(prestigeData);

    const { data: sp } = await supabase.from("rpg_skill_points").select("available_points").eq("user_id", user.id).single();
    setSkillPoints(sp?.available_points || 0);
  };

  const triggerXP = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(apiUrl("/api/rpg/xp"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, accessToken: session.access_token }),
    });
    const data = await res.json();
    if (data.newLevel) {
      Alert.alert("Level Up!", `You reached Level ${data.newLevel}!`);
    }
    loadCharacter();
  };

  const handlePrestige = () => {
    Alert.alert(
      "Prestige?",
      "This resets your level, stats, and story progress. You'll earn a prestige badge and permanent XP multiplier.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Prestige", style: "destructive", onPress: async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;
          await fetch(apiUrl("/api/rpg/prestige"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: session.access_token, action: "prestige" }),
          });
          loadCharacter();
        }},
      ]
    );
  };

  if (!stats) return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View style={{ marginBottom: 12 }}><ArcIcon name="swords" size={40} color={colors.text} /></View>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Loading character...</Text>
      </View>
    </SafeAreaView>
  );

  const xpForNext = stats.level * 500;
  const xpInLevel = stats.total_xp - (stats.level - 1) * 500;
  const maxStat = Math.max(...STAT_CONFIG.map(s => (stats as any)[s.key] || 0), 1);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Character</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Character header */}
        <View style={[styles.card, { alignItems: "center", paddingVertical: 24 }]}>
          <ArcIcon name={ARCHETYPE_ICONS[stats.archetype] || "sparkle"} size={48} color={colors.text} />
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text, marginTop: 8 }}>
            Level {stats.level}
          </Text>
          <Text style={{ fontSize: 14, color: colors.text2, marginTop: 4 }}>
            {stats.archetype[0].toUpperCase() + stats.archetype.slice(1)}
            {prestige && prestige.prestige_count > 0 ? ` · Prestige ${prestige.prestige_count}` : ""}
          </Text>
          <View style={{ marginTop: 12, width: "80%" }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface2 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.text, width: `${Math.min(xpInLevel / xpForNext, 1) * 100}%` }} />
            </View>
            <Text style={{ fontSize: 11, color: colors.text3, textAlign: "center", marginTop: 4 }}>{xpInLevel} / {xpForNext} XP</Text>
          </View>
          {prestige && prestige.prestige_badges.length > 0 && (
            <View style={{ flexDirection: "row", gap: 4, marginTop: 12 }}>
              {prestige.prestige_badges.map((_, i) => (
                <ArcIcon key={i} name="star" size={16} color="#FFB800" />
              ))}
            </View>
          )}
        </View>

        {/* Stats */}
        <Text style={styles.sectionLabel}>Stats</Text>
        {STAT_CONFIG.map(stat => {
          const value = (stats as any)[stat.key] || 0;
          const pct = maxStat > 0 ? value / maxStat : 0;
          return (
            <View key={stat.key} style={styles.statRow}>
              <View style={{ width: 30 }}><ArcIcon name={stat.icon} size={18} color={stat.color} /></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{stat.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>{value}</Text>
                </View>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surface2 }}>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: stat.color, width: `${pct * 100}%` }} />
                </View>
              </View>
            </View>
          );
        })}

        {/* Actions */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
          <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={triggerXP}>
            <ArcIcon name="bolt" size={16} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Sync XP</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push("/battle" as any)}>
            <ArcIcon name="swords" size={16} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Battle</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push("/leaderboard" as any)}>
            <ArcIcon name="trophy" size={16} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Ranks</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={() => router.push("/feed" as any)}>
            <ArcIcon name="activity" size={16} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Feed</Text>
          </Pressable>
          {skillPoints > 0 && (
            <Pressable style={[styles.actionBtn, { flex: 1, borderColor: colors.green, borderWidth: 1.5 }]} onPress={() => Alert.alert("Skill Points", `You have ${skillPoints} points to spend. Coming soon!`)}>
              <ArcIcon name="sparkle" size={16} color={colors.text} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.green }}>{skillPoints} pts</Text>
            </Pressable>
          )}
          {stats.total_xp >= 10000 && (
            <Pressable style={[styles.actionBtn, { flex: 1 }]} onPress={handlePrestige}>
              <ArcIcon name="sparkle" size={16} color={colors.text} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>Prestige</Text>
            </Pressable>
          )}
        </View>

        {/* Total XP */}
        <View style={[styles.card, { marginTop: 16, flexDirection: "row", justifyContent: "space-around" }]}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{stats.total_xp.toLocaleString()}</Text>
            <Text style={{ fontSize: 10, color: colors.text2 }}>Total XP</Text>
          </View>
          {prestige && (
            <View style={{ alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{(1 + prestige.prestige_count * 0.05).toFixed(2)}x</Text>
              <Text style={{ fontSize: 10, color: colors.text2 }}>XP Multiplier</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 12, marginTop: 8 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  actionBtn: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 14, alignItems: "center", gap: 4 },
});
