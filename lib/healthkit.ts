import { Platform } from "react-native";
import { supabase } from "./supabase/client";
import { format } from "date-fns";

// react-native-health types
let AppleHealthKit: any = null;

// Lazy load - only works on iOS device
function getHealthKit() {
  if (!AppleHealthKit && Platform.OS === "ios") {
    try {
      AppleHealthKit = require("react-native-health").default;
    } catch (e) {
      console.log("HealthKit not available");
    }
  }
  return AppleHealthKit;
}

const permissions = {
  permissions: {
    read: [
      "StepCount",
      "ActiveEnergyBurned",
      "BasalEnergyBurned",
      "DistanceWalkingRunning",
      "HeartRate",
      "SleepAnalysis",
      "BodyMass",
      "Height",
    ],
    write: [
      "BodyMass",
      "ActiveEnergyBurned",
    ],
  },
};

export async function initHealthKit(): Promise<boolean> {
  const HK = getHealthKit();
  if (!HK) return false;

  return new Promise((resolve) => {
    HK.initHealthKit(permissions, (err: any) => {
      if (err) {
        console.log("HealthKit init error:", err);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

export async function getTodaySteps(): Promise<number> {
  const HK = getHealthKit();
  if (!HK) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Promise((resolve) => {
    HK.getStepCount(
      { date: today.toISOString() },
      (err: any, results: any) => {
        if (err) { resolve(0); return; }
        resolve(Math.round(results?.value || 0));
      }
    );
  });
}

export async function getTodayActiveCalories(): Promise<number> {
  const HK = getHealthKit();
  if (!HK) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Promise((resolve) => {
    HK.getActiveEnergyBurned(
      { startDate: today.toISOString(), endDate: new Date().toISOString() },
      (err: any, results: any) => {
        if (err) { resolve(0); return; }
        const total = (results || []).reduce((s: number, r: any) => s + (r.value || 0), 0);
        resolve(Math.round(total));
      }
    );
  });
}

export async function getTodayDistance(): Promise<number> {
  const HK = getHealthKit();
  if (!HK) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Promise((resolve) => {
    HK.getDistanceWalkingRunning(
      { date: today.toISOString(), includeManuallyAdded: true },
      (err: any, results: any) => {
        if (err) { resolve(0); return; }
        resolve(Math.round((results?.value || 0) * 100) / 100); // miles
      }
    );
  });
}

export async function getLatestWeight(): Promise<number | null> {
  const HK = getHealthKit();
  if (!HK) return null;

  return new Promise((resolve) => {
    HK.getLatestWeight({}, (err: any, results: any) => {
      if (err || !results) { resolve(null); return; }
      resolve(Math.round(results.value * 10) / 10); // lbs
    });
  });
}

export async function getHeartRateSamples(): Promise<{ value: number; date: string }[]> {
  const HK = getHealthKit();
  if (!HK) return [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return new Promise((resolve) => {
    HK.getHeartRateSamples(
      { startDate: today.toISOString(), endDate: new Date().toISOString(), ascending: false, limit: 10 },
      (err: any, results: any) => {
        if (err) { resolve([]); return; }
        resolve((results || []).map((r: any) => ({ value: Math.round(r.value), date: r.startDate })));
      }
    );
  });
}

export async function getSleepLastNight(): Promise<{ hours: number; minutes: number } | null> {
  const HK = getHealthKit();
  if (!HK) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(18, 0, 0, 0); // Start looking from 6pm yesterday

  return new Promise((resolve) => {
    HK.getSleepSamples(
      { startDate: yesterday.toISOString(), endDate: new Date().toISOString() },
      (err: any, results: any) => {
        if (err || !results || results.length === 0) { resolve(null); return; }
        // Sum ASLEEP samples
        const asleepMinutes = results
          .filter((r: any) => r.value === "ASLEEP" || r.value === "INBED")
          .reduce((total: number, r: any) => {
            const start = new Date(r.startDate).getTime();
            const end = new Date(r.endDate).getTime();
            return total + (end - start) / 60000;
          }, 0);
        resolve({
          hours: Math.floor(asleepMinutes / 60),
          minutes: Math.round(asleepMinutes % 60),
        });
      }
    );
  });
}

// Sync steps to Supabase
export async function syncHealthData() {
  const HK = getHealthKit();
  if (!HK) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = format(new Date(), "yyyy-MM-dd");

  // Sync steps
  const steps = await getTodaySteps();
  if (steps > 0) {
    await supabase.from("step_entries").upsert({
      user_id: user.id,
      date: today,
      count: steps,
      source: "healthkit",
    }, { onConflict: "user_id,date" });
  }

  // Sync weight if available
  const weight = await getLatestWeight();
  if (weight) {
    const { data: existing } = await supabase
      .from("body_weight_entries")
      .select("id")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (!existing) {
      await supabase.from("body_weight_entries").insert({
        id: Math.random().toString(36).slice(2),
        user_id: user.id,
        date: today,
        weight,
        unit: "lbs",
        source: "healthkit",
        timestamp: Date.now(),
      });
    }
  }
}
