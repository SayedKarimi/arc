import { useEffect, useState, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, StyleSheet, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import Svg, { Circle } from "react-native-svg";
import { spacing, radius } from "@/lib/theme";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon } from "@/components/ArcIcon";

const FAST_PRESETS = [
  { label: "16:8", hours: 16, desc: "16h fast, 8h eat" },
  { label: "18:6", hours: 18, desc: "18h fast, 6h eat" },
  { label: "20:4", hours: 20, desc: "20h fast, 4h eat" },
  { label: "OMAD", hours: 23, desc: "One meal a day" },
];

interface FastSession {
  id: string;
  started_at: number;
  target_hours: number;
  ended_at?: number;
}

export default function FastingScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeFast, setActiveFast] = useState<FastSession | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<FastSession[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { load(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  useEffect(() => {
    if (activeFast) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeFast.started_at) / 1000));
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [activeFast]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("fasting_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false })
      .limit(20);
    const sessions = data || [];
    const active = sessions.find(s => !s.ended_at);
    if (active) {
      setActiveFast(active);
      setElapsed(Math.floor((Date.now() - active.started_at) / 1000));
    }
    setHistory(sessions.filter(s => s.ended_at));
  };

  const startFast = async (hours: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const session: FastSession = {
      id: Math.random().toString(36).slice(2),
      started_at: Date.now(),
      target_hours: hours,
    };
    await supabase.from("fasting_sessions").insert({ ...session, user_id: user.id });
    setActiveFast(session);
    setElapsed(0);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const endFast = () => {
    Alert.alert("End fast?", `You've been fasting for ${formatTime(elapsed)}.`, [
      { text: "Continue", style: "cancel" },
      { text: "End Fast", onPress: async () => {
        if (!activeFast) return;
        await supabase.from("fasting_sessions").update({ ended_at: Date.now() }).eq("id", activeFast.id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setActiveFast(null);
        setElapsed(0);
        load();
      }},
    ]);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  };

  const formatShort = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const targetSecs = activeFast ? activeFast.target_hours * 3600 : 0;
  const pct = targetSecs > 0 ? Math.min(elapsed / targetSecs, 1) : 0;
  const ringSize = 200;
  const strokeWidth = 12;
  const r = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={styles.title}>Fasting</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        {activeFast ? (
          <>
            <View style={[styles.card, { alignItems: "center", paddingVertical: 32 }]}>
              <View style={{ position: "relative", width: ringSize, height: ringSize, alignItems: "center", justifyContent: "center" }}>
                <Svg width={ringSize} height={ringSize} style={{ position: "absolute" }}>
                  <Circle cx={ringSize / 2} cy={ringSize / 2} r={r} stroke={colors.surface2} strokeWidth={strokeWidth} fill="none" />
                  <Circle cx={ringSize / 2} cy={ringSize / 2} r={r}
                    stroke={pct >= 1 ? colors.green || "#00C853" : colors.text}
                    strokeWidth={strokeWidth} fill="none"
                    strokeDasharray={`${circumference}`} strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round" rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}
                  />
                </Svg>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text2 }}>
                  {pct >= 1 ? "COMPLETE" : "FASTING"}
                </Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: colors.text, marginTop: 4 }}>
                  {formatTime(elapsed)}
                </Text>
                <Text style={{ fontSize: 12, color: colors.text3, marginTop: 4 }}>
                  Goal: {activeFast.target_hours}h
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
              <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>{Math.round(pct * 100)}%</Text>
                <Text style={{ fontSize: 11, color: colors.text2 }}>Complete</Text>
              </View>
              <View style={[styles.card, { flex: 1, alignItems: "center" }]}>
                <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>
                  {targetSecs - elapsed > 0 ? formatShort(targetSecs - elapsed) : "0h 0m"}
                </Text>
                <Text style={{ fontSize: 11, color: colors.text2 }}>Remaining</Text>
              </View>
            </View>

            <Pressable style={[styles.endBtn]} onPress={endFast}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#FF4444" }}>End Fast</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ fontSize: 14, color: colors.text2, textAlign: "center", marginBottom: 20 }}>
              Choose a fasting protocol to start
            </Text>
            {FAST_PRESETS.map(preset => (
              <Pressable key={preset.label} style={styles.card} onPress={() => startFast(preset.hours)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>{preset.label}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{preset.desc}</Text>
                    <Text style={{ fontSize: 12, color: colors.text2, marginTop: 2 }}>{preset.hours} hour fast</Text>
                  </View>
                  <Text style={{ fontSize: 18, color: colors.text3 }}>›</Text>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Recent Fasts</Text>
            {history.slice(0, 10).map(s => {
              const dur = Math.floor(((s.ended_at || 0) - s.started_at) / 1000);
              const completed = dur >= s.target_hours * 3600;
              return (
                <View key={s.id} style={styles.historyRow}>
                  <ArcIcon name={completed ? "check" : "timer"} size={16} color={completed ? "#22c55e" : colors.text3} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                      {formatShort(dur)} / {s.target_hours}h goal
                    </Text>
                    <Text style={{ fontSize: 11, color: colors.text3 }}>
                      {format(new Date(s.started_at), "MMM d, h:mm a")}
                    </Text>
                  </View>
                </View>
              );
            })}
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
  sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.text2, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 10 },
  endBtn: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 16, alignItems: "center", marginTop: 12, borderWidth: 1.5, borderColor: "#FF4444" },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14, marginBottom: 6 },
});
