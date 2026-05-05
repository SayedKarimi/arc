import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, RefreshControl, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

interface Challenge {
  id: string;
  title: string;
  type: string;
  goal: number;
  start_date: string;
  end_date: string;
  creator_id: string;
}

const CHALLENGE_TYPES: { key: string; label: string; icon: ArcIconName; defaultGoal: number }[] = [
  { key: "steps", label: "Steps", icon: "steps", defaultGoal: 10000 },
  { key: "calories", label: "Calories", icon: "flame", defaultGoal: 2000 },
  { key: "workouts", label: "Workouts", icon: "workout", defaultGoal: 5 },
  { key: "hydration", label: "Water", icon: "water", defaultGoal: 2500 },
  { key: "protein", label: "Protein", icon: "protein", defaultGoal: 150 },
];

export default function ChallengesScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("steps");
  const [newGoal, setNewGoal] = useState("10000");
  const [newDays, setNewDays] = useState("7");

  const loadChallenges = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: participations } = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .eq("user_id", user.id);
    const ids = (participations || []).map(p => p.challenge_id);
    if (ids.length > 0) {
      const { data } = await supabase.from("challenges").select("*").in("id", ids).order("start_date", { ascending: false });
      setChallenges(data || []);
    } else {
      setChallenges([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadChallenges(); }, [loadChallenges]);

  const createChallenge = async () => {
    if (!newTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const id = Math.random().toString(36).slice(2);
    const endDate = format(new Date(Date.now() + (parseInt(newDays) || 7) * 86400000), "yyyy-MM-dd");
    await supabase.from("challenges").insert({
      id,
      creator_id: user.id,
      title: newTitle,
      type: newType,
      goal: parseInt(newGoal) || 10000,
      start_date: format(new Date(), "yyyy-MM-dd"),
      end_date: endDate,
      invitee_ids: [],
    });
    await supabase.from("challenge_participants").insert({
      id: Math.random().toString(36).slice(2),
      challenge_id: id,
      user_id: user.id,
    });
    const { data: fships } = await supabase.from("friendships")
      .select("requester_id,addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .eq("status", "accepted");
    const friendIds = (fships || []).map(f => f.requester_id === user.id ? f.addressee_id : f.requester_id);
    if (friendIds.length > 0) {
      const participants = friendIds.map(fid => ({
        id: Math.random().toString(36).slice(2),
        challenge_id: id,
        user_id: fid,
      }));
      await supabase.from("challenge_participants").insert(participants);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowCreate(false);
    setNewTitle("");
    loadChallenges();
  };

  const getTypeInfo = (type: string) => CHALLENGE_TYPES.find(t => t.key === type) || CHALLENGE_TYPES[0];
  const isActive = (c: Challenge) => new Date(c.end_date) >= new Date();
  const activeChallenges = challenges.filter(isActive);
  const pastChallenges = challenges.filter(c => !isActive(c));

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={styles.title}>Challenges</Text>
        </View>
        <Pressable style={styles.createBtn} onPress={() => setShowCreate(true)}>
          <Text style={{ color: colors.bg, fontSize: 18, fontWeight: "700" }}>+</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadChallenges(); }} tintColor={colors.text} />}
      >
        {activeChallenges.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Active</Text>
            {activeChallenges.map(c => {
              const info = getTypeInfo(c.type);
              return (
                <View key={c.id} style={styles.card}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ArcIcon name={info.icon} size={28} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{c.title}</Text>
                      <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>
                        Goal: {c.goal.toLocaleString()} {info.label.toLowerCase()} · Ends {c.end_date}
                      </Text>
                    </View>
                    <View style={styles.liveBadge}>
                      <Text style={{ fontSize: 10, fontWeight: "800", color: colors.green }}>LIVE</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {pastChallenges.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Past</Text>
            {pastChallenges.map(c => {
              const info = getTypeInfo(c.type);
              return (
                <View key={c.id} style={[styles.card, { opacity: 0.6 }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <ArcIcon name={info.icon} size={24} color={colors.text} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{c.title}</Text>
                      <Text style={{ fontSize: 11, color: colors.text2 }}>{c.start_date} → {c.end_date}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {challenges.length === 0 && !loading && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ marginBottom: 8 }}><ArcIcon name="swords" size={48} color={colors.text3} /></View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>No challenges yet</Text>
            <Text style={{ fontSize: 13, color: colors.text2, marginTop: 4 }}>Create one to compete with friends</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>New Challenge</Text>
              <Pressable onPress={() => setShowCreate(false)}>
                <Text style={{ fontSize: 16, color: colors.text2 }}>Cancel</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} placeholder="e.g. Step Battle" placeholderTextColor={colors.text3} value={newTitle} onChangeText={setNewTitle} />

            <Text style={[styles.label, { marginTop: 16 }]}>Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {CHALLENGE_TYPES.map(t => (
                <Pressable key={t.key} onPress={() => { setNewType(t.key); setNewGoal(String(t.defaultGoal)); }} style={[styles.chip, newType === t.key && styles.chipActive]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ArcIcon name={t.icon} size={14} color={newType === t.key ? "white" : colors.text2} /><Text style={[styles.chipText, newType === t.key && styles.chipTextActive]}>{t.label}</Text></View>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Daily Goal</Text>
                <TextInput style={styles.input} value={newGoal} onChangeText={setNewGoal} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Days</Text>
                <TextInput style={styles.input} value={newDays} onChangeText={setNewDays} keyboardType="number-pad" />
              </View>
            </View>

            <Text style={{ fontSize: 12, color: colors.text2, marginTop: 12, marginBottom: 20 }}>All your friends will be automatically invited.</Text>

            <Pressable style={styles.saveBtn} onPress={createChallenge}>
              <Text style={{ color: colors.bg, fontSize: 16, fontWeight: "800" }}>Create & Invite Friends</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  createBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  liveBadge: { backgroundColor: colors.green + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  label: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.bg },
  saveBtn: { backgroundColor: colors.text, borderRadius: radius.lg, padding: 18, alignItems: "center", marginTop: 8 },
});
