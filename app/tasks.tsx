import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, RefreshControl, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { format } from "date-fns";
import { radius } from "@/lib/theme";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";

interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  date: string;
}

interface RecurringTask {
  id: string;
  title: string;
  frequency: "daily" | "weekdays" | "weekly" | "monthly";
  priority: number;
  active: boolean;
}

const PRIORITY_CONFIG = [
  { val: 1, label: "High", color: "#ef4444", bg: "#fee2e2" },
  { val: 2, label: "Med", color: "#f59e0b", bg: "#fef3c7" },
  { val: 3, label: "Low", color: "#9ca3af", bg: "#f3f4f6" },
] as const;

const FREQ_OPTIONS = [
  { val: "daily" as const, label: "Daily", icon: "sun" as ArcIconName },
  { val: "weekdays" as const, label: "Weekdays", icon: "briefcase" as ArcIconName },
  { val: "weekly" as const, label: "Weekly", icon: "calendar" as ArcIconName },
  { val: "monthly" as const, label: "Monthly", icon: "calendar" as ArcIconName },
];

export default function TasksScreen() {
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurring, setRecurring] = useState<RecurringTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState<1 | 2 | 3>(2);
  const [showRecurring, setShowRecurring] = useState(false);
  const [addingRecurring, setAddingRecurring] = useState(false);
  const [newRecurring, setNewRecurring] = useState("");
  const [newRecurringPriority, setNewRecurringPriority] = useState<1 | 2 | 3>(2);
  const [newFrequency, setNewFrequency] = useState<"daily" | "weekdays" | "weekly" | "monthly">("daily");
  const today = format(new Date(), "yyyy-MM-dd");

  const loadTasks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).eq("date", today).order("created_at", { ascending: true }),
      supabase.from("recurring_tasks").select("*").eq("user_id", user.id).eq("active", true).order("created_at", { ascending: true }),
    ]);
    setTasks(t || []);
    setRecurring(r || []);
    setLoading(false);
    setRefreshing(false);
  }, [today]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleToggle = async (task: Task) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await supabase.from("tasks").update({ completed: !task.completed }).eq("id", task.id);
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed } : t));
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete task?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("tasks").delete().eq("id", id);
        setTasks(prev => prev.filter(t => t.id !== id));
      }},
    ]);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await supabase.from("tasks").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: today,
      title: newTask.trim(),
      completed: false,
      priority: newPriority,
      created_at: Date.now(),
    });
    setNewTask("");
    loadTasks();
  };

  const addRecurringTask = async () => {
    if (!newRecurring.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await supabase.from("recurring_tasks").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      title: newRecurring.trim(),
      priority: newRecurringPriority,
      frequency: newFrequency,
      active: true,
      created_at: Date.now(),
    });
    setNewRecurring("");
    setAddingRecurring(false);
    loadTasks();
  };

  const deleteRecurring = (id: string) => {
    Alert.alert("Remove recurring task?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        await supabase.from("recurring_tasks").update({ active: false }).eq("id", id);
        setRecurring(prev => prev.filter(t => t.id !== id));
      }},
    ]);
  };

  const completed = tasks.filter(t => t.completed).length;
  const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.priority || 2) - (b.priority || 2);
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTasks(); }} tintColor={colors.text} />}
      >
        {/* Header */}
        <View style={{ paddingTop: 8, marginBottom: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
            {format(new Date(), "EEEE, MMM d")}
          </Text>
          <Text style={{ fontSize: 26, fontWeight: "900", color: colors.text, letterSpacing: -0.5 }}>Tasks</Text>
        </View>

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View>
            <Text style={styles.progressPct}>{pct}%</Text>
            <Text style={styles.progressLabel}>{completed} of {tasks.length} done</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 20 }}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              {pct === 100 ? "All done!" : `${tasks.length - completed} remaining`}
            </Text>
          </View>
        </View>

        {/* Priority filter chips */}
        <View style={{ flexDirection: "row", gap: 6, marginBottom: 14 }}>
          {PRIORITY_CONFIG.map(p => {
            const count = tasks.filter(t => t.priority === p.val && !t.completed).length;
            if (count === 0) return null;
            return (
              <View key={p.val} style={[styles.priorityChip, { backgroundColor: p.bg }]}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: p.color }} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: p.color }}>{count} {p.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Task list */}
        {sortedTasks.map(task => {
          const pc = PRIORITY_CONFIG.find(p => p.val === (task.priority || 2))!;
          return (
            <Pressable key={task.id} style={styles.taskItem} onPress={() => handleToggle(task)} onLongPress={() => handleDelete(task.id)}>
              <View style={[styles.taskCheck, task.completed && { backgroundColor: "#34C759", borderColor: "#34C759" }]}>
                {task.completed && <Text style={{ fontSize: 10, color: "white" }}>✓</Text>}
              </View>
              <Text style={[styles.taskTitle, task.completed && { textDecorationLine: "line-through", color: "#9ca3af" }]} numberOfLines={1}>{task.title}</Text>
              <View style={[styles.taskPriorityDot, { backgroundColor: pc.color }]} />
            </Pressable>
          );
        })}

        {tasks.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <View style={{ marginBottom: 8 }}><ArcIcon name="checkSquare" size={28} color="#C7C7CC" /></View>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>No tasks yet</Text>
            <Text style={{ fontSize: 12, color: "#9ca3af", fontWeight: "600", marginTop: 4 }}>Add a task below</Text>
          </View>
        )}

        {/* Add task */}
        <View style={styles.addCard}>
          {/* Priority picker */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, alignSelf: "center", marginRight: 4 }}>Priority</Text>
            {PRIORITY_CONFIG.map(p => (
              <Pressable key={p.val} onPress={() => setNewPriority(p.val as 1 | 2 | 3)}
                style={[styles.priorityBtn, newPriority === p.val && { backgroundColor: p.bg, borderWidth: 2, borderColor: p.color }]}>
                <Text style={[styles.priorityBtnText, newPriority === p.val && { color: p.color }]}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={styles.addInput}
              placeholder="Add a task..."
              placeholderTextColor="#9ca3af"
              value={newTask}
              onChangeText={setNewTask}
              onSubmitEditing={addTask}
              returnKeyType="done"
            />
            <Pressable style={[styles.addBtn, !newTask.trim() && { backgroundColor: "#e5e7eb" }]} onPress={addTask}>
              <Text style={{ fontSize: 22, color: newTask.trim() ? "white" : "#9ca3af" }}>+</Text>
            </Pressable>
          </View>
        </View>

        {/* Recurring tasks toggle */}
        <Pressable style={styles.recurringToggle} onPress={() => setShowRecurring(!showRecurring)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ArcIcon name="repeat" size={16} color={colors.text} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text2 }}>Recurring Tasks</Text>
            <View style={styles.recurringBadge}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#9ca3af" }}>{recurring.length}</Text>
            </View>
          </View>
          <Text style={{ color: "#9ca3af", fontSize: 18 }}>{showRecurring ? "▾" : "›"}</Text>
        </Pressable>

        {showRecurring && (
          <View style={styles.recurringCard}>
            {recurring.map(r => {
              const pc = PRIORITY_CONFIG.find(p => p.val === (r.priority || 2))!;
              const fc = FREQ_OPTIONS.find(f => f.val === r.frequency)!;
              return (
                <View key={r.id} style={styles.recurringItem}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: pc.color }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>{r.title}</Text>
                    <View style={{ flexDirection: "row", gap: 4, marginTop: 3 }}>
                      <Text style={[styles.tagPill, { color: pc.color, backgroundColor: pc.bg }]}>{pc.label}</Text>
                      <View style={[styles.tagPill, { backgroundColor: "#f3f4f6", flexDirection: "row", alignItems: "center", gap: 4 }]}>{fc && <ArcIcon name={fc.icon} size={10} color="#6b7280" />}<Text style={{ color: "#6b7280" }}>{fc?.label}</Text></View>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteRecurring(r.id)} style={styles.deleteBtn}>
                    <Text style={{ fontSize: 16, color: "#ef4444" }}>×</Text>
                  </Pressable>
                </View>
              );
            })}

            {!addingRecurring ? (
              <Pressable onPress={() => setAddingRecurring(true)} style={styles.addRecurringBtn}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#6b7280" }}>+ Add Recurring Task</Text>
              </Pressable>
            ) : (
              <View style={styles.addRecurringForm}>
                <TextInput
                  style={styles.recurringInput}
                  placeholder="Task name..."
                  placeholderTextColor="#9ca3af"
                  value={newRecurring}
                  onChangeText={setNewRecurring}
                  autoFocus
                />
                <View style={{ flexDirection: "row", gap: 5, marginTop: 10 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, alignSelf: "center", marginRight: 2 }}>Priority</Text>
                  {PRIORITY_CONFIG.map(p => (
                    <Pressable key={p.val} onPress={() => setNewRecurringPriority(p.val as 1 | 2 | 3)}
                      style={[styles.miniPriorityBtn, newRecurringPriority === p.val && { backgroundColor: p.bg, borderWidth: 1.5, borderColor: p.color }]}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: newRecurringPriority === p.val ? p.color : "#9ca3af" }}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 5, marginTop: 10 }}>
                  <Text style={{ fontSize: 9, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 1, alignSelf: "center", marginRight: 2 }}>Repeat</Text>
                  {FREQ_OPTIONS.map(f => (
                    <Pressable key={f.val} onPress={() => setNewFrequency(f.val)}
                      style={[styles.miniFreqBtn, newFrequency === f.val && { backgroundColor: "#e0e7ff", borderWidth: 1.5, borderColor: "#6366f1" }]}>
                      <View style={{ alignItems: "center" }}><ArcIcon name={f.icon} size={12} color={newFrequency === f.val ? "#4338ca" : "#9ca3af"} /><Text style={{ fontSize: 9, fontWeight: "700", color: newFrequency === f.val ? "#4338ca" : "#9ca3af", textAlign: "center" }}>{f.label}</Text></View>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                  <Pressable onPress={addRecurringTask} style={styles.addRecurringSubmit}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "white" }}>Add</Text>
                  </Pressable>
                  <Pressable onPress={() => { setAddingRecurring(false); setNewRecurring(""); }} style={styles.addRecurringCancel}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#6b7280" }}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  // Progress
  progressCard: { borderRadius: 24, padding: 18, flexDirection: "row", alignItems: "center", marginBottom: 14, overflow: "hidden", backgroundColor: "#e0e7ff" },
  progressPct: { fontSize: 48, fontWeight: "900", color: "#3730a3", letterSpacing: -3 },
  progressLabel: { fontSize: 11, fontWeight: "700", color: "#6366f1", textTransform: "uppercase", letterSpacing: 1, marginTop: 2 },
  progressBarBg: { height: 6, backgroundColor: "rgba(99,102,241,0.2)", borderRadius: 99, overflow: "hidden" },
  progressBarFill: { height: 6, backgroundColor: "#6366f1", borderRadius: 99 },
  progressHint: { fontSize: 10, color: "#6366f1", fontWeight: "600", marginTop: 6 },
  // Priority chips
  priorityChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
  // Task item
  taskItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  taskCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  taskTitle: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1 },
  taskPriorityDot: { width: 8, height: 8, borderRadius: 4 },
  emptyState: { backgroundColor: colors.surface, borderRadius: 20, padding: 32, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  // Add task
  addCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 14, marginTop: 8, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  priorityBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: "center", backgroundColor: "#f7f8fc" },
  priorityBtnText: { fontSize: 11, fontWeight: "700", color: "#9ca3af" },
  addInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, fontWeight: "600", color: colors.text },
  addBtn: { width: 46, height: 46, backgroundColor: "#111118", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  // Recurring
  recurringToggle: { backgroundColor: colors.surface, borderRadius: 16, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
  recurringBadge: { backgroundColor: colors.bg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  recurringCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12 },
  recurringItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f7f8fc" },
  tagPill: { fontSize: 9, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: "hidden" },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center" },
  addRecurringBtn: { paddingVertical: 11, borderRadius: 12, backgroundColor: colors.bg, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed", alignItems: "center", marginTop: 8 },
  addRecurringForm: { padding: 12, backgroundColor: colors.bg, borderRadius: 14, marginTop: 8 },
  recurringInput: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontWeight: "600", color: colors.text },
  miniPriorityBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: "center", backgroundColor: "white" },
  miniFreqBtn: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, alignItems: "center", backgroundColor: "white" },
  addRecurringSubmit: { flex: 1, paddingVertical: 10, backgroundColor: "#111118", borderRadius: 10, alignItems: "center" },
  addRecurringCancel: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.surface, borderRadius: 10, alignItems: "center" },
});
