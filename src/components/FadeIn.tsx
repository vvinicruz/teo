import { nativeDriver } from '../lib/platform';
import { useEffect, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

/** entrada suave (fade + leve subida). */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 320, delay, useNativeDriver: nativeDriver }).start();
  }, [v, delay]);
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}
