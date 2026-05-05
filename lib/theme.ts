import { Dimensions } from "react-native";

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const colors = {
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  surface2: "#E5E5EA",
  text: "#1C1C1E",
  text2: "#8E8E93",
  text3: "#C7C7CC",
  accent: "#1C1C1E",
  green: "#34C759",
  red: "#FF3B30",
  orange: "#F5A623",
  blue: "#007AFF",
  purple: "#764ba2",
  gradient1: "#667eea",
  gradient2: "#764ba2",
  border: "#E5E5EA",
};

export const darkColors = {
  bg: "#000000",
  surface: "#1C1C1E",
  surface2: "#2C2C2E",
  text: "#FFFFFF",
  text2: "#8E8E93",
  text3: "#48484A",
  accent: "#FFFFFF",
  green: "#30D158",
  red: "#FF453A",
  orange: "#FF9F0A",
  blue: "#0A84FF",
  purple: "#BF5AF2",
  gradient1: "#667eea",
  gradient2: "#764ba2",
  border: "#38383A",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 99,
};

export const fonts = {
  regular: { fontWeight: "400" as const },
  medium: { fontWeight: "500" as const },
  semibold: { fontWeight: "600" as const },
  bold: { fontWeight: "700" as const },
  heavy: { fontWeight: "800" as const },
  black: { fontWeight: "900" as const },
};
