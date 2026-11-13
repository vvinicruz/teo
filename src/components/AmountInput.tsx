import { useRef } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';
import { centsFromDigits, formatMoney } from '../domain/money';
import { colors, fonts, space } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Props {
  value: number;
  onChange: (cents: number) => void;
  color?: string;
  autoFocus?: boolean;
  label?: string;
  size?: 'large' | 'medium';
}

/**
 * campo de valor no estilo "caixa registradora": cada dígito entra pela direita.
 * digitar 1 2 5 0 vira R$ 12,50. é o jeito mais rápido no teclado numérico.
 */
export function AmountInput({ value, onChange, color = colors.text, autoFocus, label, size = 'large' }: Props) {
  const ref = useRef<TextInputInstance>(null);
  const formatted = formatMoney(value);
  const big = size === 'large';
  return (
    <Pressable onPress={() => ref.current?.focus()} scaleTo={1} accessibilityLabel={label ?? 'valor'}>
      <View style={styles.wrap}>
        {label ? (
          <Text variant="smallStrong" color={colors.textSoft} center>
            {label}
          </Text>
        ) : null}
        <Text
          style={[
            big ? styles.big : styles.medium,
            { color: value === 0 ? colors.textFaint : color },
          ]}
          center
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatted}
        </Text>
        <TextInput
          ref={ref}
          value={String(value || '')}
          onChangeText={(t) => onChange(centsFromDigits(t))}
          keyboardType="number-pad"
          inputMode="numeric"
          autoFocus={autoFocus}
          caretHidden
          style={styles.hidden}
          accessibilityLabel={label ?? 'valor'}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  big: { fontFamily: fonts.semibold, fontSize: 44, lineHeight: 54, letterSpacing: -1 },
  medium: { fontFamily: fonts.semibold, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  // o input fica invisível sobre o valor, para receber o teclado e o foco.
  hidden: {
    position: 'absolute',
    inset: 0,
    opacity: Platform.OS === 'web' ? 0 : 0.011,
    color: 'transparent',
    fontSize: 1,
  } as never,
});
