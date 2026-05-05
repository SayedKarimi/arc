// Safe AsyncStorage wrapper — falls back to in-memory if native module unavailable (Expo Go)
let storage: { getItem: (k: string) => Promise<string | null>; setItem: (k: string, v: string) => Promise<void> };

try {
  const AS = require("@react-native-async-storage/async-storage").default;
  // Test if native module is available
  if (AS) {
    storage = AS;
  } else {
    throw new Error("null");
  }
} catch {
  // Fallback: in-memory storage for Expo Go
  const mem: Record<string, string> = {};
  storage = {
    getItem: async (k: string) => mem[k] ?? null,
    setItem: async (k: string, v: string) => { mem[k] = v; },
  };
}

export default storage;
