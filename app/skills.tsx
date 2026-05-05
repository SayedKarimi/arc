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
const GOLD_DARK = "#4a3008";
const BORDER = "#2a1800";

interface SkillNode {
  key: string; name: string; description: string;
  cost: number; statKey: string; statRequired: number; parentKey?: string;
}

const PILLARS = [
  { key: "FITNESS", label: "Fitness", icon: "swords" as ArcIconName, statKey: "strength", skills: [
    { key: "warrior_spirit", name: "Warrior Spirit", description: "Unlock workout templates and +5 XP per workout type recognized.", cost: 1, statKey: "strength", statRequired: 100 },
    { key: "iron_will", name: "Iron Will", description: "Gain +10% STR XP on every workout day.", cost: 1, statKey: "strength", statRequired: 300, parentKey: "warrior_spirit" },
    { key: "combat_ready", name: "Combat Ready", description: "Unlock the in-workout rest timer.", cost: 1, statKey: "strength", statRequired: 200, parentKey: "warrior_spirit" },
  ]},
  { key: "NUTRITION", label: "Nutrition", icon: "plate" as ArcIconName, statKey: "vitality", skills: [
    { key: "meal_planner", name: "Meal Planner", description: "Unlock the meal planning tools in Nutrition.", cost: 1, statKey: "vitality", statRequired: 80 },
    { key: "meal_prep", name: "Meal Prep", description: "Unlock AI-powered meal plan generation.", cost: 1, statKey: "vitality", statRequired: 200, parentKey: "meal_planner" },
    { key: "macro_master", name: "Macro Master", description: "Gain +5% FOC XP whenever you hit your nutrition goals.", cost: 2, statKey: "vitality", statRequired: 400, parentKey: "meal_planner" },
  ]},
  { key: "FINANCE", label: "Finance", icon: "moneybag" as ArcIconName, statKey: "wealth", skills: [
    { key: "budget_hawk", name: "Budget Hawk", description: "Enhanced budget tracking with daily breakdowns.", cost: 1, statKey: "wealth", statRequired: 100 },
    { key: "investor_mind", name: "Investor Mind", description: "Unlock the net worth tracker in Finance.", cost: 2, statKey: "wealth", statRequired: 300, parentKey: "budget_hawk" },
    { key: "wealth_builder", name: "Wealth Builder", description: "Gain +10% WLT XP on days you stay under budget.", cost: 1, statKey: "wealth", statRequired: 200, parentKey: "budget_hawk" },
  ]},
  { key: "FOCUS", label: "Focus", icon: "target" as ArcIconName, statKey: "focus", skills: [
    { key: "deep_work", name: "Deep Work", description: "Unlock task batching and focus session mode.", cost: 1, statKey: "focus", statRequired: 150 },
    { key: "scholar", name: "Scholar", description: "Unlock advanced AI insights and analysis.", cost: 2, statKey: "focus", statRequired: 350, parentKey: "deep_work" },
    { key: "flow_state", name: "Flow State", description: "Gain +10% FOC XP on days with 5+ completed tasks.", cost: 1, statKey: "focus", statRequired: 250, parentKey: "deep_work" },
  ]},
  { key: "VITALITY", label: "Vitality", icon: "heart" as ArcIconName, statKey: "vitality", skills: [
    { key: "recovery", name: "Recovery", description: "Enhanced sleep tracking with sleep quality insights.", cost: 1, statKey: "vitality", statRequired: 100 },
    { key: "mindfulness", name: "Mindfulness", description: "Gain +10% VIT XP on days with 7+ hours of sleep.", cost: 1, statKey: "vitality", statRequired: 250, parentKey: "recovery" },
    { key: "iron_health", name: "Iron Health", description: "Unlock perfect sleep streak bonus XP.", cost: 2, statKey: "vitality", statRequired: 500, parentKey: "recovery" },
  ]},
  { key: "DISCIPLINE", label: "Discipline", icon: "shield" as ArcIconName, statKey: "discipline", skills: [
    { key: "daily_ritual", name: "Daily Ritual", description: "Unlock logging streak badge and milestone rewards.", cost: 1, statKey: "discipline", statRequired: 100 },
    { key: "monk_mode", name: "Monk Mode", description: "Gain +10% DIS XP on days you log 5+ modules.", cost: 1, statKey: "discipline", statRequired: 200, parentKey: "daily_ritual" },
    { key: "habit_forge", name: "Habit Forge", description: "Unlock custom habit templates.", cost: 2, statKey: "discipline", statRequired: 400, parentKey: "daily_ritual" },
  ]},
];

export default function SkillsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [skillPoints, setSkillPoints] = useState(0);
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmSkill, setConfirmSkill] = useState<SkillNode | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Sync skill points
      await fetch(apiUrl("/api/rpg/skill-points/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: session.access_token }),
      });

      const [statsRes, ptsRes, ulRes] = await Promise.all([
        supabase.from("rpg_stats").select("*").eq("user_id", user.id).single(),
        supabase.from("rpg_skill_points").select("available_points").eq("user_id", user.id).single(),
        supabase.from("rpg_unlocked_skills").select("skill_key").eq("user_id", user.id),
      ]);

      setStats(statsRes.data || {});
      setSkillPoints(ptsRes.data?.available_points ?? 0);
      setUnlocked((ulRes.data || []).map((r: any) => r.skill_key));
    } catch {}
    setLoading(false);
  };

  const handleUnlock = async (skill: SkillNode) => {
    if (skillPoints < skill.cost) return;
    setUnlocking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("rpg_unlocked_skills").insert({ user_id: user.id, skill_key: skill.key });
      await supabase.from("rpg_skill_points").update({ available_points: skillPoints - skill.cost }).eq("user_id", user.id);
      setUnlocked(prev => [...prev, skill.key]);
      setSkillPoints(prev => prev - skill.cost);
      setToast(`✓ ${skill.name} unlocked!`);
      setTimeout(() => setToast(null), 3000);
    } catch {}
    setConfirmSkill(null);
    setUnlocking(false);
  };

  const pillar = PILLARS[activeTab];
  const statValue = stats ? (stats[pillar.statKey] || 0) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 16 }}>
          <Pressable onPress={() => router.push("/world" as any)}>
            <Text style={{ fontSize: 20, color: GOLD_DIM }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 11, fontWeight: "800", letterSpacing: 2, color: GOLD, textTransform: "uppercase" }}>Skill Trees</Text>
          <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(212,160,23,0.1)", borderWidth: 1, borderColor: "#3a2800", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <ArcIcon name="sparkle" size={12} color={GOLD} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: GOLD }}>{skillPoints}</Text>
            <Text style={{ fontSize: 9, color: GOLD_DIM, fontWeight: "700", letterSpacing: 0.8 }}>PTS</Text>
          </View>
        </View>

        {/* Pillar tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", gap: 4 }}>
            {PILLARS.map((p, i) => (
              <Pressable key={p.key} onPress={() => setActiveTab(i)}
                style={[styles.pillarTab, i === activeTab && styles.pillarTabActive]}>
                <ArcIcon name={p.icon} size={14} color={GOLD} />
                <Text style={[styles.pillarTabText, i === activeTab && { color: GOLD }]}>{p.label.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Stat context */}
            <View style={styles.statCard}>
              <View>
                <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: GOLD_DIM, textTransform: "uppercase", marginBottom: 2 }}>{pillar.statKey.toUpperCase()} stat</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: GOLD, letterSpacing: -1 }}>{statValue}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: GOLD_DIM, marginBottom: 2 }}>UNLOCKED</Text>
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#8a6820" }}>
                  {pillar.skills.filter(s => unlocked.includes(s.key)).length}/{pillar.skills.length}
                </Text>
              </View>
            </View>

            {/* Skill list */}
            <View style={{ gap: 8, marginTop: 20 }}>
              {pillar.skills.map(skill => {
                const isUnlocked = unlocked.includes(skill.key);
                return (
                  <Pressable key={skill.key} onPress={() => !isUnlocked && setConfirmSkill(skill)}
                    style={[styles.skillCard, isUnlocked && { borderColor: "#3a2800", backgroundColor: "rgba(212,160,23,0.08)" }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "800", color: isUnlocked ? GOLD : GOLD_DIM, marginBottom: 3 }}>
                        {skill.name}{isUnlocked ? " ✓" : ""}
                      </Text>
                      <Text style={{ fontSize: 11, color: GOLD_DARK, lineHeight: 16 }}>{skill.description}</Text>
                      <Text style={{ fontSize: 10, color: "#3a2800", marginTop: 4 }}>
                        Requires: {skill.statKey.toUpperCase()} ≥ {skill.statRequired}
                        {skill.parentKey && ` · Needs ${pillar.skills.find(s => s.key === skill.parentKey)?.name}`}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "800", color: isUnlocked ? GOLD_DIM : GOLD }}>
                      {isUnlocked ? "Unlocked" : `${skill.cost} pt${skill.cost !== 1 ? "s" : ""}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Confirm overlay */}
      {confirmSkill && (
        <Pressable style={styles.overlay} onPress={() => !unlocking && setConfirmSkill(null)}>
          <View style={styles.sheet}>
            <Text style={{ fontSize: 9, fontWeight: "800", letterSpacing: 2, color: GOLD_DIM, textTransform: "uppercase", textAlign: "center", marginBottom: 16 }}>Unlock Skill</Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: GOLD, textAlign: "center", marginBottom: 6 }}>{confirmSkill.name}</Text>
            <Text style={{ fontSize: 13, color: "#8a6820", textAlign: "center", lineHeight: 20, marginBottom: 20 }}>{confirmSkill.description}</Text>
            <Text style={{ fontSize: 13, color: GOLD_DIM, textAlign: "center", marginBottom: 24 }}>
              Cost: <Text style={{ fontWeight: "900", color: GOLD }}>{confirmSkill.cost} point{confirmSkill.cost !== 1 ? "s" : ""}</Text> ({skillPoints} available)
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable onPress={() => setConfirmSkill(null)} disabled={unlocking}
                style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: "#1a1200", borderWidth: 1, borderColor: BORDER, alignItems: "center" }}>
                <Text style={{ color: GOLD_DIM, fontSize: 13, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => handleUnlock(confirmSkill)} disabled={unlocking}
                style={{ flex: 2, padding: 14, borderRadius: 14, backgroundColor: "rgba(212,160,23,0.15)", borderWidth: 1, borderColor: GOLD, alignItems: "center" }}>
                <Text style={{ color: GOLD, fontSize: 13, fontWeight: "800" }}>{unlocking ? "Unlocking..." : "Confirm Unlock"}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      )}

      {/* Toast */}
      {toast && (
        <View style={styles.toast}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: GOLD, letterSpacing: 0.5 }}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pillarTab: { padding: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: "#1a1200", alignItems: "center", gap: 2 },
  pillarTabActive: { borderColor: GOLD, backgroundColor: "rgba(212,160,23,0.12)" },
  pillarTabText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, color: GOLD_DIM },
  statCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: "rgba(212,160,23,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 16 },
  skillCard: { padding: 14, backgroundColor: "rgba(212,160,23,0.03)", borderWidth: 1, borderColor: "#1a1200", borderRadius: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", alignItems: "center", zIndex: 100 },
  sheet: { backgroundColor: "#1a1200", borderWidth: 1, borderColor: BORDER, borderRadius: 24, padding: 24, width: "85%" },
  toast: { position: "absolute", bottom: 100, alignSelf: "center", backgroundColor: "rgba(212,160,23,0.15)", borderWidth: 1, borderColor: GOLD, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
});
