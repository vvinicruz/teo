import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Props {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  /** algo antes do texto no lugar do ícone (ex.: a cor do banco). */
  leading?: ReactNode;
}

export function Chip({ label, selected, onPress, icon, leading }: Props) {
  const fg = selected ? colors.white : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.base, selected ? styles.on : styles.off]}
    >
      {leading ?? (icon && <Icon as={icon} size={16} color={fg} />)}
      <Text variant="smallStrong" color={fg}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.lg,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  on: { backgroundColor: colors.primary, borderColor: colors.primary },
  off: { backgroundColor: colors.surface, borderColor: colors.line },
});
