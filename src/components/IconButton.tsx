import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';

interface Props {
  icon: LucideIcon;
  onPress?: () => void;
  label: string;
  color?: string;
  background?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, onPress, label, color = colors.text, background = 'transparent', size = 22, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      scaleTo={0.9}
      style={[styles.base, { backgroundColor: background }, style]}
    >
      <Icon as={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
