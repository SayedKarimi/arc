import { useState } from "react";
import {
  View, Text, Pressable, TextInput, StyleSheet, ScrollView, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { getSettings, updateSettings } from "@/lib/supabase/queries";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const DARK = "#1C1C1E";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";

const GOALS: { key: "lose" | "gain" | "maintain" | "recomp"; icon: ArcIconName; label: string; desc: string }[] = [
  { key: "lose", icon: "recap", label: "Lose Fat", desc: "Calorie deficit" },
  { key: "gain", icon: "workout", label: "Build Muscle", desc: "Calorie surplus" },
  { key: "maintain", icon: "scale", label: "Stay Healthy", desc: "Maintain weight" },
  { key: "recomp", icon: "refresh", label: "Body Recomp", desc: "Burn fat, build muscle" },
];

const ACTIVITY_LEVELS = [
  { key: "sedentary" as const, label: "Sedentary", desc: "Desk job, little exercise" },
  { key: "light" as const, label: "Lightly Active", desc: "1–3 workouts/week" },
  { key: "moderate" as const, label: "Moderately Active", desc: "3–5 workouts/week" },
  { key: "active" as const, label: "Very Active", desc: "6–7 hard workouts/week" },
];

const DIET_TYPES = ["None", "Halal", "Kosher", "Pescatarian", "Vegetarian", "Vegan"];
const PROTEIN_OPTS = ["Chicken", "Beef", "Fish", "Pork", "Plant-based"];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<"lose" | "gain" | "maintain" | "recomp">("maintain");
  const [sex, setSex] = useState<"male" | "female">("male");
  const [age, setAge] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightVal, setWeightVal] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [activity, setActivity] = useState<"sedentary" | "light" | "moderate" | "active">("moderate");
  const [dietaryType, setDietaryType] = useState<string[]>([]);
  const [dietaryProtein, setDietaryProtein] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const totalSteps = 8; // welcome, name, goal, sex+age, height, weight, activity, dietary, plan

  const computePlan = () => {
    const ageNum = parseFloat(age) || 25;
    const weightKg = weightUnit === "kg" ? (parseFloat(weightVal) || 70) : (parseFloat(weightVal) || 154) / 2.2046;
    const hCm = (parseFloat(heightFt) || 5) * 30.48 + (parseFloat(heightIn) || 9) * 2.54;
    const bmr = sex === "male"
      ? 10 * weightKg + 6.25 * hCm - 5 * ageNum + 5
      : 10 * weightKg + 6.25 * hCm - 5 * ageNum - 161;
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = Math.round(bmr * multipliers[activity]);
    const goalAdjust = { lose: -500, gain: 300, maintain: 0, recomp: 0 };
    const targetCals = Math.max(1200, tdee + goalAdjust[goal]);
    const proteinFactor = goal === "lose" || goal === "recomp" ? 2.2 : goal === "gain" ? 2.0 : 1.8;
    const protein = Math.round(weightKg * proteinFactor);
    const fatCals = Math.round(targetCals * 0.28);
    const fat = Math.round(fatCals / 9);
    const carbs = Math.max(50, Math.round((targetCals - protein * 4 - fatCals) / 4));
    return { calories: targetCals, protein, carbs, fat, fiber: 30 };
  };

  const plan = computePlan();

  const toggleDietaryType = (val: string) => {
    if (val === "None") { setDietaryType([]); return; }
    setDietaryType(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev.filter(v => v !== "None"), val]);
  };

  const handleNext = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps) {
      setStep(step + 1);
      return;
    }
    // Final step - save
    setSaving(true);
    try {
      const macroTargets = computePlan();
      const hCm = (parseFloat(heightFt) || 5) * 30.48 + (parseFloat(heightIn) || 9) * 2.54;
      const s = await getSettings();
      await updateSettings({
        ...s,
        name: name || (s?.name !== "You" ? s?.name : "You"),
        height: Math.round(hCm),
        age: parseInt(age) || undefined,
        macroTargets,
        dietaryPreferences: { type: dietaryType, protein: dietaryProtein },
        onboarding_complete: true,
      } as any);

      const { data: { user } } = await supabase.auth.getUser();
      if (user && name) {
        await supabase.from("profiles").upsert({ id: user.id, username: name });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } finally { setSaving(false); }
  };

  const handleBack = () => { if (step > 0) setStep(step - 1); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      {/* Progress dots */}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 16, paddingBottom: 20 }}>
        {Array.from({ length: totalSteps + 1 }).map((_, i) => (
          <View key={i} style={{ width: i === step ? 18 : 6, height: 6, borderRadius: 99, backgroundColor: i <= step ? DARK : "#C7C7CC" }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ flex: 1, paddingHorizontal: 24 }} keyboardShouldPersistTaps="handled">
        {/* Step 0: Welcome splash */}
        {step === 0 && (
          <View>
            <View style={{ alignItems: "center", marginBottom: 16 }}><ArcIcon name="sparkle" size={88} color="#FFB800" /></View>
            <Text style={styles.heading}>Welcome to Arc</Text>
            <Text style={styles.subtitle}>Your personal health OS</Text>
            <Text style={{ fontSize: 16, color: SUBTITLE, textAlign: "center", lineHeight: 26, marginBottom: 24 }}>
              Track nutrition, workouts, sleep, and more — all powered by AI.
            </Text>
            <View style={{ gap: 10 }}>
              {[
                { icon: "plate" as ArcIconName, text: "AI food scanning" },
                { icon: "workout" as ArcIconName, text: "Workout tracking" },
                { icon: "sleep" as ArcIconName, text: "Sleep & recovery" },
                { icon: "target" as ArcIconName, text: "Smart daily goals" },
              ].map(f => (
                <View key={f.text} style={{ backgroundColor: "white", borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <ArcIcon name={f.icon} size={18} color={DARK} />
                  <Text style={{ fontSize: 15, fontWeight: "600", color: DARK }}>{f.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Step 1: Name */}
        {step === 1 && (
          <View>
            <Text style={styles.heading}>What's your name?</Text>
            <Text style={styles.subtitle}>Let's personalize your experience</Text>
            <TextInput
              placeholder="Your first name"
              placeholderTextColor="#C7C7CC"
              value={name}
              onChangeText={setName}
              autoFocus
              autoCapitalize="words"
              style={styles.nameInput}
            />
          </View>
        )}

        {/* Step 2: Goal */}
        {step === 2 && (
          <View>
            <Text style={styles.heading}>What's your goal?</Text>
            <Text style={styles.subtitle}>We'll calculate your calorie target</Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {GOALS.map(g => (
                <Pressable key={g.key} onPress={() => setGoal(g.key)} style={[styles.optionCard, goal === g.key && styles.optionActive]}>
                  <ArcIcon name={g.icon} size={28} color={DARK} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, goal === g.key && { color: "white" }]}>{g.label}</Text>
                    <Text style={[styles.optionDesc, goal === g.key && { color: "rgba(255,255,255,0.7)" }]}>{g.desc}</Text>
                  </View>
                  {goal === g.key && <Text style={{ color: "white", fontSize: 18 }}>✓</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 3: Sex + Age */}
        {step === 3 && (
          <View>
            <Text style={styles.heading}>About you</Text>
            <Text style={styles.subtitle}>Used to accurately calculate your daily targets</Text>
            <Text style={styles.sectionLabel}>Biological Sex</Text>
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              {(["male", "female"] as const).map(s => (
                <Pressable key={s} onPress={() => setSex(s)} style={[styles.sexBtn, sex === s && { backgroundColor: DARK, borderColor: DARK }]}>
                  <Text style={[{ fontSize: 15, fontWeight: "700", color: DARK }, sex === s && { color: "white" }]}>{s === "male" ? "Male" : "Female"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.whiteRow}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Age</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput placeholder="25" placeholderTextColor="#C7C7CC" value={age} onChangeText={setAge} keyboardType="number-pad" style={{ fontSize: 18, fontWeight: "700", color: DARK, width: 60, textAlign: "right" }} />
                <Text style={{ fontSize: 13, color: SUBTITLE }}>years</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 4: Height */}
        {step === 4 && (
          <View>
            <Text style={styles.heading}>How tall are you?</Text>
            <Text style={styles.subtitle}>Used to calculate your calorie targets</Text>
            <View style={{ backgroundColor: "white", borderRadius: 20, padding: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 }}>
              <View style={{ alignItems: "center", gap: 8 }}>
                <TextInput placeholder="5" placeholderTextColor="#C7C7CC" value={heightFt} onChangeText={setHeightFt} keyboardType="number-pad" style={styles.bigInput} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUBTITLE }}>feet</Text>
              </View>
              <Text style={{ fontSize: 32, fontWeight: "900", color: "#C7C7CC", marginBottom: 24 }}>′</Text>
              <View style={{ alignItems: "center", gap: 8 }}>
                <TextInput placeholder="9" placeholderTextColor="#C7C7CC" value={heightIn} onChangeText={setHeightIn} keyboardType="number-pad" style={styles.bigInput} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: SUBTITLE }}>inches</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 5: Weight */}
        {step === 5 && (
          <View>
            <Text style={styles.heading}>Current weight?</Text>
            <Text style={styles.subtitle}>We'll use this to set your protein targets</Text>
            <View style={{ backgroundColor: "white", borderRadius: 16, padding: 6, flexDirection: "row", marginBottom: 16 }}>
              {(["lbs", "kg"] as const).map(u => (
                <Pressable key={u} onPress={() => setWeightUnit(u)} style={[styles.unitBtn, weightUnit === u && { backgroundColor: DARK }]}>
                  <Text style={[{ fontSize: 14, fontWeight: "700", color: SUBTITLE }, weightUnit === u && { color: "white" }]}>{u === "lbs" ? "Pounds (lbs)" : "Kilograms (kg)"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.whiteRow}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Weight</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput placeholder={weightUnit === "lbs" ? "154" : "70"} placeholderTextColor="#C7C7CC" value={weightVal} onChangeText={setWeightVal} keyboardType="decimal-pad" style={{ fontSize: 22, fontWeight: "700", color: DARK, width: 70, textAlign: "right" }} />
                <Text style={{ fontSize: 13, color: SUBTITLE }}>{weightUnit}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 6: Activity */}
        {step === 6 && (
          <View>
            <Text style={styles.heading}>Activity level?</Text>
            <Text style={styles.subtitle}>How active are you on a typical week?</Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {ACTIVITY_LEVELS.map(a => (
                <Pressable key={a.key} onPress={() => setActivity(a.key)} style={[styles.optionCard, activity === a.key && styles.optionActive]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, activity === a.key && { color: "white" }]}>{a.label}</Text>
                    <Text style={[styles.optionDesc, activity === a.key && { color: "rgba(255,255,255,0.7)" }]}>{a.desc}</Text>
                  </View>
                  {activity === a.key && <Text style={{ color: "white", fontSize: 18 }}>✓</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 7: Dietary */}
        {step === 7 && (
          <View>
            <Text style={styles.heading}>Dietary preferences</Text>
            <Text style={styles.subtitle}>We'll personalize your meal suggestions</Text>
            <Text style={styles.sectionLabel}>Diet Type</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {DIET_TYPES.map(t => {
                const isActive = t === "None" ? dietaryType.length === 0 : dietaryType.includes(t);
                return (
                  <Pressable key={t} onPress={() => toggleDietaryType(t)} style={[styles.pill, isActive && styles.pillActive]}>
                    <Text style={[styles.pillText, isActive && { color: "white" }]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sectionLabel}>Protein Preferences</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PROTEIN_OPTS.map(p => (
                <Pressable key={p} onPress={() => setDietaryProtein(prev => prev.includes(p) ? prev.filter(v => v !== p) : [...prev, p])} style={[styles.pill, dietaryProtein.includes(p) && styles.pillActive]}>
                  <Text style={[styles.pillText, dietaryProtein.includes(p) && { color: "white" }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Step 8: Plan preview */}
        {step === 8 && (
          <View>
            <Text style={styles.heading}>Your plan is ready</Text>
            <Text style={styles.subtitle}>Based on your info — you can adjust anytime in Settings</Text>

            <View style={{ backgroundColor: "white", borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 13, color: SUBTITLE, fontWeight: "600" }}>Daily Calories</Text>
                <Text style={{ fontSize: 36, fontWeight: "900", color: DARK, marginTop: 2 }}>{plan.calories.toLocaleString()}</Text>
                <Text style={{ fontSize: 12, color: SUBTITLE }}>kcal/day</Text>
              </View>
              <ArcIcon name={goal === "lose" ? "recap" : goal === "gain" ? "workout" : goal === "recomp" ? "refresh" : "scale"} size={52} color={DARK} />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
              {[
                { label: "Protein", value: `${plan.protein}g`, color: "#FF6B35" },
                { label: "Carbs", value: `${plan.carbs}g`, color: "#34C759" },
                { label: "Fat", value: `${plan.fat}g`, color: "#FF9F0A" },
              ].map(m => (
                <View key={m.label} style={{ flex: 1, backgroundColor: "white", borderRadius: 18, padding: 16, alignItems: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "900", color: m.color }}>{m.value}</Text>
                  <Text style={{ fontSize: 12, color: SUBTITLE, fontWeight: "600", marginTop: 2 }}>{m.label}</Text>
                </View>
              ))}
            </View>

            <View style={{ backgroundColor: "rgba(52,199,89,0.1)", borderRadius: 16, padding: 12 }}>
              <Text style={{ fontSize: 13, color: "#34C759", fontWeight: "600" }}>✓ Calculated using Mifflin-St Jeor formula</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* CTA */}
      <View style={{ padding: 24, paddingBottom: 16 }}>
        <Pressable onPress={handleNext} disabled={saving} style={[styles.ctaBtn, saving && { opacity: 0.7 }]}>
          <Text style={{ color: "white", fontWeight: "800", fontSize: 17 }}>
            {saving ? "Setting up..." : step === totalSteps ? "Let's Go" : "Continue"}
          </Text>
        </Pressable>
        {step > 0 && (
          <Pressable onPress={handleBack} style={{ padding: 14, alignItems: "center" }}>
            <Text style={{ color: SUBTITLE, fontWeight: "700", fontSize: 15 }}>Back</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 27, fontWeight: "900", color: DARK, marginBottom: 6, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: SUBTITLE, marginBottom: 26 },
  sectionLabel: { fontSize: 13, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  nameInput: { backgroundColor: "white", borderRadius: 20, padding: 20, fontSize: 20, fontWeight: "700", color: DARK, textAlign: "center" },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 18, borderRadius: 20, backgroundColor: "white", borderWidth: 2, borderColor: "transparent" },
  optionActive: { backgroundColor: DARK, borderColor: DARK },
  optionTitle: { fontSize: 16, fontWeight: "700", color: DARK },
  optionDesc: { fontSize: 13, color: SUBTITLE, marginTop: 2 },
  sexBtn: { flex: 1, padding: 20, borderRadius: 20, backgroundColor: "white", borderWidth: 2, borderColor: "transparent", alignItems: "center" },
  whiteRow: { backgroundColor: "white", borderRadius: 20, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bigInput: { backgroundColor: BG, borderRadius: 16, fontSize: 36, fontWeight: "900", color: DARK, width: 90, textAlign: "center", padding: 16 },
  unitBtn: { flex: 1, padding: 12, borderRadius: 12, alignItems: "center" },
  pill: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 99, backgroundColor: "white" },
  pillActive: { backgroundColor: DARK },
  pillText: { fontSize: 14, fontWeight: "600", color: DARK },
  ctaBtn: { backgroundColor: DARK, borderRadius: 20, padding: 18, alignItems: "center" },
});
