import type { LucideIcon } from 'lucide-react-native';
import { colors } from '../theme';

export interface IconProps {
  as: LucideIcon;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** ícones sempre em outline, com traço arredondado. */
export function Icon({ as: Cmp, size = 22, color = colors.text, strokeWidth = 1.8 }: IconProps) {
  return <Cmp size={size} color={color} strokeWidth={strokeWidth} absoluteStrokeWidth />;
}
