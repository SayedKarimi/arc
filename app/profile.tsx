import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { getSettings, updateSettings } from "@/lib/supabase/queries";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

const GOALS = ["Lose weight", "Gain muscle", "Maintain", "Get healthier", "Build strength"];
const ACTIVITY_LEVELS = ["Sedentary", "Lightly active", "Moderately active", "Very active", "Athlete"];

export default function ProfileScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [age, setAge] = useState("");
  const [stepGoal, setStepGoal] = useState("10000");
  const [hydrationGoal, setHydrationGoal] = useState("2500");
  const [sleepGoal, setSleepGoal] = useState("8");

  useEffect(() => {
    getSettings().then(s => {
      setName(s?.name || "");
      setGoal(s?.goal || "");
      setActivityLevel(s?.activity_level || s?.activityLevel || "");
      setWeight(String(s?.weight || ""));
      setHeight(String(s?.height || ""));
      setAge(String(s?.age || ""));
      setStepGoal(String(s?.step_goal || s?.stepGoal || 10000));
      setHydrationGoal(String(s?.hydration_goal || s?.hydrationGoal || 2500));
      setSleepGoal(String(s?.sleep_goal || s?.sleepGoal || 8));
    });
  }, []);

  const save = async () => {
    const updates: any = {
      name,
      goal,
      activity_level: activityLevel,
      step_goal: parseInt(stepGoal) || 10000,
      hydration_goal: parseInt(hydrationGoal) || 2500,
      sleep_goal: parseInt(sleepGoal) || 8,
    };
    if (weight) updates.weight = parseFloat(weight);
    if (height) updates.height = parseFloat(height);
    if (age) updates.age = parseInt(age);

    await updateSettings(updates);

    // Also update profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        username: name,
        updated_at: new Date().toISOString(),
      });
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved!", "Profile updated.");
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Edit Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.text3} />

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Age</Text>
              <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="—" placeholderTextColor={colors.text3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Height (in)</Text>
              <TextInput style={styles.input} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.text3} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Weight (lbs)</Text>
              <TextInput style={styles.input} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.text3} />
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Goal</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {GOALS.map(g => (
              <Pressable key={g} onPress={() => setGoal(g)} style={[styles.chip, goal === g && styles.chipActive]}>
                <Text style={[styles.chipText, goal === g && styles.chipTextActive]}>{g}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Activity Level</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {ACTIVITY_LEVELS.map(a => (
              <Pressable key={a} onPress={() => setActivityLevel(a)} style={[styles.chip, activityLevel === a && styles.chipActive]}>
                <Text style={[styles.chipText, activityLevel === a && styles.chipTextActive]}>{a}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Daily Goals</Text>
          <View style={styles.goalRow}>
            <ArcIcon name="steps" size={16} color={colors.text} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>Step goal</Text>
            <TextInput style={styles.goalInput} value={stepGoal} onChangeText={setStepGoal} keyboardType="number-pad" />
          </View>
          <View style={styles.goalRow}>
            <ArcIcon name="water" size={16} color={colors.text} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>Water goal (ml)</Text>
            <TextInput style={styles.goalInput} value={hydrationGoal} onChangeText={setHydrationGoal} keyboardType="number-pad" />
          </View>
          <View style={styles.goalRow}>
            <ArcIcon name="sleep" size={16} color={colors.text} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.text }}>Sleep goal (hrs)</Text>
            <TextInput style={styles.goalInput} value={sleepGoal} onChangeText={setSleepGoal} keyboardType="decimal-pad" />
          </View>
        </View>

        <Pressable style={styles.saveBtn} onPress={save}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.bg }}>Save Changes</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bg },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.text },
  chipTextActive: { color: colors.bg },
  goalRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  goalInput: { width: 70, height: 40, borderRadius: radius.md, backgroundColor: colors.bg, textAlign: "center", fontSize: 15, fontWeight: "700", color: colors.text, borderWidth: 1, borderColor: colors.border },
  saveBtn: { backgroundColor: colors.text, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", marginTop: 12 },
});
