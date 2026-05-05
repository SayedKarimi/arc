import { ReactNode } from "react";
import { Pressable, PressableProps, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends PressableProps {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  scaleDown?: number;
}

export function AnimatedPressable({
  children,
  style,
  scaleDown = 0.96,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressableBase
      {...props}
      style={[style, animatedStyle]}
      onPressIn={(e) => {
        scale.value = withSpring(scaleDown, { damping: 15, stiffness: 200 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressableBase>
  );
}
