import { useEffect, useState, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, Image, StyleSheet, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

const { width } = Dimensions.get("window");
const PHOTO_SIZE = (width - 48) / 2;

interface Photo {
  id: string;
  date: string;
  url: string;
  note: string;
  category: string;
}

export default function ComparePhotosScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [before, setBefore] = useState<Photo | null>(null);
  const [after, setAfter] = useState<Photo | null>(null);
  const [selecting, setSelecting] = useState<"before" | "after" | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("progress_photos")
        .select("*")
        .eq("user_id", user.id)
        .eq("category", "body")
        .order("date", { ascending: false })
        .limit(50);
      const p = (data || []).filter((e: any) => e.url);
      setPhotos(p);
      if (p.length >= 2) {
        setBefore(p[p.length - 1]);
        setAfter(p[0]);
      }
    };
    load();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Before & After</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {/* Comparison */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <Pressable style={[styles.photoSlot, { flex: 1 }]} onPress={() => setSelecting("before")}>
            {before?.url ? (
              <View>
                <Image source={{ uri: before.url }} style={styles.compareImage} />
                <View style={styles.dateOverlay}>
                  <Text style={styles.dateOverlayText}>{before.date}</Text>
                </View>
                <Text style={styles.slotLabel}>BEFORE</Text>
              </View>
            ) : (
              <View style={[styles.compareImage, { backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }]}>
                <ArcIcon name="camera" size={32} color="#C7C7CC" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text2, marginTop: 4 }}>Select Before</Text>
              </View>
            )}
          </Pressable>

          <Pressable style={[styles.photoSlot, { flex: 1 }]} onPress={() => setSelecting("after")}>
            {after?.url ? (
              <View>
                <Image source={{ uri: after.url }} style={styles.compareImage} />
                <View style={styles.dateOverlay}>
                  <Text style={styles.dateOverlayText}>{after.date}</Text>
                </View>
                <Text style={styles.slotLabel}>AFTER</Text>
              </View>
            ) : (
              <View style={[styles.compareImage, { backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" }]}>
                <ArcIcon name="camera" size={32} color="#C7C7CC" />
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text2, marginTop: 4 }}>Select After</Text>
              </View>
            )}
          </Pressable>
        </View>

        {before && after && (
          <View style={[styles.card, { alignItems: "center" }]}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {Math.round((new Date(after.date).getTime() - new Date(before.date).getTime()) / 86400000)} days apart
            </Text>
            <Text style={{ fontSize: 12, color: colors.text2, marginTop: 4 }}>
              {before.date} → {after.date}
            </Text>
          </View>
        )}

        {/* Photo picker */}
        {selecting && (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={styles.sectionLabel}>Select {selecting === "before" ? "Before" : "After"} Photo</Text>
              <Pressable onPress={() => setSelecting(null)}>
                <Text style={{ fontSize: 13, color: colors.text2, fontWeight: "600" }}>Done</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {photos.map(photo => (
                <Pressable
                  key={photo.id}
                  onPress={() => {
                    if (selecting === "before") setBefore(photo);
                    else setAfter(photo);
                    setSelecting(null);
                  }}
                  style={[
                    styles.thumbWrap,
                    (selecting === "before" && before?.id === photo.id) || (selecting === "after" && after?.id === photo.id)
                      ? { borderColor: colors.text, borderWidth: 2 }
                      : {},
                  ]}
                >
                  <Image source={{ uri: photo.url }} style={styles.thumb} />
                  <Text style={{ fontSize: 9, color: colors.text3, textAlign: "center", marginTop: 2 }}>{photo.date}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!selecting && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 8 }]}>Tap a photo above to change it</Text>

            {photos.length === 0 && (
              <View style={{ alignItems: "center", paddingTop: 20 }}>
                <View style={{ marginBottom: 8 }}><ArcIcon name="camera" size={40} color="#C7C7CC" /></View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>No body photos yet</Text>
                <Text style={{ fontSize: 12, color: colors.text2, marginTop: 4 }}>Add photos in the Journal with "Body" category</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 28, fontWeight: "900", color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: 12 },
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  photoSlot: { backgroundColor: colors.surface, borderRadius: radius.xl, overflow: "hidden" },
  compareImage: { width: "100%", height: PHOTO_SIZE * 1.3, borderRadius: radius.xl },
  dateOverlay: { position: "absolute", bottom: 8, left: 8, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  dateOverlayText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  slotLabel: { textAlign: "center", fontSize: 11, fontWeight: "800", color: colors.text2, paddingVertical: 8, letterSpacing: 1 },
  thumbWrap: { width: 70, borderRadius: 8, overflow: "hidden" },
  thumb: { width: 70, height: 70, borderRadius: 8 },
});
