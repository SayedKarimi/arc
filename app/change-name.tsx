import { useState, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getSettings, updateSettings } from "@/lib/supabase/queries";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";

export default function ChangeNameScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getSettings().then(s => setName(s.name || "")).catch(() => {});
  }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const s = await getSettings();
      await updateSettings({ ...s, name: name.trim() });
      setDone(true);
      setTimeout(() => router.back(), 800);
    } finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Change Name</Text>
      </View>

      <View style={{ padding: 24 }}>
        <View style={styles.card}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoFocus
            onSubmitEditing={save}
            style={styles.input}
          />
        </View>
        <Pressable
          onPress={save}
          disabled={saving || !name.trim()}
          style={[styles.saveBtn, {
            backgroundColor: done ? "#34C759" : name.trim() ? "#007AFF" : "#C7C7CC",
            opacity: saving ? 0.6 : 1,
          }]}
        >
          <Text style={styles.saveBtnText}>
            {done ? "Saved!" : saving ? "Saving..." : "Save Name"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "white", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F2F2F7", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900", color: "#1C1C1E" },
  card: { backgroundColor: "white", borderRadius: 20, padding: 20, marginBottom: 16 },
  label: { fontSize: 11, fontWeight: "800", color: "#8E8E93", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 12 },
  input: { backgroundColor: "#F2F2F7", borderRadius: 14, padding: 16, fontSize: 20, fontWeight: "700", color: "#1C1C1E" },
  saveBtn: { borderRadius: 18, padding: 16, alignItems: "center" },
  saveBtnText: { color: "white", fontWeight: "800", fontSize: 16 },
});
