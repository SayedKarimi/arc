import { useEffect } from "react";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface AnimatedRingProps {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor: string;
}

export function AnimatedRing({
  pct,
  size = 120,
  stroke = 12,
  color,
  trackColor,
}: AnimatedRingProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.min(Math.max(pct, 0), 1), {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDasharray: `${progress.value * circumference} ${circumference}`,
  }));

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
