import { useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { format, subDays } from "date-fns";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const EXPORT_OPTIONS: { key: string; label: string; icon: ArcIconName; desc: string; table: string; fields: string[] }[] = [
  { key: "nutrition", label: "Nutrition Log", icon: "plate", desc: "Calories, macros, meals", table: "nutrition_entries", fields: ["date", "food", "calories", "protein", "carbs", "fat", "fiber", "meal", "serving"] },
  { key: "workouts", label: "Workouts", icon: "workout", desc: "Sessions, exercises, duration", table: "workout_sessions", fields: ["date", "type", "duration", "intensity"] },
  { key: "weight", label: "Weight", icon: "scale", desc: "Body weight history", table: "body_weight_entries", fields: ["date", "weight", "unit"] },
  { key: "measurements", label: "Measurements", icon: "target", desc: "Body measurements", table: "body_measurements", fields: ["date", "waist", "chest", "hips", "left_arm", "right_arm", "left_thigh", "right_thigh"] },
  { key: "mood", label: "Mood & Energy", icon: "heart", desc: "Daily check-ins", table: "mood_entries", fields: ["date", "mood", "energy", "note"] },
  { key: "sleep", label: "Sleep", icon: "sleep", desc: "Sleep duration and quality", table: "sleep_entries", fields: ["date", "duration", "quality"] },
  { key: "steps", label: "Steps", icon: "steps", desc: "Daily step counts", table: "step_entries", fields: ["date", "count"] },
  { key: "hydration", label: "Hydration", icon: "water", desc: "Water intake", table: "hydration_entries", fields: ["date", "amount"] },
];

export default function ExportDataScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [exporting, setExporting] = useState<string | null>(null);

  const exportData = async (option: typeof EXPORT_OPTIONS[0]) => {
    setExporting(option.key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const since = format(subDays(new Date(), 365), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from(option.table)
        .select("*")
        .eq("user_id", user.id)
        .gte("date", since)
        .order("date", { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) {
        Alert.alert("No data", `No ${option.label.toLowerCase()} data found in the last year.`);
        setExporting(null);
        return;
      }

      // Build CSV
      const headers = option.fields.join(",");
      const rows = data.map(row =>
        option.fields.map(f => {
          const val = row[f];
          if (val === null || val === undefined) return "";
          if (typeof val === "string" && (val.includes(",") || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return String(val);
        }).join(",")
      );
      const csv = [headers, ...rows].join("\n");

      const filename = `arc_${option.key}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      const filePath = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, csv);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(filePath, {
          mimeType: "text/csv",
          dialogTitle: `Export ${option.label}`,
        });
      } else {
        Alert.alert("Exported!", `Saved to ${filename} (${data.length} rows)`);
      }
    } catch (e: any) {
      Alert.alert("Export failed", e.message);
    }
    setExporting(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Export Data</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 13, color: colors.text2, marginBottom: 20, textAlign: "center" }}>
          Export your data as CSV files (last 12 months)
        </Text>

        {EXPORT_OPTIONS.map(option => (
          <Pressable
            key={option.key}
            style={[styles.card, exporting === option.key && { opacity: 0.6 }]}
            onPress={() => exportData(option)}
            disabled={exporting !== null}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <ArcIcon name={option.icon} size={28} color={colors.text} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{option.label}</Text>
                <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{option.desc}</Text>
              </View>
              {exporting === option.key ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={{ fontSize: 14, color: colors.text3 }}>↗</Text>
              )}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 10 },
});
