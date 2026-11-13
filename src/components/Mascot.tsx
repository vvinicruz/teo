import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme';

type Mood = 'feliz' | 'tranquilo' | 'pensativo';

/** a carinha do teo, em outline, como no moodboard. */
export function Mascot({ size = 64, mood = 'feliz', color = colors.primary }: { size?: number; mood?: Mood; color?: string }) {
  const mouth =
    mood === 'feliz'
      ? 'M22 36c2.6 3.4 6.1 5 10 5s7.4-1.6 10-5'
      : mood === 'tranquilo'
        ? 'M24 38c2.2 1.6 4.9 2.4 8 2.4s5.8-.8 8-2.4'
        : 'M25 39h14';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="28" stroke={color} strokeWidth={2.6} fill="none" />
      <Circle cx="24" cy="26" r="2.6" fill={color} />
      <Circle cx="40" cy="26" r="2.6" fill={color} />
      <Path d={mouth} stroke={color} strokeWidth={2.6} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
