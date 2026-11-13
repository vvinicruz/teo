import { useEffect } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { colors, radius } from '../theme';

export function ProgressBar({ value, color = colors.primary, height = 8 }: { value: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  const anim = useAnimatedValue(0);
  useEffect(() => {
    Animated.timing(anim, { toValue: clamped, duration: 500, useNativeDriver: false }).start();
  }, [clamped, anim]);
  return (
    <View style={[styles.track, { height }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.muted, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
