import { useState, useRef, useCallback } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, Alert,
  TextInput, ScrollView, Animated, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";
import { apiUrl } from "@/lib/api";

const DARK = "#1C1C1E";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";
const { width: SCREEN_W } = Dimensions.get("window");

type ScanMode = "photo" | "barcode" | "label" | "library";
type MealCategory = "breakfast" | "lunch" | "dinner" | "snack";
type MeasureUnit = "serving" | "100g";

interface FoodResult {
  name: string; brand: string; serving: string; servingGrams: number;
  calories: number; protein: number; carbs: number; fat: number; fiber: number;
  per100g?: { calories: number; protein: number; carbs: number; fat: number; };
}

const MODES: { key: ScanMode; label: string }[] = [
  { key: "photo", label: "Scan Food" },
  { key: "barcode", label: "Barcode" },
  { key: "label", label: "Food Label" },
  { key: "library", label: "Library" },
];

const MEALS: { key: MealCategory; label: string; icon: ArcIconName }[] = [
  { key: "breakfast", label: "Breakfast", icon: "sun" },
  { key: "lunch", label: "Lunch", icon: "flame" },
  { key: "dinner", label: "Dinner", icon: "moon" },
  { key: "snack", label: "Snack", icon: "food" },
];

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>("photo");
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [meal, setMeal] = useState<MealCategory>("snack");
  const [servings, setServings] = useState("1");
  const [measureUnit, setMeasureUnit] = useState<MeasureUnit>("serving");
  const [saving, setSaving] = useState(false);
  const [barcodeScanned, setBarcodeScanned] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const cameraRef = useRef<any>(null);

  const handleBarcode = useCallback(async (scanResult: { data: string }) => {
    if (barcodeScanned || capturing) return;
    setBarcodeScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await lookupBarcode(scanResult.data);
  }, [barcodeScanned, capturing]);

  const lookupBarcode = async (barcode: string) => {
    setLookingUp(true);
    try {
      const urls = [
        `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
        `https://world.openfoodfacts.org/api/v0/product/${barcode.replace(/^0+/, "")}.json`,
      ];
      let data: any = null;
      for (const url of urls) {
        const res = await fetch(url);
        const d = await res.json();
        if (d.status === 1 && d.product?.product_name) { data = d; break; }
      }
      if (!data) {
        Alert.alert("Not Found", "Product not found. Try entering the barcode manually.");
        setLookingUp(false);
        setBarcodeScanned(false);
        return;
      }
      const p = data.product;
      const n = p.nutriments || {};
      setResult({
        name: p.product_name || "Unknown",
        brand: p.brands || "",
        serving: p.serving_size || "100g",
        servingGrams: parseFloat(p.serving_quantity) || 100,
        calories: Math.round(n["energy-kcal_serving"] || n["energy-kcal_100g"] || 0),
        protein: Math.round((n["proteins_serving"] || n["proteins_100g"] || 0) * 10) / 10,
        carbs: Math.round((n["carbohydrates_serving"] || n["carbohydrates_100g"] || 0) * 10) / 10,
        fat: Math.round((n["fat_serving"] || n["fat_100g"] || 0) * 10) / 10,
        fiber: Math.round((n["fiber_serving"] || n["fiber_100g"] || 0) * 10) / 10,
        per100g: {
          calories: Math.round(n["energy-kcal_100g"] || 0),
          protein: Math.round((n["proteins_100g"] || 0) * 10) / 10,
          carbs: Math.round((n["carbohydrates_100g"] || 0) * 10) / 10,
          fat: Math.round((n["fat_100g"] || 0) * 10) / 10,
        },
      });
    } catch {
      Alert.alert("Error", "Lookup failed. Try again.");
      setBarcodeScanned(false);
    }
    setLookingUp(false);
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || capturing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCapturing(true);
    setAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
      await analyzeImage(photo.base64);
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setAnalyzing(false);
    }
    setCapturing(false);
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setAnalyzing(true);
      await analyzeImage(result.assets[0].base64);
    }
  };

  const analyzeImage = async (base64: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { Alert.alert("Error", "Not signed in"); setAnalyzing(false); return; }
      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          message: mode === "label"
            ? "Analyze this food label photo. Extract the nutrition facts per serving. Return a nutrition_log action."
            : "Analyze this food photo. Identify the food items and estimate calories and macros per serving. Return a nutrition_log action.",
          imageBase64: base64,
          imageMimeType: "image/jpeg",
          history: [],
        }),
      });
      const data = await res.json();
      const actions = data.actions || [];
      const logAction = actions.find((a: any) => a.type === "nutrition_log");
      if (logAction?.data?.entries?.[0]) {
        const e = logAction.data.entries[0];
        setResult({
          name: e.food || "Food",
          brand: "",
          serving: "1 serving",
          servingGrams: 100,
          calories: e.calories || 0,
          protein: e.protein || 0,
          carbs: e.carbs || 0,
          fat: e.fat || 0,
          fiber: e.fiber || 0,
        });
      } else {
        Alert.alert("Couldn't Identify", "Try again with a clearer photo.");
      }
    } catch {
      Alert.alert("Error", "Analysis failed. Try again.");
    }
    setAnalyzing(false);
  };

  const saveResult = async () => {
    if (!result) return;
    setSaving(true);
    const qty = parseFloat(servings) || 1;
    const base = measureUnit === "100g" && result.per100g ? result.per100g : result;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = format(new Date(), "yyyy-MM-dd");
      await supabase.from("nutrition_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: user.id,
        date: today,
        timestamp: Date.now(),
        food: result.name,
        amount: (qty > 1 ? `${qty}x ` : "") + (measureUnit === "100g" ? "100g" : result.serving),
        meal,
        calories: Math.round(base.calories * qty),
        protein: Math.round(base.protein * qty * 10) / 10,
        carbs: Math.round(base.carbs * qty * 10) / 10,
        fat: Math.round(base.fat * qty * 10) / 10,
        fiber: Math.round(result.fiber * qty * 10) / 10,
        source: "scan",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
    setSaving(false);
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <View style={{ marginBottom: 16 }}><ArcIcon name="camera" size={48} color="white" /></View>
        <Text style={{ fontSize: 17, fontWeight: "700", color: "white", textAlign: "center" }}>Camera access needed</Text>
        <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 4, marginBottom: 20 }}>Arc needs camera access to scan and analyze your food.</Text>
        <Pressable onPress={requestPermission} style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 99, backgroundColor: "white" }}>
          <Text style={{ color: DARK, fontWeight: "800", fontSize: 15 }}>Grant Access</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const qty = parseFloat(servings) || 1;
  const base = measureUnit === "100g" && result?.per100g ? result.per100g : result;

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {/* Camera - only show when not in library mode and no result */}
      {mode !== "library" && !result && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={mode === "barcode" ? { barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"] } : undefined}
          onBarcodeScanned={mode === "barcode" && !barcodeScanned ? handleBarcode : undefined}
        />
      )}

      <SafeAreaView style={StyleSheet.absoluteFill} edges={["top"]}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.topBtn}>
            <Text style={{ fontSize: 18, color: "white" }}>←</Text>
          </Pressable>
          <Text style={{ color: "white", fontSize: 15, fontWeight: "700" }}>
            {mode === "barcode" ? "Scan Barcode" : mode === "photo" ? "Scan Food" : mode === "label" ? "Food Label" : "Library"}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Analyzing overlay */}
        {analyzing && (
          <View style={styles.overlay}>
            <View style={{ marginBottom: 16 }}><ArcIcon name="sparkle" size={52} color="white" /></View>
            <Text style={{ fontSize: 18, fontWeight: "800", color: "white", marginBottom: 8 }}>Analyzing food...</Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>AI is estimating macros from your photo</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[0, 1, 2].map(i => (
                <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "white", opacity: 0.6 }} />
              ))}
            </View>
          </View>
        )}

        {/* Looking up overlay */}
        {lookingUp && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="white" style={{ marginBottom: 16 }} />
            <Text style={{ fontSize: 15, fontWeight: "700", color: "white" }}>Looking up barcode...</Text>
          </View>
        )}

        {/* Library mode empty state */}
        {mode === "library" && !result && !analyzing && (
          <View style={[styles.overlay, { backgroundColor: "#000" }]}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <ArcIcon name="camera" size={32} color="white" />
            </View>
            <Pressable onPress={pickFromLibrary} style={{ paddingHorizontal: 28, paddingVertical: 14, borderRadius: 99, backgroundColor: "white", marginBottom: 8 }}>
              <Text style={{ color: DARK, fontWeight: "800", fontSize: 15 }}>Choose from Library</Text>
            </Pressable>
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>Select a food photo to analyze</Text>
          </View>
        )}

        {/* Barcode viewfinder + manual input */}
        {mode === "barcode" && !result && !lookingUp && !barcodeScanned && (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {/* Viewfinder frame */}
            <View style={{ width: SCREEN_W * 0.74, height: 165, position: "relative" }}>
              <View style={[styles.corner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[styles.corner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
              <View style={[styles.corner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
              <View style={[styles.corner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
            </View>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", marginTop: 20 }}>Align barcode within frame</Text>
            {/* Manual entry */}
            <View style={{ position: "absolute", bottom: 80, left: 24, right: 24, flexDirection: "row", gap: 8 }}>
              <TextInput
                placeholder="Or enter barcode manually..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={barcodeManual}
                onChangeText={setBarcodeManual}
                onSubmitEditing={() => barcodeManual.trim() && lookupBarcode(barcodeManual.trim())}
                style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 12, padding: 12, paddingHorizontal: 14, color: "white", fontSize: 14 }}
                keyboardType="number-pad"
              />
              <Pressable onPress={() => barcodeManual.trim() && lookupBarcode(barcodeManual.trim())} style={{ paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: "white" }}>
                <Text style={{ color: DARK, fontWeight: "700", fontSize: 13 }}>Go</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Photo/Label shutter */}
        {(mode === "photo" || mode === "label") && !result && !analyzing && (
          <View style={{ position: "absolute", bottom: 100, left: 0, right: 0, alignItems: "center" }}>
            {/* Corner viewfinder */}
            <Pressable onPress={capturePhoto} disabled={capturing} style={styles.shutterOuter}>
              {capturing ? (
                <ActivityIndicator color="white" size="large" />
              ) : (
                <View style={styles.shutterInner} />
              )}
            </Pressable>
            <Text style={{ color: "white", fontSize: 13, fontWeight: "600", marginTop: 12 }}>
              {mode === "label" ? "Point at food label and tap" : "Point at your food and tap"}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Mode tabs at bottom */}
      {!result && !analyzing && (
        <View style={styles.modeTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {MODES.map(({ key, label }) => (
              <Pressable key={key} onPress={() => { setMode(key); setResult(null); setBarcodeScanned(false); }} style={[styles.modeBtn, mode === key && styles.modeBtnActive]}>
                <Text style={[styles.modeBtnText, mode === key && { color: DARK }]}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Result bottom sheet */}
      {result && (
        <View style={styles.resultSheet}>
          {/* Drag handle */}
          <View style={{ alignItems: "center", paddingTop: 10 }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: "#E5E5EA" }} />
          </View>
          <ScrollView style={{ paddingHorizontal: 20, paddingTop: 12 }} showsVerticalScrollIndicator={false}>
            {/* Name */}
            <Text style={{ fontSize: 18, fontWeight: "900", color: DARK }}>{result.name}</Text>
            {result.brand ? <Text style={{ fontSize: 12, color: SUBTITLE, marginTop: 2 }}>{result.brand}</Text> : null}

            {/* Measurement toggle + servings */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10, marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
                {(["serving", "100g"] as MeasureUnit[]).map(u => (
                  <Pressable key={u} onPress={() => setMeasureUnit(u)} style={[styles.measurePill, measureUnit === u && { backgroundColor: DARK }]}>
                    <Text style={[{ fontSize: 12, fontWeight: "700", color: SUBTITLE }, measureUnit === u && { color: "white" }]}>
                      {u === "serving" ? "Serving" : "100g"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BG, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ fontSize: 12, color: SUBTITLE, fontWeight: "600" }}>×</Text>
                <TextInput
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="decimal-pad"
                  style={{ width: 40, fontSize: 15, fontWeight: "700", color: DARK, textAlign: "center" }}
                />
              </View>
            </View>

            {/* Macro cards */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
              {[
                { label: "Cal", val: Math.round((base?.calories || 0) * qty), color: "#FF9F43" },
                { label: "Protein", val: Math.round((base?.protein || 0) * qty * 10) / 10, color: "#FF6B6B" },
                { label: "Carbs", val: Math.round((base?.carbs || 0) * qty * 10) / 10, color: "#FF9F43" },
                { label: "Fat", val: Math.round((base?.fat || 0) * qty * 10) / 10, color: "#4FACFE" },
              ].map(({ label, val, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: BG, borderRadius: 14, padding: 10, alignItems: "center" }}>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: DARK }}>{val}</Text>
                  <Text style={{ fontSize: 9, color, fontWeight: "700", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</Text>
                </View>
              ))}
            </View>

            {/* Meal selector */}
            <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
              {MEALS.map(m => (
                <Pressable key={m.key} onPress={() => setMeal(m.key)} style={[styles.mealPill, meal === m.key && { backgroundColor: DARK }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><ArcIcon name={m.icon} size={12} color={meal === m.key ? "white" : SUBTITLE} /><Text style={[{ fontSize: 12, fontWeight: "700", color: SUBTITLE }, meal === m.key && { color: "white" }]}>{m.label}</Text></View>
                </Pressable>
              ))}
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 40 }}>
              <Pressable onPress={() => { setResult(null); setBarcodeScanned(false); }} style={styles.retakeBtn}>
                <Text style={{ color: SUBTITLE, fontWeight: "700", fontSize: 15 }}>Retake</Text>
              </Pressable>
              <Pressable onPress={saveResult} disabled={saving} style={[styles.logBtn, saving && { opacity: 0.7 }]}>
                <Text style={{ color: "white", fontWeight: "800", fontSize: 15 }}>{saving ? "Adding..." : "Add to Log ✓"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, backgroundColor: "transparent" },
  topBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center" },
  corner: { position: "absolute", width: 26, height: 26, borderColor: "white" },
  shutterOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: "white" },
  modeTabs: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(18,18,20,0.95)", paddingVertical: 12, paddingBottom: 40 },
  modeBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.12)" },
  modeBtnActive: { backgroundColor: "white" },
  modeBtnText: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.6)" },
  resultSheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "white", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "65%" },
  measurePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: BG },
  mealPill: { flex: 1, paddingVertical: 7, borderRadius: 99, backgroundColor: BG, alignItems: "center" },
  retakeBtn: { flex: 1, padding: 15, borderRadius: 16, backgroundColor: BG, alignItems: "center" },
  logBtn: { flex: 2, padding: 15, borderRadius: 16, backgroundColor: DARK, alignItems: "center" },
});
