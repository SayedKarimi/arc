import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SUBTITLE = "#8E8E93";
const SURFACE = "#FFFFFF";

const RANGES = [
  { label: "Underweight", min: 10, max: 18.5, color: "#30B0C7" },
  { label: "Normal", min: 18.5, max: 25, color: "#34C759" },
  { label: "Overweight", min: 25, max: 30, color: "#FF9F0A" },
  { label: "Obese", min: 30, max: 40, color: "#FF3B30" },
];

function getBMICategory(bmi: number) {
  if (bmi < 18.5) return { label: "Underweight", color: "#30B0C7", desc: "BMI below 18.5 may indicate insufficient nutrition or underlying health conditions. Consider consulting a healthcare provider." };
  if (bmi < 25) return { label: "Normal Weight", color: "#34C759", desc: "A BMI between 18.5–24.9 is associated with the lowest health risks. Keep up your healthy habits!" };
  if (bmi < 30) return { label: "Overweight", color: "#FF9F0A", desc: "BMI between 25–29.9 may increase risk of certain conditions. Small lifestyle changes can make a big difference." };
  return { label: "Obese", color: "#FF3B30", desc: "BMI of 30 or above is linked to increased health risks. Speaking with a healthcare provider is recommended." };
}

export default function BMIDetailScreen() {
  const router = useRouter();
  const [bmi, setBMI] = useState<number | null>(null);
  const [weight, setWeight] = useState(0);
  const [height, setHeight] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [settingsRes, weightRes] = await Promise.all([
      supabase.from("user_settings").select("height").eq("user_id", user.id).single(),
      supabase.from("body_weight_entries").select("weight,unit").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(1),
    ]);

    const h = settingsRes.data?.height || 0;
    const latest = weightRes.data?.[0];
    const w = latest?.unit === "kg" ? latest.weight * 2.20462 : latest?.weight || 0;
    const wKg = w * 0.453592;
    const hM = h / 100;

    setWeight(Math.round(w * 10) / 10);
    setHeight(h);
    if (h > 0 && w > 0) setBMI(Math.round((wKg / (hM * hM)) * 10) / 10);
    setLoading(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={DARK} />
      </SafeAreaView>
    );
  }

  const category = bmi ? getBMICategory(bmi) : null;
  const gaugePos = bmi ? Math.min(Math.max((bmi - 10) / 30 * 100, 2), 98) : 50;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ backgroundColor: SURFACE, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 18 }}>←</Text>
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>BMI Detail</Text>
        </View>

        <View style={{ padding: 16, gap: 14 }}>
          {/* BMI Score Card */}
          <View style={[styles.card, { alignItems: "center" }]}>
            {bmi && category ? (
              <>
                <Text style={styles.sectionLabel}>Your BMI</Text>
                <Text style={{ fontSize: 72, fontWeight: "900", color: category.color, letterSpacing: -2 }}>{bmi}</Text>
                <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 99, backgroundColor: category.color + "22", marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: category.color }}>{category.label}</Text>
                </View>
                <Text style={{ fontSize: 13, color: SUBTITLE, lineHeight: 20, textAlign: "center" }}>{category.desc}</Text>
              </>
            ) : (
              <>
                <View style={{ marginBottom: 12 }}><ArcIcon name="target" size={48} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: DARK, marginBottom: 6 }}>BMI Unavailable</Text>
                <Text style={{ fontSize: 13, color: SUBTITLE, marginBottom: 16, textAlign: "center" }}>Add your height and weight in Personal Details</Text>
                <Pressable onPress={() => router.push("/personal-details" as any)}
                  style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, backgroundColor: "#007AFF" }}>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Update Profile</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Gauge */}
          {bmi && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>BMI Scale</Text>
              {/* Color bar */}
              <View style={{ height: 20, borderRadius: 99, overflow: "hidden", flexDirection: "row", marginBottom: 8, position: "relative" }}>
                {RANGES.map(r => (
                  <View key={r.label} style={{ flex: r.max - r.min, backgroundColor: r.color }} />
                ))}
                {/* Indicator */}
                <View style={{ position: "absolute", left: `${gaugePos}%`, top: -4, bottom: -4, width: 4, backgroundColor: "white", borderRadius: 99, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, transform: [{ translateX: -2 }] }} />
              </View>

              {/* Labels */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                {RANGES.map(r => (
                  <View key={r.label} style={{ flex: r.max - r.min, alignItems: "center" }}>
                    <Text style={{ fontSize: 9, fontWeight: "700", color: r.color }}>{r.label}</Text>
                    <Text style={{ fontSize: 8, color: "#C7C7CC" }}>{r.min}–{r.max}</Text>
                  </View>
                ))}
              </View>

              {/* Stats row */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: BG, borderRadius: 14, padding: 12 }}>
                  <Text style={{ fontSize: 11, color: SUBTITLE }}>Height</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: DARK }}>{height || "—"} <Text style={{ fontSize: 12, color: SUBTITLE }}>cm</Text></Text>
                </View>
                <View style={{ flex: 1, backgroundColor: BG, borderRadius: 14, padding: 12 }}>
                  <Text style={{ fontSize: 11, color: SUBTITLE }}>Weight</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: DARK }}>{weight || "—"} <Text style={{ fontSize: 12, color: SUBTITLE }}>lbs</Text></Text>
                </View>
              </View>
            </View>
          )}

          {/* About BMI */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>About BMI</Text>
            <Text style={{ fontSize: 13, color: "#3C3C43", lineHeight: 20, marginBottom: 12 }}>
              Body Mass Index (BMI) is a measure of body fat based on height and weight. It's a screening tool, not a diagnostic measure.
            </Text>
            <Text style={{ fontSize: 13, color: "#3C3C43", lineHeight: 20 }}>
              BMI does not account for muscle mass, bone density, age, or sex. Athletes may have a high BMI without excess body fat.
            </Text>
          </View>

          <Pressable onPress={() => router.push("/personal-details" as any)}
            style={{ padding: 15, borderRadius: 18, backgroundColor: SURFACE, alignItems: "center" }}>
            <Text style={{ color: "#007AFF", fontWeight: "700", fontSize: 15 }}>Update Height & Weight →</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: BG, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: SURFACE, borderRadius: 24, padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "800", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 16 },
});
