import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet, ActivityIndicator, Alert, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { format, subDays } from "date-fns";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

const MOOD_LABELS = ["", "😞 Rough", "😕 Meh", "😐 OK", "🙂 Good", "😄 Great"];
const MOOD_COLORS = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#6366f1"];

const ALL_ACHIEVEMENTS: { type: string; icon: ArcIconName; title: string; description: string }[] = [
  { type: "first_workout", icon: "workout", title: "First Rep", description: "Log your first workout" },
  { type: "first_nutrition", icon: "plate", title: "Tracked", description: "Log your first meal" },
  { type: "first_weight", icon: "scale", title: "Weighed In", description: "Log your first body weight" },
  { type: "streak_3", icon: "flame", title: "3-Day Streak", description: "3-day momentum streak" },
  { type: "streak_7", icon: "bolt", title: "Week Warrior", description: "7-day momentum streak" },
  { type: "streak_30", icon: "trophy", title: "Unstoppable", description: "30-day momentum streak" },
  { type: "protein_goal_5", icon: "protein", title: "Protein King", description: "Hit protein goal 5 days" },
  { type: "hydration_goal_7", icon: "water", title: "Hydration Hero", description: "Hit water goal 7 days" },
  { type: "steps_goal_7", icon: "steps", title: "Step Master", description: "Hit step goal 7 days" },
  { type: "workouts_10", icon: "workout", title: "Iron Regular", description: "Complete 10 workouts" },
  { type: "workouts_50", icon: "gem", title: "Diamond", description: "Complete 50 workouts" },
  { type: "perfect_day", icon: "star", title: "Perfect Day", description: "Score 100 momentum" },
  { type: "sleep_goal_7", icon: "sleep", title: "Sleep King", description: "Hit sleep goal 7 nights" },
  { type: "finance_goal_complete", icon: "moneybag", title: "Money Moves", description: "Complete a finance goal" },
];

type Tab = "achievements" | "mood" | "photos" | "measurements";

export default function AchievementsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("achievements");
  const [userId, setUserId] = useState("");
  const [achievements, setAchievements] = useState<any[]>([]);
  const [moods, setMoods] = useState<any[]>([]);
  const [todayMood, setTodayMood] = useState(0);
  const [moodNote, setMoodNote] = useState("");
  const [moodSaved, setMoodSaved] = useState(false);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [measForm, setMeasForm] = useState({ waist: "", chest: "", hips: "", arms: "", thighs: "", note: "" });
  const [measSaving, setMeasSaving] = useState(false);
  const [measSaved, setMeasSaved] = useState(false);
  const [photos, setPhotos] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      loadAll(data.user.id);
    });
  }, []);

  const loadAll = async (uid: string) => {
    const [{ data: ach }, { data: md }, { data: ph }, { data: meas }] = await Promise.all([
      supabase.from("achievements").select("*").eq("user_id", uid).order("earned_at", { ascending: false }),
      supabase.from("mood_entries").select("*").eq("user_id", uid).order("date", { ascending: false }).limit(30),
      supabase.from("progress_photos").select("*").eq("user_id", uid).order("date", { ascending: false }),
      supabase.from("body_measurements").select("*").eq("user_id", uid).order("date", { ascending: false }).limit(30),
    ]);
    setAchievements(ach || []);
    setMoods(md || []);
    setPhotos(ph || []);
    setMeasurements(meas || []);
    const today = format(new Date(), "yyyy-MM-dd");
    const todayEntry = (md || []).find((m: any) => m.date === today);
    if (todayEntry) { setTodayMood(todayEntry.mood); setMoodNote(todayEntry.note || ""); setMoodSaved(true); }
    setLoading(false);
  };

  const checkAchievements = async () => {
    setChecking(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setChecking(false); return; }
    await fetch(apiUrl("/api/achievements/check"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, accessToken: session.access_token }),
    });
    await loadAll(userId);
    setChecking(false);
  };

  const saveMood = async () => {
    if (!todayMood) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const existing = moods.find(m => m.date === today);
    if (existing) {
      await supabase.from("mood_entries").update({ mood: todayMood, note: moodNote }).eq("id", existing.id);
    } else {
      await supabase.from("mood_entries").insert({ user_id: userId, date: today, mood: todayMood, note: moodNote });
    }
    setMoodSaved(true);
    loadAll(userId);
  };

  const saveMeasurement = async () => {
    setMeasSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("body_measurements").insert({
      user_id: userId,
      date: today,
      waist: parseFloat(measForm.waist) || null,
      chest: parseFloat(measForm.chest) || null,
      hips: parseFloat(measForm.hips) || null,
      arms: parseFloat(measForm.arms) || null,
      thighs: parseFloat(measForm.thighs) || null,
      unit: "cm",
      note: measForm.note || null,
    });
    const { data: meas } = await supabase.from("body_measurements").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(30);
    setMeasurements(meas || []);
    setMeasForm({ waist: "", chest: "", hips: "", arms: "", thighs: "", note: "" });
    setMeasSaving(false);
    setMeasSaved(true);
    setTimeout(() => setMeasSaved(false), 2000);
  };

  const uploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const ext = asset.uri.split(".").pop() || "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from("progress-photos").upload(path, blob, { upsert: true });
    if (error) { Alert.alert("Upload failed", error.message); return; }
    const { data: urlData } = supabase.storage.from("progress-photos").getPublicUrl(path);
    const today = format(new Date(), "yyyy-MM-dd");
    await supabase.from("progress_photos").insert({ user_id: userId, date: today, url: urlData.publicUrl });
    loadAll(userId);
  };

  const earnedTypes = new Set(achievements.map(a => a.type));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ paddingTop: 8, marginBottom: 16 }}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 4 }}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 10, fontWeight: "600", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase" }}>Progress</Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: DARK, marginTop: 4, letterSpacing: -0.5 }}>Achievements</Text>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: SURFACE, borderRadius: 16, padding: 4, marginBottom: 16 }}>
          {([["achievements", "Badges"], ["mood", "Mood"], ["photos", "Photos"], ["measurements", "Body"]] as const).map(([t, label]) => (
            <Pressable key={t} onPress={() => setTab(t as Tab)}
              style={{ flex: 1, padding: 8, borderRadius: 12, backgroundColor: tab === t ? "white" : "transparent", alignItems: "center" }}>
              <Text style={{ fontSize: 9, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", color: tab === t ? DARK : SUBTITLE }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Badges Tab */}
        {tab === "achievements" && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: "#6b7280", fontWeight: "600" }}>{achievements.length} / {ALL_ACHIEVEMENTS.length} earned</Text>
              <Pressable onPress={checkAchievements} disabled={checking}
                style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: DARK }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 11 }}>{checking ? "Checking..." : "Check Progress"}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {ALL_ACHIEVEMENTS.map(def => {
                const isEarned = earnedTypes.has(def.type);
                const earnedData = achievements.find(a => a.type === def.type);
                return (
                  <View key={def.type} style={{ width: "47%", backgroundColor: SURFACE, borderRadius: 16, padding: 16, opacity: isEarned ? 1 : 0.45 }}>
                    {isEarned && <View style={{ position: "absolute", top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />}
                    <View style={{ marginBottom: 8 }}><ArcIcon name={isEarned ? def.icon : "x"} size={28} color={isEarned ? "#22c55e" : "#C7C7CC"} /></View>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: DARK }}>{def.title}</Text>
                    <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{def.description}</Text>
                    {isEarned && earnedData && (
                      <Text style={{ fontSize: 10, color: "#22c55e", marginTop: 6, fontWeight: "600" }}>
                        {format(new Date(earnedData.earned_at), "MMM d, yyyy")}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Mood Tab */}
        {tab === "mood" && (
          <View style={{ gap: 12 }}>
            <View style={styles.card}>
              <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>How are you feeling today?</Text>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                {[1, 2, 3, 4, 5].map(m => (
                  <Pressable key={m} onPress={() => { setTodayMood(m); setMoodSaved(false); }}
                    style={{ width: 52, height: 52, borderRadius: 16, borderWidth: 2, borderColor: todayMood === m ? MOOD_COLORS[m] : "#f1f5f9", backgroundColor: todayMood === m ? MOOD_COLORS[m] + "20" : "white", alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 24 }}>{MOOD_LABELS[m].split(" ")[0]}</Text>
                  </Pressable>
                ))}
              </View>
              {todayMood > 0 && (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: MOOD_COLORS[todayMood], marginBottom: 12, textAlign: "center" }}>{MOOD_LABELS[todayMood]}</Text>
                  <TextInput
                    placeholder="Add a note (optional)..."
                    placeholderTextColor="#C7C7CC"
                    value={moodNote}
                    onChangeText={v => { setMoodNote(v); setMoodSaved(false); }}
                    style={{ backgroundColor: BG, borderRadius: 12, padding: 12, fontSize: 13, color: DARK, marginBottom: 10 }}
                  />
                  <Pressable onPress={saveMood} style={{ padding: 12, borderRadius: 12, backgroundColor: moodSaved ? "#22c55e" : DARK, alignItems: "center" }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>{moodSaved ? "Saved ✓" : "Save Mood"}</Text>
                  </Pressable>
                </>
              )}
            </View>

            {moods.length > 0 && (
              <View style={styles.card}>
                <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>Last 30 Days</Text>
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                  {Array.from({ length: 30 }, (_, i) => {
                    const d = format(subDays(new Date(), 29 - i), "yyyy-MM-dd");
                    const entry = moods.find(m => m.date === d);
                    return (
                      <View key={d} style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: entry ? MOOD_COLORS[entry.mood] : "#f1f5f9", alignItems: "center", justifyContent: "center" }}>
                        {entry && <Text style={{ fontSize: 12 }}>{MOOD_LABELS[entry.mood].split(" ")[0]}</Text>}
                      </View>
                    );
                  })}
                </View>
                {moods.slice(0, 7).map(m => (
                  <View key={m.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: MOOD_COLORS[m.mood] + "20", alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ fontSize: 18 }}>{MOOD_LABELS[m.mood].split(" ")[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: DARK }}>{format(new Date(m.date), "EEEE, MMM d")}</Text>
                      {m.note ? <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{m.note}</Text> : null}
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: MOOD_COLORS[m.mood] }}>{MOOD_LABELS[m.mood].split(" ").slice(1).join(" ")}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Photos Tab */}
        {tab === "photos" && (
          <View style={{ gap: 12 }}>
            <Pressable onPress={uploadPhoto} style={{ padding: 14, borderRadius: 12, backgroundColor: DARK, alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>Choose Photo</Text>
            </Pressable>
            {photos.length === 0 ? (
              <View style={[styles.card, { alignItems: "center", paddingVertical: 40 }]}>
                <ArcIcon name="camera" size={32} color="#C7C7CC" />
                <Text style={{ color: SUBTITLE, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 12 }}>No photos yet</Text>
                <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 8 }}>Track your physical transformation over time</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {photos.map(p => (
                  <View key={p.id} style={{ width: "47%", borderRadius: 16, overflow: "hidden", backgroundColor: SURFACE }}>
                    <Image source={{ uri: p.url }} style={{ width: "100%", aspectRatio: 3 / 4 }} />
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontSize: 11, fontWeight: "700", color: DARK }}>{format(new Date(p.date), "MMM d, yyyy")}</Text>
                      {p.note ? <Text style={{ fontSize: 10, color: SUBTITLE, marginTop: 2 }}>{p.note}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Measurements Tab */}
        {tab === "measurements" && (
          <View style={{ gap: 16 }}>
            <View style={styles.card}>
              <Text style={{ fontSize: 13, fontWeight: "800", color: DARK, marginBottom: 16 }}>Log Measurements</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                {[{ key: "waist", label: "Waist" }, { key: "chest", label: "Chest" }, { key: "hips", label: "Hips" }, { key: "arms", label: "Arms" }, { key: "thighs", label: "Thighs" }].map(({ key, label }) => (
                  <View key={key} style={{ width: "47%", backgroundColor: BG, borderRadius: 12, padding: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: "800", color: SUBTITLE, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{label} (cm)</Text>
                    <TextInput
                      keyboardType="numeric"
                      value={(measForm as any)[key]}
                      onChangeText={v => setMeasForm(f => ({ ...f, [key]: v }))}
                      placeholder="0"
                      placeholderTextColor="#C7C7CC"
                      style={{ fontSize: 18, fontWeight: "800", color: DARK, padding: 0 }}
                    />
                  </View>
                ))}
                <View style={{ width: "47%", backgroundColor: BG, borderRadius: 12, padding: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: SUBTITLE, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Note</Text>
                  <TextInput
                    value={measForm.note}
                    onChangeText={v => setMeasForm(f => ({ ...f, note: v }))}
                    placeholder="Optional"
                    placeholderTextColor="#C7C7CC"
                    style={{ fontSize: 14, fontWeight: "600", color: DARK, padding: 0 }}
                  />
                </View>
              </View>
              <Pressable onPress={saveMeasurement} disabled={measSaving}
                style={{ padding: 14, borderRadius: 14, backgroundColor: measSaved ? "#22c55e" : DARK, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 14 }}>{measSaved ? "Saved ✓" : measSaving ? "Saving..." : "Save Measurements"}</Text>
              </Pressable>
            </View>

            {measurements.length > 0 && (
              <View style={styles.card}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: DARK, marginBottom: 14 }}>History</Text>
                {measurements.map((m: any) => (
                  <View key={m.id} style={{ borderBottomWidth: 1, borderBottomColor: "#f1f5f9", paddingBottom: 12, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: SUBTITLE, marginBottom: 6 }}>{m.date}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {[{ k: "waist", l: "Waist" }, { k: "chest", l: "Chest" }, { k: "hips", l: "Hips" }, { k: "arms", l: "Arms" }, { k: "thighs", l: "Thighs" }].filter(({ k }) => m[k]).map(({ k, l }) => (
                        <View key={k} style={{ backgroundColor: BG, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontSize: 10, color: SUBTITLE }}>{l}</Text>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: DARK }}>{m[k]}cm</Text>
                        </View>
                      ))}
                    </View>
                    {m.note && <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>{m.note}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: SURFACE, borderRadius: 20, padding: 20 },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, color: SUBTITLE, textTransform: "uppercase" },
});
