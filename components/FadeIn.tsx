import { ReactNode, useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  from?: "bottom" | "top" | "left" | "right" | "none";
  distance?: number;
  style?: ViewStyle;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 400,
  from = "bottom",
  distance = 20,
  style,
}: FadeInProps) {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(from === "left" ? -distance : from === "right" ? distance : 0);
  const translateY = useSharedValue(from === "bottom" ? distance : from === "top" ? -distance : 0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    translateX.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(0, { duration, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}
