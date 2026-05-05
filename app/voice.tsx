import { useState, useEffect, useRef } from "react";
import {
  View, Text, Pressable, StyleSheet, Animated, ActivityIndicator, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { ArcIcon } from "@/components/ArcIcon";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const PURPLE = "#764ba2";

export default function VoiceScreen() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "listening") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  const startListening = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setState("listening");
    setTranscript("");
    setResponse("");
    setError("");

    // Use a simulated approach — prompt user to type since native speech recognition
    // requires a native module build. For Expo Go, we'll show a text input fallback.
    // In production with EAS build, @react-native-voice/voice would handle this.
    setTimeout(() => {
      // After "listening" animation, move to a text input
      setState("idle");
    }, 100);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setTranscript(text);
    setState("processing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          ...(session ? { accessToken: session.access_token } : {}),
        }),
      });
      const data = await res.json();
      const aiText = data.response ?? data.message ?? "I'm not sure how to help with that.";
      setResponse(aiText);
      setState("speaking");

      // Speak the response with a friendly voice
      Speech.speak(aiText, {
        language: "en-US",
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setState("idle"),
        onError: () => setState("idle"),
      });
    } catch {
      setError("Something went wrong. Try again.");
      setState("idle");
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setState("idle");
  };

  const [inputText, setInputText] = useState("");

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ fontSize: 20, color: "#8E8E93" }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Voice Assistant</Text>
        <View style={{ width: 20 }} />
      </View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
        {/* Mic button */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={state === "speaking" ? stopSpeaking : startListening}
            style={[styles.micBtn, state === "listening" && { backgroundColor: "#ef4444" }, state === "speaking" && { backgroundColor: "#22c55e" }]}
          >
            <ArcIcon
              name={state === "listening" ? "bolt" : state === "speaking" ? "activity" : state === "processing" ? "timer" : "mic"}
              size={44}
              color="white"
            />
          </Pressable>
        </Animated.View>

        <Text style={{ fontSize: 14, fontWeight: "600", color: "#8E8E93", marginTop: 20 }}>
          {state === "idle" ? "Tap to speak" : state === "listening" ? "Listening..." : state === "processing" ? "Thinking..." : "Speaking..."}
        </Text>

        {/* Transcript */}
        {transcript !== "" && (
          <View style={styles.bubble}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{transcript}</Text>
          </View>
        )}

        {/* Response */}
        {response !== "" && (
          <View style={[styles.bubble, { backgroundColor: "#EDE9FE" }]}>
            <Text style={{ fontSize: 14, color: "#4c1d95", lineHeight: 20 }}>{response}</Text>
          </View>
        )}

        {error !== "" && (
          <Text style={{ color: "#ef4444", fontSize: 13, marginTop: 12 }}>{error}</Text>
        )}

        {state === "processing" && <ActivityIndicator style={{ marginTop: 16 }} color={PURPLE} />}

        {/* Text input fallback for Expo Go (no native speech recognition) */}
        {state === "idle" && (
          <View style={{ width: "100%", marginTop: 30 }}>
            <Text style={{ fontSize: 11, color: "#8E8E93", textAlign: "center", marginBottom: 10 }}>Or type your message:</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1, backgroundColor: "white", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#E5E5EA" }}>
                <Text style={{ fontSize: 15, color: inputText ? DARK : "#C7C7CC" }} onPress={() => {}}>
                  {inputText || "Ask me anything..."}
                </Text>
              </View>
            </View>
            {/* Simple TextInput approach */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <View style={{ flex: 1, backgroundColor: "white", borderRadius: 16, borderWidth: 1.5, borderColor: DARK }}>
                {/* Using a require import to avoid issues */}
                <TextInputField value={inputText} onChange={setInputText} onSubmit={() => { sendMessage(inputText); setInputText(""); }} />
              </View>
              <Pressable onPress={() => { if (inputText.trim()) { sendMessage(inputText); setInputText(""); } }}
                style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: DARK, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "white", fontSize: 18 }}>↑</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {state === "speaking" && (
        <Pressable onPress={stopSpeaking} style={styles.stopBtn}>
          <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>Stop Speaking</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

// Simple text input component
function TextInputField({ value, onChange, onSubmit }: { value: string; onChange: (t: string) => void; onSubmit: () => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      onSubmitEditing={onSubmit}
      placeholder="Ask me anything..."
      placeholderTextColor="#C7C7CC"
      style={{ padding: 14, fontSize: 15, color: "#1C1C1E" }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  title: { fontSize: 17, fontWeight: "700", color: DARK },
  micBtn: { width: 120, height: 120, borderRadius: 60, backgroundColor: DARK, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  bubble: { backgroundColor: "white", borderRadius: 16, padding: 16, marginTop: 16, width: "100%", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  stopBtn: { backgroundColor: "#ef4444", borderRadius: 99, paddingHorizontal: 24, paddingVertical: 14, alignSelf: "center", marginBottom: 30 },
});
