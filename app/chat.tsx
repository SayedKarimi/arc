import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";
import { supabase } from "@/lib/supabase/client";
import { apiUrl } from "@/lib/api";
import { getAiMemory } from "@/lib/supabase/queries";

const BG = "#F2F2F7";
const DARK = "#1C1C1E";
const SURFACE = "#FFFFFF";
const BORDER = "#E5E5EA";
const SUBTITLE = "#8E8E93";
const TEXT3 = "#C7C7CC";
const GREEN = "#15803d";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  actions?: any[];
  actionsApplied?: boolean;
  timestamp: number;
}

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -4, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150 + 400),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={{ flexDirection: "row", gap: 4, padding: 12, paddingHorizontal: 16 }}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TEXT3, opacity: 0.7, transform: [{ translateY: dot }] }} />
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const historyRef = useRef<{ role: "user" | "ai"; text: string }[]>([]);
  const memoryRef = useRef<string[]>([]);

  useEffect(() => {
    // Welcome message
    setMessages([{
      id: "welcome",
      role: "ai",
      text: "Hey! I'm your Arc assistant. I can log food, water, sleep, steps, workouts, tasks, finances — anything you'd normally do manually. Just type it out.",
      timestamp: Date.now(),
    }]);
    getAiMemory().then(facts => { memoryRef.current = facts; }).catch(() => {});
  }, []);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, sending]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: "user",
      text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    historyRef.current.push({ role: "user", text });
    setSending(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not logged in");

      const res = await fetch(apiUrl("/api/agent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          accessToken: session.access_token,
          message: text,
          history: historyRef.current.slice(-8),
          memory: memoryRef.current,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        role: "ai",
        text: data.text || "Done!",
        actions: data.actions?.length > 0 ? data.actions : undefined,
        actionsApplied: false,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
      historyRef.current.push({ role: "ai", text: data.text });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e: any) {
      const errorText = e.message === "RATE_LIMITED"
        ? "You've hit the daily AI limit. Try again tomorrow."
        : "Something went wrong. Try again.";
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        role: "ai",
        text: errorText,
        timestamp: Date.now(),
      }]);
    }
    setSending(false);
  };

  const applyActions = async (msg: ChatMessage) => {
    if (!msg.actions || msg.actionsApplied) return;
    setApplyingId(msg.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Handle navigate actions locally
      const navAction = msg.actions.find((a: any) => a.type === "navigate" || a.route);
      if (navAction?.route) {
        router.push(navAction.route as any);
      }

      // Execute data actions via agent endpoint
      const dataActions = msg.actions.filter((a: any) => a.type !== "navigate" && !a.route);
      if (dataActions.length > 0) {
        const res = await fetch(apiUrl("/api/agent/apply"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id, accessToken: session.access_token, actions: dataActions }),
        });
        if (!res.ok) throw new Error("Failed");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionsApplied: true } : m));
    } catch {}
    setApplyingId(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const getActionIcon = (type: string): ArcIconName => {
    if (type.includes("nutrition")) return "plate";
    if (type.includes("hydration")) return "water";
    if (type.includes("sleep")) return "sleep";
    if (type.includes("step")) return "steps";
    if (type.includes("task")) return "checkSquare";
    if (type.includes("workout")) return "workout";
    if (type.includes("finance")) return "dollar";
    if (type.includes("weight")) return "scale";
    return "bolt";
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 16, color: DARK }}>←</Text>
        </Pressable>
        <LinearGradient colors={["#667eea", "#764ba2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.headerIcon}>
          <ArcIcon name="bolt" size={18} color="white" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: DARK }}>Arc AI</Text>
          <Text style={{ fontSize: 11, color: SUBTITLE }}>{sending ? "Thinking..." : "Online"}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <View key={msg.id} style={{ alignItems: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 8 }}>
              {msg.role === "user" ? (
                <LinearGradient
                  colors={["#667eea", "#764ba2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.bubble, styles.userBubble]}
                >
                  <Text style={styles.userText}>{msg.text}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.bubble, styles.aiBubble]}>
                  <Text style={styles.aiText}>{msg.text}</Text>
                </View>
              )}

              {/* Action buttons for AI messages */}
              {msg.role === "ai" && msg.actions && msg.actions.length > 0 && (
                <View style={{ maxWidth: "82%", marginTop: 6 }}>
                  <View style={styles.actionCard}>
                    {msg.actions.map((a: any, i: number) => (
                      <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: i < msg.actions!.length - 1 ? 6 : 0 }}>
                        <ArcIcon name={getActionIcon(a.type)} size={14} color={SUBTITLE} />
                        <Text style={{ fontSize: 12, fontWeight: "600", color: SUBTITLE }}>{a.type.replace(/_/g, " ")}</Text>
                      </View>
                    ))}
                  </View>
                  {msg.actionsApplied ? (
                    <View style={styles.appliedBadge}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: GREEN }}>Applied ✓</Text>
                    </View>
                  ) : (
                    <Pressable onPress={() => applyActions(msg)} disabled={applyingId === msg.id} style={{ marginTop: 6 }}>
                      <LinearGradient
                        colors={["#667eea", "#764ba2"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.applyBtn, applyingId === msg.id && { opacity: 0.7 }]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "700", color: "white" }}>
                          {applyingId === msg.id ? "Applying..." : `Apply ${msg.actions.length > 1 ? `${msg.actions.length} actions` : "action"}`}
                        </Text>
                      </LinearGradient>
                    </Pressable>
                  )}
                </View>
              )}

              <Text style={[styles.timestamp, { alignSelf: msg.role === "user" ? "flex-end" : "flex-start" }]}>
                {formatTime(msg.timestamp)}
              </Text>
            </View>
          ))}

          {/* Typing indicator */}
          {sending && (
            <View style={{ alignItems: "flex-start", marginBottom: 8 }}>
              <View style={[styles.bubble, styles.aiBubble, { paddingVertical: 0, paddingHorizontal: 0 }]}>
                <TypingDots />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={TEXT3}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <Pressable onPress={sendMessage} disabled={!input.trim() || sending}>
            <LinearGradient
              colors={input.trim() ? ["#667eea", "#764ba2"] : [BORDER, BORDER]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtn}
            >
              <Text style={{ fontSize: 18, color: input.trim() ? "white" : TEXT3, fontWeight: "800" }}>↑</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center" },
  headerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "82%", padding: 10, paddingHorizontal: 14 },
  userBubble: { borderRadius: 18, borderBottomRightRadius: 4 },
  aiBubble: { borderRadius: 18, borderBottomLeftRadius: 4, backgroundColor: SURFACE, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  userText: { fontSize: 14, fontWeight: "500", lineHeight: 21, color: "white" },
  aiText: { fontSize: 14, fontWeight: "500", lineHeight: 21, color: DARK },
  timestamp: { fontSize: 10, color: TEXT3, marginTop: 4, paddingHorizontal: 4 },
  actionCard: { backgroundColor: SURFACE, borderRadius: 14, padding: 10, paddingHorizontal: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3 },
  appliedBadge: { marginTop: 6, padding: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#dcfce7", alignItems: "center" },
  applyBtn: { padding: 10, paddingHorizontal: 14, borderRadius: 12, alignItems: "center" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: BORDER, backgroundColor: BG },
  input: { flex: 1, backgroundColor: SURFACE, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontWeight: "500", color: DARK, maxHeight: 100, borderWidth: 1.5, borderColor: BORDER },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
