import { supabase } from "./client";
import { format } from "date-fns";

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not logged in");
  return user.id;
}

export async function getSettings(): Promise<any> {
  const userId = await getUserId();
  const { data } = await supabase.from("user_settings").select("*").eq("user_id", userId).single();
  return data || {};
}

export async function updateSettings(updates: any) {
  const userId = await getUserId();
  const current = await getSettings();
  await supabase.from("user_settings").upsert({ ...current, ...updates, user_id: userId });
}

export async function getNutritionForDate(date: string) {
  const userId = await getUserId();
  const { data } = await supabase
    .from("nutrition_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .order("timestamp", { ascending: false });
  return data || [];
}

export async function getNutritionTotals(date: string) {
  const entries = await getNutritionForDate(date);
  return entries.reduce(
    (acc: any, e: any) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      fiber: acc.fiber + (e.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  );
}

export async function getHydrationForDate(date: string): Promise<number> {
  const userId = await getUserId();
  const { data } = await supabase
    .from("hydration_entries")
    .select("amount")
    .eq("user_id", userId)
    .eq("date", date);
  return (data || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
}

export async function addHydrationEntry(amount: number) {
  const userId = await getUserId();
  const date = format(new Date(), "yyyy-MM-dd");
  await supabase.from("hydration_entries").insert({
    id: Math.random().toString(36).slice(2),
    user_id: userId,
    date,
    amount,
    timestamp: Date.now(),
  });
}

export async function getStepsForDate(date: string): Promise<number> {
  const userId = await getUserId();
  const { data } = await supabase
    .from("step_entries")
    .select("count")
    .eq("user_id", userId)
    .eq("date", date)
    .single();
  return data?.count || 0;
}

export async function getCurrentStreak(): Promise<number> {
  const userId = await getUserId();
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 60; i++) {
    const dateStr = format(d, "yyyy-MM-dd");
    const { data } = await supabase
      .from("nutrition_entries")
      .select("id")
      .eq("user_id", userId)
      .eq("date", dateStr)
      .limit(1);
    if (data && data.length > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
  }
  return streak;
}

export async function addNutritionEntry(entry: any) {
  const userId = await getUserId();
  await supabase.from("nutrition_entries").insert({ ...entry, user_id: userId });
}

export async function getSleepForDate(date: string): Promise<{ duration: number; quality: number } | null> {
  const userId = await getUserId();
  const { data } = await supabase
    .from("sleep_entries")
    .select("duration,quality")
    .eq("user_id", userId)
    .eq("date", date)
    .single();
  return data || null;
}

export async function getAiMemory(): Promise<string[]> {
  const userId = await getUserId();
  const { data } = await supabase
    .from("ai_memory")
    .select("facts")
    .eq("user_id", userId)
    .single();
  return data?.facts || [];
}

export async function getNutritionHistory(days: number): Promise<any[]> {
  const userId = await getUserId();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const { data } = await supabase
    .from("nutrition_entries")
    .select("date,calories,protein,carbs,fat")
    .eq("user_id", userId)
    .gte("date", format(startDate, "yyyy-MM-dd"))
    .order("date", { ascending: true });
  return data || [];
}
