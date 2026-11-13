import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, shadow, space } from '../theme';
import { Pressable } from './Pressable';

interface Props extends ViewProps {
  onPress?: () => void;
  tone?: 'surface' | 'cream';
  padded?: boolean;
}

export function Card({ onPress, tone = 'surface', padded = true, style, children, ...rest }: Props) {
  const s = [
    styles.base,
    tone === 'cream' ? styles.cream : styles.surface,
    padded && styles.padded,
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={s} scaleTo={0.985}>
        {children}
      </Pressable>
    );
  }
  return (
    <View {...rest} style={s}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, ...shadow.card },
  cream: { backgroundColor: colors.cream },
  padded: { padding: space.xl },
});
