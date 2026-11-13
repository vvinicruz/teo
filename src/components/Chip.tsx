import type { LucideIcon } from 'lucide-react-native';
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
}

export function Chip({ label, selected, onPress, icon }: Props) {
  const fg = selected ? colors.white : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.base, selected ? styles.on : styles.off]}
    >
      {icon && <Icon as={icon} size={16} color={fg} />}
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
