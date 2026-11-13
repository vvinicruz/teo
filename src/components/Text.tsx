import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type as typeScale, type TypeVariant } from '../theme';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: string;
  center?: boolean;
}

/** texto padrão do teo. lembre: toda comunicação do app é em letras minúsculas. */
export function Text({ variant = 'body', color = colors.text, center, style, ...rest }: TextProps) {
  return (
    <RNText
      {...rest}
      style={[typeScale[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  );
}
