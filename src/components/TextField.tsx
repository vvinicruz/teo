import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const TextField = forwardRef<TextInputInstance, Props>(function TextField(
  { label, error, hint, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="smallStrong" color={colors.textSoft}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.errored : null,
          style,
        ]}
      />
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.textFaint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    height: 52,
    outlineStyle: 'none' as never,
  },
  focused: { borderColor: colors.primary },
  errored: { borderColor: colors.danger },
});
