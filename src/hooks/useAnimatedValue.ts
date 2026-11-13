import { useState } from 'react';
import { Animated } from 'react-native';

/**
 * valor animado estável entre renderizações.
 * (o useAnimatedValue do react-native não existe no react-native-web.)
 */
export function useAnimatedValue(initial: number): Animated.Value {
  return useState(() => new Animated.Value(initial))[0];
}
