import { nativeDriver } from '../lib/platform';
import {
  Animated,
  Pressable as RNPressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** quanto o elemento encolhe ao toque. */
  scaleTo?: number;
}

// propriedades que definem o "tamanho no layout" precisam ficar no elemento de fora,
// senão um item com flex: 1 não ocupa o espaço que deveria.
const OUTER_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'left',
  'right',
  'bottom',
] as const;

function splitStyle(style: StyleProp<ViewStyle>) {
  const flat = (StyleSheet.flatten(style) ?? {}) as Record<string, unknown>;
  const outer: Record<string, unknown> = {};
  const inner: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) {
    if ((OUTER_KEYS as readonly string[]).includes(k)) outer[k] = v;
    else inner[k] = v;
  }
  // se o item de fora ocupa espaço, o de dentro preenche tudo.
  if (outer.flex !== undefined || outer.width !== undefined || outer.flexGrow !== undefined) {
    inner.flexGrow = 1;
    if (outer.alignSelf === 'stretch' || outer.width !== undefined) inner.alignSelf = 'stretch';
  }
  return { outer: outer as ViewStyle, inner: inner as ViewStyle };
}

/** área tocável com um leve "afundar" ao toque — discreto, sem ripple. */
export function Pressable({ style, scaleTo = 0.97, children, disabled, ...rest }: Props) {
  const scale = useAnimatedValue(1);
  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: nativeDriver, speed: 40, bounciness: 0 }).start();
  const { outer, inner } = splitStyle(style);
  return (
    <RNPressable
      {...rest}
      style={outer}
      disabled={disabled}
      onPressIn={(e) => {
        to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      <Animated.View style={[inner, { transform: [{ scale }] }, disabled && { opacity: 0.45 }]}>
        {children as React.ReactNode}
      </Animated.View>
    </RNPressable>
  );
}
