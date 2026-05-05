import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { ArcIcon } from "@/components/ArcIcon";

interface Exercise {
  name: string;
  muscles: string[];
  category: string;
  equipment: string;
}

const EXERCISES: Exercise[] = [
  // Chest
  { name: "Bench Press", muscles: ["Chest", "Triceps"], category: "Push", equipment: "Barbell" },
  { name: "Incline Bench Press", muscles: ["Upper Chest", "Triceps"], category: "Push", equipment: "Barbell" },
  { name: "Dumbbell Fly", muscles: ["Chest"], category: "Push", equipment: "Dumbbells" },
  { name: "Push-ups", muscles: ["Chest", "Triceps"], category: "Push", equipment: "Bodyweight" },
  { name: "Cable Crossover", muscles: ["Chest"], category: "Push", equipment: "Cable" },
  { name: "Chest Dip", muscles: ["Lower Chest", "Triceps"], category: "Push", equipment: "Bodyweight" },
  // Shoulders
  { name: "Overhead Press", muscles: ["Shoulders", "Triceps"], category: "Push", equipment: "Barbell" },
  { name: "Lateral Raise", muscles: ["Side Delts"], category: "Push", equipment: "Dumbbells" },
  { name: "Front Raise", muscles: ["Front Delts"], category: "Push", equipment: "Dumbbells" },
  { name: "Face Pull", muscles: ["Rear Delts", "Traps"], category: "Pull", equipment: "Cable" },
  { name: "Arnold Press", muscles: ["Shoulders"], category: "Push", equipment: "Dumbbells" },
  // Back
  { name: "Deadlift", muscles: ["Back", "Hamstrings", "Glutes"], category: "Pull", equipment: "Barbell" },
  { name: "Barbell Row", muscles: ["Back", "Biceps"], category: "Pull", equipment: "Barbell" },
  { name: "Pull-ups", muscles: ["Lats", "Biceps"], category: "Pull", equipment: "Bodyweight" },
  { name: "Lat Pulldown", muscles: ["Lats", "Biceps"], category: "Pull", equipment: "Cable" },
  { name: "Seated Row", muscles: ["Mid Back", "Biceps"], category: "Pull", equipment: "Cable" },
  { name: "T-Bar Row", muscles: ["Back", "Biceps"], category: "Pull", equipment: "Barbell" },
  // Arms
  { name: "Barbell Curl", muscles: ["Biceps"], category: "Pull", equipment: "Barbell" },
  { name: "Hammer Curl", muscles: ["Biceps", "Forearms"], category: "Pull", equipment: "Dumbbells" },
  { name: "Tricep Pushdown", muscles: ["Triceps"], category: "Push", equipment: "Cable" },
  { name: "Skull Crusher", muscles: ["Triceps"], category: "Push", equipment: "Barbell" },
  { name: "Preacher Curl", muscles: ["Biceps"], category: "Pull", equipment: "Barbell" },
  // Legs
  { name: "Squat", muscles: ["Quads", "Glutes"], category: "Legs", equipment: "Barbell" },
  { name: "Leg Press", muscles: ["Quads", "Glutes"], category: "Legs", equipment: "Machine" },
  { name: "Romanian Deadlift", muscles: ["Hamstrings", "Glutes"], category: "Legs", equipment: "Barbell" },
  { name: "Leg Extension", muscles: ["Quads"], category: "Legs", equipment: "Machine" },
  { name: "Leg Curl", muscles: ["Hamstrings"], category: "Legs", equipment: "Machine" },
  { name: "Calf Raise", muscles: ["Calves"], category: "Legs", equipment: "Machine" },
  { name: "Lunges", muscles: ["Quads", "Glutes"], category: "Legs", equipment: "Dumbbells" },
  { name: "Bulgarian Split Squat", muscles: ["Quads", "Glutes"], category: "Legs", equipment: "Dumbbells" },
  { name: "Hip Thrust", muscles: ["Glutes", "Hamstrings"], category: "Legs", equipment: "Barbell" },
  // Core
  { name: "Plank", muscles: ["Core"], category: "Core", equipment: "Bodyweight" },
  { name: "Hanging Leg Raise", muscles: ["Abs"], category: "Core", equipment: "Bodyweight" },
  { name: "Cable Crunch", muscles: ["Abs"], category: "Core", equipment: "Cable" },
  { name: "Russian Twist", muscles: ["Obliques"], category: "Core", equipment: "Bodyweight" },
  { name: "Ab Wheel Rollout", muscles: ["Core"], category: "Core", equipment: "Ab Wheel" },
  // Cardio
  { name: "Running", muscles: ["Full Body"], category: "Cardio", equipment: "None" },
  { name: "Cycling", muscles: ["Quads", "Cardio"], category: "Cardio", equipment: "Bike" },
  { name: "Rowing", muscles: ["Back", "Arms", "Cardio"], category: "Cardio", equipment: "Rower" },
  { name: "Jump Rope", muscles: ["Full Body"], category: "Cardio", equipment: "Rope" },
  { name: "Stair Climber", muscles: ["Quads", "Glutes"], category: "Cardio", equipment: "Machine" },
];

const CATEGORIES = ["All", "Push", "Pull", "Legs", "Core", "Cardio"];

const MUSCLE_COLORS: Record<string, string> = {
  Chest: "#FF4444", Triceps: "#FF6B9D", Shoulders: "#FFB800", "Side Delts": "#FFB800",
  "Front Delts": "#FFB800", "Rear Delts": "#FFB800", Back: "#7C4DFF", Lats: "#7C4DFF",
  "Mid Back": "#7C4DFF", Biceps: "#2196F3", Forearms: "#2196F3", Quads: "#00C853",
  Glutes: "#00C853", Hamstrings: "#00C853", Calves: "#00C853", Core: "#FF6D00",
  Abs: "#FF6D00", Obliques: "#FF6D00", "Full Body": "#9E9E9E",
};

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  const filtered = EXERCISES.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.muscles.some(m => m.toLowerCase().includes(search.toLowerCase()));
    const matchCat = category === "All" || e.category === category;
    return matchSearch && matchCat;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 12 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Exercises</Text>
      </View>

      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises or muscles..."
          placeholderTextColor={colors.text3}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 16, marginBottom: 12, maxHeight: 40 }}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {CATEGORIES.map(c => (
            <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipActive]}>
              <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 12, color: colors.text3, marginBottom: 12 }}>{filtered.length} exercises</Text>

        {filtered.map((ex, i) => (
          <View key={i} style={styles.card}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{ex.name}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
              {ex.muscles.map(m => (
                <View key={m} style={[styles.muscleBadge, { backgroundColor: (MUSCLE_COLORS[m] || colors.text) + "20" }]}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: MUSCLE_COLORS[m] || colors.text }}>{m}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: colors.text3, marginTop: 4 }}>
              {ex.equipment} · {ex.category}
            </Text>
          </View>
        ))}

        {filtered.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <View style={{ marginBottom: 8 }}><ArcIcon name="search" size={40} color={colors.text3} /></View>
            <Text style={{ fontSize: 14, color: colors.text2 }}>No exercises found</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  searchInput: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.text },
  chipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  chipTextActive: { color: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 8 },
  muscleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
});
