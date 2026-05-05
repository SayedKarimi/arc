import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./supabase/client";

const CACHE_PREFIX = "arc_cache_";
const PENDING_PREFIX = "arc_pending_";

// Simple key-value cache using SecureStore
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (expiry && Date.now() > expiry) {
      await SecureStore.deleteItemAsync(CACHE_PREFIX + key);
      return null;
    }
    return data as T;
  } catch {
    return null;
  }
}

export async function setCache(key: string, data: any, ttlMs: number = 5 * 60 * 1000) {
  try {
    await SecureStore.setItemAsync(
      CACHE_PREFIX + key,
      JSON.stringify({ data, expiry: Date.now() + ttlMs })
    );
  } catch {
    // SecureStore has a 2048 byte limit per key, fall back silently
  }
}

export async function clearCache(key: string) {
  await SecureStore.deleteItemAsync(CACHE_PREFIX + key);
}

// Offline queue for mutations
interface PendingMutation {
  id: string;
  table: string;
  operation: "insert" | "update" | "delete";
  data: any;
  filter?: any;
  createdAt: number;
}

let pendingQueue: PendingMutation[] = [];

export async function loadPendingQueue() {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_PREFIX + "queue");
    pendingQueue = raw ? JSON.parse(raw) : [];
  } catch {
    pendingQueue = [];
  }
}

async function savePendingQueue() {
  await SecureStore.setItemAsync(PENDING_PREFIX + "queue", JSON.stringify(pendingQueue));
}

export async function queueMutation(mutation: Omit<PendingMutation, "id" | "createdAt">) {
  const entry: PendingMutation = {
    ...mutation,
    id: Math.random().toString(36).slice(2),
    createdAt: Date.now(),
  };
  pendingQueue.push(entry);
  await savePendingQueue();
}

export async function flushPendingMutations() {
  if (pendingQueue.length === 0) return;

  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const failed: PendingMutation[] = [];

  for (const mutation of pendingQueue) {
    try {
      if (mutation.operation === "insert") {
        await supabase.from(mutation.table).insert(mutation.data);
      } else if (mutation.operation === "update") {
        let query = supabase.from(mutation.table).update(mutation.data);
        if (mutation.filter) {
          for (const [key, value] of Object.entries(mutation.filter)) {
            query = query.eq(key, value);
          }
        }
        await query;
      } else if (mutation.operation === "delete") {
        let query = supabase.from(mutation.table).delete();
        if (mutation.filter) {
          for (const [key, value] of Object.entries(mutation.filter)) {
            query = query.eq(key, value);
          }
        }
        await query;
      }
    } catch {
      failed.push(mutation);
    }
  }

  pendingQueue = failed;
  await savePendingQueue();
}

// Optimistic mutation helper
export async function optimisticInsert(
  table: string,
  data: any,
  onOptimistic: (data: any) => void,
  onError?: (error: any) => void
) {
  // Apply optimistically
  onOptimistic(data);

  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    // Queue for later
    await queueMutation({ table, operation: "insert", data });
    return;
  }

  try {
    const { error } = await supabase.from(table).insert(data);
    if (error) throw error;
  } catch (e) {
    // Queue for retry
    await queueMutation({ table, operation: "insert", data });
    onError?.(e);
  }
}

// Network listener to flush queue when back online
let unsubscribeNetInfo: (() => void) | null = null;

export function startOfflineSync() {
  loadPendingQueue();
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      flushPendingMutations();
    }
  });
}

export function stopOfflineSync() {
  unsubscribeNetInfo?.();
}
