import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Props {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}

export function Section({ title, actionLabel, onAction, children }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="heading">{title}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
            <Text variant="smallStrong" color={colors.primary}>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginTop: space.xxl },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
