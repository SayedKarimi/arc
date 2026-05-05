import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { colors as lightColors, darkColors } from "./theme";

type ThemeColors = typeof lightColors;
type ThemeMode = "light" | "dark" | "auto";

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: lightColors,
  isDark: false,
  mode: "auto",
  setMode: () => {},
});

const THEME_KEY = "arc_theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("auto");

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then(v => {
      if (v === "light" || v === "dark") setModeState(v);
    }).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    if (m === "auto") {
      SecureStore.deleteItemAsync(THEME_KEY).catch(() => {});
    } else {
      SecureStore.setItemAsync(THEME_KEY, m).catch(() => {});
    }
  }, []);

  const isDark = mode === "auto" ? scheme === "dark" : mode === "dark";
  const themeColors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors: themeColors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useColors() {
  return useContext(ThemeContext).colors;
}
