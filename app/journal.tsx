import { useEffect, useState, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, Image, TextInput,
  StyleSheet, RefreshControl, Modal, Alert, Dimensions, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const DARK = "#1C1C1E";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";
const { width: SCREEN_W } = Dimensions.get("window");
const IMG_SIZE = (SCREEN_W - 32 - 10) / 2;

const CATEGORIES: { key: string; label: string; icon: ArcIconName }[] = [
  { key: "all", label: "All", icon: "plans" },
  { key: "body", label: "Body", icon: "workout" },
  { key: "food", label: "Food", icon: "plate" },
  { key: "workout", label: "Workout", icon: "workout" },
  { key: "other", label: "Other", icon: "camera" },
];

interface JournalEntry {
  id: string;
  date: string;
  url: string;
  note: string;
  category: string;
}

export default function JournalScreen() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState("body");
  const [newNote, setNewNote] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("progress_photos")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setEntries(data || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setShowAdd(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Camera permission needed"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setShowAdd(true);
    }
  };

  const handleUpload = async () => {
    if (!imageUri || uploading) return;
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const ext = imageUri.split(".").pop() || "jpg";
      const path = `${session.user.id}/${Date.now()}.${ext}`;
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const { error } = await supabase.storage.from("progress-photos").upload(path, blob);
      if (error) { Alert.alert("Upload error", error.message); setUploading(false); return; }
      const { data: { publicUrl } } = supabase.storage.from("progress-photos").getPublicUrl(path);
      await supabase.from("progress_photos").insert({
        id: Math.random().toString(36).slice(2),
        user_id: session.user.id,
        date: format(new Date(), "yyyy-MM-dd"),
        url: publicUrl,
        note: newNote,
        category: newCategory,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAdd(false);
      setImageUri(null);
      setNewNote("");
      loadEntries();
    } catch (e: any) { Alert.alert("Error", e.message); }
    setUploading(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete photo?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("progress_photos").delete().eq("id", id);
        setEntries(prev => prev.filter(e => e.id !== id));
      }},
    ]);
  };

  const filtered = filter === "all" ? entries : entries.filter(e => e.category === filter);

  // Group by date
  const grouped: Record<string, JournalEntry[]> = {};
  for (const e of filtered) {
    const d = e.date || "Unknown";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(e);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadEntries(); }} tintColor={DARK} />}
      >
        <Text style={{ fontSize: 32, fontWeight: "900", color: DARK, paddingTop: 12, marginBottom: 16 }}>Journal</Text>

        {/* Category filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {CATEGORIES.map(c => (
              <Pressable key={c.key} onPress={() => setFilter(c.key)} style={[styles.filterPill, filter === c.key && styles.filterPillActive]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ArcIcon name={c.icon} size={12} color={filter === c.key ? "white" : "#8E8E93"} /><Text style={[styles.filterPillText, filter === c.key && { color: "white" }]}>{c.label}</Text></View>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={DARK} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", padding: 48 }}>
            <View style={{ marginBottom: 12 }}><ArcIcon name="camera" size={48} color="#C7C7CC" /></View>
            <Text style={{ fontSize: 17, fontWeight: "700", color: DARK }}>No entries yet</Text>
            <Text style={{ fontSize: 13, color: SUBTITLE, marginTop: 4 }}>Tap + to add your first photo</Text>
          </View>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <View key={date} style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{date}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {items.map(entry => (
                  <Pressable key={entry.id} onLongPress={() => handleDelete(entry.id)} style={styles.photoCard}>
                    <Image source={{ uri: entry.url }} style={{ width: "100%", height: 140, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} />
                    <View style={{ padding: 8, paddingHorizontal: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: SUBTITLE, textTransform: "uppercase" }}>
                        {entry.category}
                      </Text>
                      {entry.note ? <Text style={{ fontSize: 12, color: DARK, marginTop: 4, lineHeight: 17 }}>{entry.note}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable onPress={() => {
        Alert.alert("Add Photo", "", [
          { text: "Camera", onPress: takePhoto },
          { text: "Photo Library", onPress: pickImage },
          { text: "Cancel", style: "cancel" },
        ]);
      }} style={styles.fab}>
        <Text style={{ color: "white", fontSize: 26, fontWeight: "700", marginTop: -2 }}>+</Text>
      </Pressable>

      {/* Upload sheet */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: "900", color: DARK }}>Add to Journal</Text>
              <Pressable onPress={() => { setShowAdd(false); setImageUri(null); }}>
                <Text style={{ fontSize: 16, color: SUBTITLE }}>Cancel</Text>
              </Pressable>
            </View>

            {imageUri && (
              <Image source={{ uri: imageUri }} style={{ width: "100%", height: 200, borderRadius: 16, marginBottom: 12 }} resizeMode="cover" />
            )}

            <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 8 }}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {CATEGORIES.slice(1).map(c => (
                <Pressable key={c.key} onPress={() => setNewCategory(c.key)} style={[styles.catBtn, newCategory === c.key && styles.catBtnActive]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ArcIcon name={c.icon} size={12} color={newCategory === c.key ? "white" : "#8E8E93"} /><Text style={[styles.catBtnText, newCategory === c.key && { color: "white" }]}>{c.label}</Text></View>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={newNote}
              onChangeText={setNewNote}
              placeholder="Add a note (optional)"
              placeholderTextColor="#C7C7CC"
              style={styles.input}
            />

            <Pressable onPress={handleUpload} disabled={uploading} style={[styles.saveBtn, uploading && { opacity: 0.7 }]}>
              <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>{uploading ? "Uploading..." : "Save to Journal"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filterPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: "white" },
  filterPillActive: { backgroundColor: DARK },
  filterPillText: { fontSize: 12, fontWeight: "700", color: SUBTITLE },
  photoCard: { width: IMG_SIZE, backgroundColor: "white", borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  fab: { position: "absolute", bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: DARK, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 16, zIndex: 30 },
  catBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: "white", borderWidth: 2, borderColor: "transparent" },
  catBtnActive: { backgroundColor: DARK, borderColor: DARK },
  catBtnText: { fontSize: 11, fontWeight: "700", color: DARK },
  input: { backgroundColor: "white", borderRadius: 12, padding: 12, fontSize: 14, color: DARK, borderWidth: 1.5, borderColor: "#E5E5EA", marginBottom: 12 },
  saveBtn: { backgroundColor: DARK, borderRadius: 16, padding: 16, alignItems: "center" },
});
