import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Modal, Alert, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths } from "date-fns";
import { useColors } from "@/lib/ThemeContext";
import { supabase } from "@/lib/supabase/client";
import { ArcIcon, ArcIconName } from "@/components/ArcIcon";

const P = "#FF2D78";
const GREEN = "#22C55E";
const RED = "#EF4444";
const DARK = "#111118";
const BG = "#F2F2F7";
const SUBTITLE = "#8E8E93";

const EXPENSE_CATEGORIES: { key: string; icon: ArcIconName; color: string }[] = [
  { key: "Housing", icon: "housing", color: "#6366f1" },
  { key: "Food", icon: "food", color: "#f59e0b" },
  { key: "Transport", icon: "transport", color: "#3b82f6" },
  { key: "Health", icon: "health", color: "#22c55e" },
  { key: "Shopping", icon: "shopping", color: "#ec4899" },
  { key: "Entertainment", icon: "entertainment", color: "#8b5cf6" },
  { key: "Subscriptions", icon: "subscriptions", color: "#06b6d4" },
  { key: "Other", icon: "other", color: "#9ca3af" },
];

const INCOME_CATEGORIES: { key: string; icon: ArcIconName; color: string }[] = [
  { key: "Salary", icon: "card", color: "#22c55e" },
  { key: "Freelance", icon: "edit", color: "#3b82f6" },
  { key: "Investment", icon: "progress", color: "#8b5cf6" },
  { key: "Gift", icon: "party", color: "#f59e0b" },
  { key: "Other", icon: "moneybag", color: "#9ca3af" },
];

interface FinanceGoal {
  id: string;
  name: string;
  target: number;
  current: number;
}

interface Debt {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimum_payment: number;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  type: string;
  category: string;
  description: string;
  goal_id?: string;
}

type Tab = "overview" | "expenses" | "income" | "goals" | "budget" | "debts";

function ProgressRing({ pct, size = 60 }: { pct: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  // Simple circle representation
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size - 10, height: size - 10, borderRadius: (size - 10) / 2, borderWidth: 4, borderColor: pct >= 100 ? GREEN : P, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 10, fontWeight: "800", color: DARK }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

export default function FinanceScreen() {
  const colors = useColors();
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [viewDate, setViewDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [addType, setAddType] = useState<"expense" | "income">("expense");
  const [form, setForm] = useState({ amount: "", description: "", category: "Other" });
  const [goalForm, setGoalForm] = useState({ name: "", target: "" });
  const [debtForm, setDebtForm] = useState({ name: "", balance: "", apr: "", minimum_payment: "" });
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: g }, { data: t }, { data: d }] = await Promise.all([
      supabase.from("finance_goals").select("*").eq("user_id", user.id),
      supabase.from("finance_transactions").select("*").eq("user_id", user.id).order("timestamp", { ascending: false }).limit(200),
      supabase.from("finance_debts").select("*").eq("user_id", user.id),
    ]);
    setGoals(g || []);
    setEntries(t || []);
    setDebts(d || []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Month navigation
  const isCurMonth = format(viewDate, "yyyy-MM") === format(new Date(), "yyyy-MM");
  const goPrev = () => setViewDate(d => subMonths(d, 1));
  const goNext = () => { if (!isCurMonth) setViewDate(d => addMonths(d, 1)); };

  // Month data
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const inMonth = (date: string) => {
    try { return isWithinInterval(new Date(date + "T12:00:00"), { start: monthStart, end: monthEnd }); }
    catch { return false; }
  };
  const thisMonth = entries.filter(e => inMonth(e.date));
  const monthExp = thisMonth.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const monthInc = thisMonth.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const net = monthInc - monthExp;

  // Previous month comparison
  const prevMD = subMonths(viewDate, 1);
  const prevMAll = entries.filter(e => { try { return isWithinInterval(new Date(e.date + "T12:00:00"), { start: startOfMonth(prevMD), end: endOfMonth(prevMD) }); } catch { return false; } });
  const prevExp = prevMAll.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const expChg = prevExp > 0 ? (monthExp - prevExp) / prevExp * 100 : 0;

  // Category breakdown
  const catMap: Record<string, number> = {};
  thisMonth.filter(e => e.type === "expense").forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
  const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

  // Income by source
  const incBySource: Record<string, number> = {};
  thisMonth.filter(e => e.type === "income").forEach(e => { incBySource[e.category] = (incBySource[e.category] || 0) + e.amount; });
  const topIncomeSources = Object.entries(incBySource).sort((a, b) => b[1] - a[1]);

  // 12-month bar chart data
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(viewDate, 11 - i);
    const ms = startOfMonth(d); const me = endOfMonth(d);
    const amt = entries.filter(e => e.type === "expense" && (() => { try { return isWithinInterval(new Date(e.date + "T12:00:00"), { start: ms, end: me }); } catch { return false; } })()).reduce((s, e) => s + e.amount, 0);
    return { month: format(d, "MMM")[0], amount: amt, isCurrent: format(d, "yyyy-MM") === format(viewDate, "yyyy-MM") };
  });
  const maxChart = Math.max(1, ...chartData.map(d => d.amount));

  const handleAdd = async () => {
    if (!form.amount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("finance_transactions").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      date: format(new Date(), "yyyy-MM-dd"),
      amount: parseFloat(form.amount) || 0,
      type: addType,
      category: form.category,
      description: form.description || form.category,
      timestamp: Date.now(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setForm({ amount: "", description: "", category: "Other" });
    setShowAdd(false);
    setSaving(false);
    loadData();
  };

  const handleAddGoal = async () => {
    if (!goalForm.name || !goalForm.target) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("finance_goals").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      name: goalForm.name,
      target: parseFloat(goalForm.target) || 1000,
      current: 0,
      currency: "USD",
      created_at: Date.now(),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setGoalForm({ name: "", target: "" });
    setShowAddGoal(false);
    setSaving(false);
    loadData();
  };

  const handleAddDebt = async () => {
    if (!debtForm.name || !debtForm.balance) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("finance_debts").insert({
      id: Math.random().toString(36).slice(2),
      user_id: user.id,
      name: debtForm.name,
      balance: parseFloat(debtForm.balance) || 0,
      apr: parseFloat(debtForm.apr) || 0,
      minimum_payment: parseFloat(debtForm.minimum_payment) || 0,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDebtForm({ name: "", balance: "", apr: "", minimum_payment: "" });
    setShowAddDebt(false);
    setSaving(false);
    loadData();
  };

  const addToGoal = async (goal: FinanceGoal) => {
    Alert.prompt("Add to " + goal.name, "How much to add?", async (text) => {
      const amount = parseFloat(text);
      if (!amount || amount <= 0) return;
      await supabase.from("finance_goals").update({ current: (goal.current || 0) + amount }).eq("id", goal.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }, "plain-text", "", "decimal-pad");
  };

  const withdrawFromGoal = async (goal: FinanceGoal) => {
    Alert.prompt("Withdraw from " + goal.name, "How much to withdraw?", async (text) => {
      const amount = parseFloat(text);
      if (!amount || amount <= 0) return;
      const newVal = Math.max(0, (goal.current || 0) - amount);
      await supabase.from("finance_goals").update({ current: newVal }).eq("id", goal.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }, "plain-text", "", "decimal-pad");
  };

  const editGoalTarget = async (goal: FinanceGoal) => {
    Alert.prompt("Edit Target", "New target amount for " + goal.name, async (text) => {
      const amount = parseFloat(text);
      if (!amount || amount <= 0) return;
      await supabase.from("finance_goals").update({ target: amount }).eq("id", goal.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    }, "plain-text", goal.target.toString(), "decimal-pad");
  };

  const deleteGoal = (goal: FinanceGoal) => {
    Alert.alert("Delete " + goal.name + "?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("finance_goals").delete().eq("id", goal.id);
        setGoals(prev => prev.filter(g => g.id !== goal.id));
      }},
    ]);
  };

  const deleteDebt = (debt: Debt) => {
    Alert.alert("Delete " + debt.name + "?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("finance_debts").delete().eq("id", debt.id);
        setDebts(prev => prev.filter(d => d.id !== debt.id));
      }},
    ]);
  };

  const deleteTransaction = (id: string) => {
    Alert.alert("Delete?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await supabase.from("finance_transactions").delete().eq("id", id);
        setEntries(prev => prev.filter(e => e.id !== id));
      }},
    ]);
  };

  const cats = addType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const findEC = (k: string) => EXPENSE_CATEGORIES.find(c => c.key === k) ?? EXPENSE_CATEGORIES[7];

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "expenses", label: "Expenses" },
    { key: "income", label: "Income" },
    { key: "goals", label: "Goals" },
    { key: "budget", label: "Budget" },
    { key: "debts", label: "Debts" },
  ];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <ActivityIndicator size="large" color={P} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={P} />}
      >
        {/* Gradient header effect */}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, opacity: 0.15, backgroundColor: P }} />

        <View style={{ paddingHorizontal: 16, position: "relative", zIndex: 1 }}>
          {/* Month nav */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.75)", borderRadius: 99, paddingVertical: 5, paddingHorizontal: 10, marginTop: 8, marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,45,120,0.15)" }}>
            <Pressable onPress={goPrev}><Text style={{ fontSize: 14, color: P, fontWeight: "900" }}>‹</Text></Pressable>
            <Text style={{ fontSize: 11, fontWeight: "700", color: "#374151" }}>{format(viewDate, "MMMM yyyy")}</Text>
            <Pressable onPress={goNext} disabled={isCurMonth}><Text style={{ fontSize: 14, color: isCurMonth ? "#D1D5DB" : P, fontWeight: "900" }}>›</Text></Pressable>
          </View>

          {/* Title */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 28, fontWeight: "900", color: DARK }}>Finance</Text>
          </View>

          {/* Summary cards */}
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <View style={[styles.summaryCard, { flex: 1 }]}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: SUBTITLE }}>Spent</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: RED }}>${monthExp.toLocaleString()}</Text>
              {Math.abs(expChg) > 0.1 && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                  <View style={{ backgroundColor: expChg > 0 ? "#FEE2E2" : "#DCFCE7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}>
                    <Text style={{ fontSize: 9, fontWeight: "800", color: expChg > 0 ? "#DC2626" : "#16A34A" }}>{expChg > 0 ? "↑" : "↓"} {Math.abs(expChg).toFixed(1)}%</Text>
                  </View>
                </View>
              )}
            </View>
            <View style={[styles.summaryCard, { flex: 1 }]}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: SUBTITLE }}>Earned</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: GREEN }}>${monthInc.toLocaleString()}</Text>
            </View>
            <View style={[styles.summaryCard, { flex: 1 }]}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: SUBTITLE }}>Net</Text>
              <Text style={{ fontSize: 22, fontWeight: "900", color: net >= 0 ? GREEN : RED }}>{net >= 0 ? "+" : "-"}${Math.abs(net).toLocaleString()}</Text>
            </View>
          </View>

          {/* Tab bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: "row", gap: 4 }}>
              {TABS.map(t => (
                <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tabPill, tab === t.key && styles.tabPillActive]}>
                  <Text style={[styles.tabPillText, tab === t.key && styles.tabPillTextActive]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* ── OVERVIEW TAB ── */}
          {tab === "overview" && (
            <>
              {/* 12-month bar chart */}
              <View style={styles.chartCard}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>12 Month Spending</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 3 }}>
                  {chartData.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{
                        width: "100%",
                        height: `${Math.max(d.amount > 0 ? 8 : 2, (d.amount / maxChart) * 100)}%`,
                        backgroundColor: d.isCurrent ? P : "#FFB3CC",
                        borderTopLeftRadius: 3,
                        borderTopRightRadius: 3,
                      }} />
                      <Text style={{ fontSize: 8, color: SUBTITLE, marginTop: 4 }}>{d.month}</Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Category breakdown */}
              {sortedCats.length > 0 && (
                <View style={styles.chartCard}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>By Category</Text>
                  {sortedCats.map(([cat, amount]) => {
                    const ec = findEC(cat);
                    const pct = monthExp > 0 ? (amount / monthExp) * 100 : 0;
                    return (
                      <View key={cat} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
                        <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ec.color + "20", alignItems: "center", justifyContent: "center" }}>
                          <ArcIcon name={ec.icon} size={18} color={ec.color} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                            <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{cat}</Text>
                            <Text style={{ fontSize: 14, fontWeight: "700", color: DARK }}>${amount.toLocaleString()}</Text>
                          </View>
                          <View style={{ height: 4, borderRadius: 2, backgroundColor: "#F2F2F7" }}>
                            <View style={{ height: 4, borderRadius: 2, backgroundColor: ec.color, width: `${pct}%` }} />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Insights */}
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={[styles.insightCard, { flex: 1 }]}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: SUBTITLE }}>Daily avg</Text>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: DARK, marginTop: 4 }}>
                    ${(monthExp / Math.max(1, new Date().getDate())).toFixed(0)}
                  </Text>
                </View>
                <View style={[styles.insightCard, { flex: 1 }]}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: SUBTITLE }}>Projected</Text>
                  <Text style={{ fontSize: 18, fontWeight: "900", color: RED, marginTop: 4 }}>
                    ${Math.round((monthExp / Math.max(1, new Date().getDate())) * new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()).toLocaleString()}
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* ── EXPENSES TAB ── */}
          {tab === "expenses" && (
            <>
              <View style={styles.chartCard}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>This Month</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: RED, marginBottom: 16 }}>${monthExp.toLocaleString()}</Text>
                {thisMonth.filter(e => e.type === "expense").sort((a, b) => b.amount - a.amount).map(tx => {
                  const ec = findEC(tx.category);
                  return (
                    <Pressable key={tx.id} onLongPress={() => deleteTransaction(tx.id)} style={styles.txRow}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: ec.color + "20", alignItems: "center", justifyContent: "center" }}>
                        <ArcIcon name={ec.icon} size={18} color={ec.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{tx.description || tx.category}</Text>
                        <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{tx.date} · {tx.category}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: RED }}>-${tx.amount}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* ── INCOME TAB ── */}
          {tab === "income" && (
            <>
              <View style={styles.chartCard}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>This Month</Text>
                <Text style={{ fontSize: 28, fontWeight: "900", color: GREEN, marginBottom: 16 }}>${monthInc.toLocaleString()}</Text>

                {topIncomeSources.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: SUBTITLE, marginBottom: 8 }}>BY SOURCE</Text>
                    {topIncomeSources.map(([cat, amount]) => {
                      const ic = INCOME_CATEGORIES.find(c => c.key === cat) ?? INCOME_CATEGORIES[4];
                      return (
                        <View key={cat} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 10 }}>
                          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: ic.color + "20", alignItems: "center", justifyContent: "center" }}>
                            <ArcIcon name={ic.icon} size={18} color={ic.color} />
                          </View>
                          <Text style={{ flex: 1, fontSize: 14, fontWeight: "600", color: DARK }}>{cat}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: GREEN }}>${amount.toLocaleString()}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {thisMonth.filter(e => e.type === "income").map(tx => {
                  const ic = INCOME_CATEGORIES.find(c => c.key === tx.category) ?? INCOME_CATEGORIES[4];
                  return (
                    <Pressable key={tx.id} onLongPress={() => deleteTransaction(tx.id)} style={styles.txRow}>
                      <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: ic.color + "20", alignItems: "center", justifyContent: "center" }}>
                        <ArcIcon name={ic.icon} size={18} color={ic.color} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{tx.description || tx.category}</Text>
                        <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{tx.date}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: GREEN }}>+${tx.amount}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* ── GOALS TAB ── */}
          {tab === "goals" && (
            <>
              {goals.map(goal => {
                const actual = goal.current || 0;
                const actualPct = goal.target > 0 ? Math.min(actual / goal.target, 1) * 100 : 0;

                return (
                  <View key={goal.id} style={styles.goalCard}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                      <ProgressRing pct={actualPct} size={60} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: DARK }}>{goal.name}</Text>
                        <Text style={{ fontSize: 13, color: SUBTITLE, marginTop: 4 }}>
                          ${actual.toLocaleString()} / ${goal.target.toLocaleString()}
                        </Text>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: "#FFE4EE", marginTop: 8 }}>
                          <View style={{ height: 6, borderRadius: 3, backgroundColor: actualPct >= 100 ? GREEN : P, width: `${actualPct}%` }} />
                        </View>
                      </View>
                    </View>
                    {/* Goal actions */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F2F2F7" }}>
                      <Pressable onPress={() => addToGoal(goal)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#DCFCE7", alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#16A34A" }}>+ Add</Text>
                      </Pressable>
                      <Pressable onPress={() => withdrawFromGoal(goal)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>- Withdraw</Text>
                      </Pressable>
                      <Pressable onPress={() => editGoalTarget(goal)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F2F2F7", alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: DARK }}>Edit</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteGoal(goal)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#FEE2E2", alignItems: "center" }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626" }}>×</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}

              <Pressable onPress={() => setShowAddGoal(true)} style={styles.addGoalBtn}>
                <Text style={{ fontSize: 24, color: SUBTITLE }}>+</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: SUBTITLE }}>Add Goal</Text>
              </Pressable>
            </>
          )}

          {/* ── BUDGET TAB ── */}
          {tab === "budget" && (
            <>
              <View style={styles.chartCard}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>Monthly Budget</Text>
                <Text style={{ fontSize: 13, color: SUBTITLE, marginBottom: 16 }}>Set category limits to manage your spending.</Text>
                {sortedCats.length > 0 ? sortedCats.map(([cat, amount]) => {
                  const ec = findEC(cat);
                  const budgetLimit = 500; // default budget per category
                  const pctUsed = (amount / budgetLimit) * 100;
                  return (
                    <View key={cat} style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <ArcIcon name={ec.icon} size={18} color={ec.color} />
                          <Text style={{ fontSize: 14, fontWeight: "600", color: DARK }}>{cat}</Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: pctUsed > 100 ? RED : DARK }}>${amount} / $500</Text>
                      </View>
                      <View style={{ height: 6, borderRadius: 3, backgroundColor: "#F2F2F7" }}>
                        <View style={{ height: 6, borderRadius: 3, backgroundColor: pctUsed > 100 ? RED : pctUsed > 80 ? "#f59e0b" : GREEN, width: `${Math.min(pctUsed, 100)}%` }} />
                      </View>
                    </View>
                  );
                }) : (
                  <Text style={{ fontSize: 13, color: SUBTITLE, textAlign: "center", paddingVertical: 20 }}>No expenses yet this month.</Text>
                )}
              </View>
            </>
          )}

          {/* ── DEBTS TAB ── */}
          {tab === "debts" && (
            <>
              {debts.length > 0 ? (
                <>
                  <View style={styles.chartCard}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: SUBTITLE, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Total Debt</Text>
                    <Text style={{ fontSize: 28, fontWeight: "900", color: RED, marginBottom: 4 }}>${debts.reduce((s, d) => s + d.balance, 0).toLocaleString()}</Text>
                    <Text style={{ fontSize: 11, color: SUBTITLE }}>Surplus income applies to highest APR first</Text>
                  </View>
                  {debts.sort((a, b) => b.apr - a.apr).map(debt => (
                    <Pressable key={debt.id} onLongPress={() => deleteDebt(debt)} style={styles.chartCard}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <View>
                          <Text style={{ fontSize: 16, fontWeight: "700", color: DARK }}>{debt.name}</Text>
                          <Text style={{ fontSize: 11, color: SUBTITLE, marginTop: 2 }}>{debt.apr}% APR</Text>
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: "900", color: RED }}>${debt.balance.toLocaleString()}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F2F2F7" }}>
                        <Text style={{ fontSize: 11, color: SUBTITLE }}>Min payment</Text>
                        <Text style={{ fontSize: 13, fontWeight: "700", color: DARK }}>${debt.minimum_payment}/mo</Text>
                      </View>
                    </Pressable>
                  ))}
                </>
              ) : (
                <View style={{ alignItems: "center", paddingTop: 60 }}>
                  <ArcIcon name="party" size={40} color="#22c55e" />
                  <Text style={{ fontSize: 20, fontWeight: "700", color: DARK, marginBottom: 8 }}>No Debts</Text>
                  <Text style={{ fontSize: 14, color: SUBTITLE }}>You're debt-free! Keep it up.</Text>
                </View>
              )}
              <Pressable onPress={() => setShowAddDebt(true)} style={[styles.addGoalBtn, { marginTop: 12 }]}>
                <Text style={{ fontSize: 24, color: SUBTITLE }}>+</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: SUBTITLE }}>Add Debt</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* FAB - bottom right */}
      <Pressable onPress={() => setShowAdd(true)} style={{ position: "absolute", bottom: 110, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: P, alignItems: "center", justifyContent: "center", shadowColor: P, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "700", marginTop: -2 }}>+</Text>
      </Pressable>

      {/* Add transaction modal */}
      <Modal visible={showAdd} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: DARK }}>Add Transaction</Text>
              <Pressable onPress={() => setShowAdd(false)}>
                <Text style={{ fontSize: 16, color: SUBTITLE }}>Cancel</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
              <Pressable onPress={() => setAddType("expense")} style={[styles.typePill, addType === "expense" && { backgroundColor: RED }]}>
                <Text style={[styles.typePillText, addType === "expense" && { color: "white" }]}>Expense</Text>
              </Pressable>
              <Pressable onPress={() => setAddType("income")} style={[styles.typePill, addType === "income" && { backgroundColor: GREEN }]}>
                <Text style={[styles.typePillText, addType === "income" && { color: "white" }]}>Income</Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Amount ($)</Text>
            <TextInput style={styles.input} placeholder="0.00" placeholderTextColor="#C7C7CC" value={form.amount} onChangeText={v => setForm(f => ({ ...f, amount: v }))} keyboardType="decimal-pad" />

            <Text style={[styles.label, { marginTop: 16 }]}>Category</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {cats.map(c => (
                <Pressable key={c.key} onPress={() => setForm(f => ({ ...f, category: c.key }))} style={[styles.catPill, form.category === c.key && { backgroundColor: DARK }]}>
                  <ArcIcon name={c.icon} size={18} color={DARK} />
                  <Text style={[{ fontSize: 12, fontWeight: "600", color: DARK }, form.category === c.key && { color: "white" }]}>{c.key}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Note</Text>
            <TextInput style={styles.input} placeholder="Optional" placeholderTextColor="#C7C7CC" value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} />

            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAdd} disabled={saving}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{saving ? "Saving..." : "Save"}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Add goal modal */}
      <Modal visible={showAddGoal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: DARK }}>New Goal</Text>
              <Pressable onPress={() => setShowAddGoal(false)}>
                <Text style={{ fontSize: 16, color: SUBTITLE }}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Goal Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Japan Trip" placeholderTextColor="#C7C7CC" value={goalForm.name} onChangeText={v => setGoalForm(f => ({ ...f, name: v }))} />
            <Text style={[styles.label, { marginTop: 16 }]}>Target Amount ($)</Text>
            <TextInput style={styles.input} placeholder="5000" placeholderTextColor="#C7C7CC" value={goalForm.target} onChangeText={v => setGoalForm(f => ({ ...f, target: v }))} keyboardType="decimal-pad" />
            <Pressable style={styles.saveBtn} onPress={handleAddGoal}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>Create Goal</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Add debt modal */}
      <Modal visible={showAddDebt} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: "900", color: DARK }}>Add Debt</Text>
              <Pressable onPress={() => setShowAddDebt(false)}>
                <Text style={{ fontSize: 16, color: SUBTITLE }}>Cancel</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} placeholder="e.g. Student Loan" placeholderTextColor="#C7C7CC" value={debtForm.name} onChangeText={v => setDebtForm(f => ({ ...f, name: v }))} />
            <Text style={[styles.label, { marginTop: 16 }]}>Balance ($)</Text>
            <TextInput style={styles.input} placeholder="10000" placeholderTextColor="#C7C7CC" value={debtForm.balance} onChangeText={v => setDebtForm(f => ({ ...f, balance: v }))} keyboardType="decimal-pad" />
            <Text style={[styles.label, { marginTop: 16 }]}>APR (%)</Text>
            <TextInput style={styles.input} placeholder="6.5" placeholderTextColor="#C7C7CC" value={debtForm.apr} onChangeText={v => setDebtForm(f => ({ ...f, apr: v }))} keyboardType="decimal-pad" />
            <Text style={[styles.label, { marginTop: 16 }]}>Minimum Payment ($/mo)</Text>
            <TextInput style={styles.input} placeholder="150" placeholderTextColor="#C7C7CC" value={debtForm.minimum_payment} onChangeText={v => setDebtForm(f => ({ ...f, minimum_payment: v }))} keyboardType="decimal-pad" />
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleAddDebt} disabled={saving}>
              <Text style={{ color: "white", fontSize: 16, fontWeight: "800" }}>{saving ? "Saving..." : "Add Debt"}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  chartCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  insightCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  goalCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  addGoalBtn: {
    borderWidth: 2,
    borderColor: "#E5E5EA",
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 4,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F2F2F7",
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "white",
  },
  tabPillActive: {
    backgroundColor: P,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: DARK,
  },
  tabPillTextActive: {
    color: "white",
  },
  typePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: "white",
    alignItems: "center",
  },
  typePillText: {
    fontSize: 14,
    fontWeight: "700",
    color: DARK,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 99,
    backgroundColor: "#F2F2F7",
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: SUBTITLE,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    color: DARK,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  saveBtn: {
    backgroundColor: DARK,
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    marginTop: 24,
  },
});
