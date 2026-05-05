import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";

const BG = "#FFFFFF";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const CARD_BG = "#F2F2F7";

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [gender, setGender] = useState("Male");
  const [goalWeight, setGoalWeight] = useState("");
  const [stepGoal, setStepGoal] = useState("10000");
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showGoalEdit, setShowGoalEdit] = useState(false);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [weightUnit, setWeightUnit] = useState("lbs");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: settings } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (settings) {
      if (settings.name) setName(settings.name);
      if (settings.age) setAge(String(settings.age));
      if (settings.height) setHeight(String(settings.height));
      if (settings.gender) setGender(settings.gender);
      if (settings.goal_weight) setGoalWeight(String(settings.goal_weight));
      if (settings.step_goal) setStepGoal(String(settings.step_goal));
    }
    const { data: bw } = await supabase
      .from("body_weight_entries")
      .select("weight,unit")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false })
      .limit(1);
    if (bw?.[0]) {
      setLatestWeight(bw[0].weight);
      setWeightUnit(bw[0].unit || "lbs");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_settings").upsert({
      user_id: user.id,
      name,
      age: Number(age) || null,
      height: Number(height) || null,
      gender,
      goal_weight: Number(goalWeight) || null,
      step_goal: Number(stepGoal) || 10000,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  const bmi = latestWeight && height ? (() => {
    const weightKg = weightUnit === "kg" ? latestWeight : latestWeight / 2.2046;
    const heightM = Number(height) / 100;
    if (heightM <= 0) return null;
    return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
  })() : null;

  const bmiCat = bmi
    ? bmi < 18.5 ? { label: "Underweight", color: "#FF9F0A" }
    : bmi < 25 ? { label: "Normal", color: "#34C759" }
    : bmi < 30 ? { label: "Overweight", color: "#FF9F0A" }
    : { label: "Obese", color: "#FF3B30" }
    : null;

  const genders = ["Male", "Female", "Other"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Personal Details</Text>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {/* BMI Card */}
          {bmi && bmiCat && (
            <View style={[styles.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
              <View>
                <Text style={styles.cardLabel}>BMI</Text>
                <Text style={{ fontSize: 32, fontWeight: "900", color: DARK }}>{bmi}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: bmiCat.color }}>{bmiCat.label}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ fontSize: 12, color: SUBTITLE }}>Weight: {latestWeight}{weightUnit}</Text>
                <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>Height: {height}cm</Text>
              </View>
            </View>
          )}

          {/* Goal Weight Card */}
          <View style={[styles.card, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
            <View>
              <Text style={styles.cardLabel}>Goal Weight</Text>
              {showGoalEdit ? (
                <TextInput
                  value={goalWeight}
                  onChangeText={setGoalWeight}
                  keyboardType="numeric"
                  placeholder="lbs"
                  autoFocus
                  style={{ fontSize: 28, fontWeight: "900", color: DARK, padding: 0, minWidth: 100 }}
                />
              ) : (
                <Text style={{ fontSize: 28, fontWeight: "900", color: DARK }}>
                  {goalWeight ? `${goalWeight} lbs` : "Not set"}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() => setShowGoalEdit(v => !v)}
              style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 99, backgroundColor: DARK }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>
                {showGoalEdit ? "Done" : "Change Goal"}
              </Text>
            </Pressable>
          </View>

          {/* Detail Rows */}
          <View style={styles.card}>
            {/* Gender */}
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Gender</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {genders.map(g => (
                  <Pressable key={g} onPress={() => setGender(g)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: gender === g ? DARK : "#E5E5EA" }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: gender === g ? "white" : SUBTITLE }}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {[
              { label: "Name", value: name, onChange: setName, keyboard: "default" as const },
              { label: "Age", value: age, onChange: setAge, keyboard: "numeric" as const },
              { label: "Height (cm)", value: height, onChange: setHeight, keyboard: "numeric" as const },
              { label: "Daily Steps Goal", value: stepGoal, onChange: setStepGoal, keyboard: "numeric" as const },
            ].map((row) => (
              <View key={row.label} style={[styles.row, { borderTopWidth: 1, borderTopColor: "#E5E5EA" }]}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <TextInput
                  value={row.value}
                  onChangeText={row.onChange}
                  keyboardType={row.keyboard}
                  placeholder="—"
                  placeholderTextColor="#C7C7CC"
                  style={{ fontSize: 16, color: SUBTITLE, textAlign: "right", minWidth: 80, padding: 0 }}
                />
              </View>
            ))}
          </View>

          {/* Save Button */}
          <Pressable onPress={handleSave} style={[styles.saveBtn, { backgroundColor: saved ? "#34C759" : DARK }]}>
            <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>
              {saved ? "Saved ✓" : "Save"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: CARD_BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: CARD_BG, borderRadius: 24, padding: 20, marginBottom: 16 },
  cardLabel: { fontSize: 11, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 16 },
  rowLabel: { fontSize: 16, fontWeight: "500", color: DARK },
  saveBtn: { width: "100%", padding: 16, borderRadius: 20, alignItems: "center" },
});
