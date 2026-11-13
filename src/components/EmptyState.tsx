import { StyleSheet, View } from 'react-native';
import { colors, space } from '../theme';
import { Button } from './Button';
import { Mascot } from './Mascot';
import { Text } from './Text';

interface Props {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function EmptyState({ title, message, actionLabel, onAction, compact }: Props) {
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <Mascot size={compact ? 44 : 64} mood="tranquilo" />
      <Text variant={compact ? 'bodyStrong' : 'heading'} center>
        {title}
      </Text>
      {message ? (
        <Text variant="small" color={colors.textSoft} center style={styles.msg}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" small style={{ marginTop: space.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.xl },
  compact: { paddingVertical: space.xl },
  msg: { maxWidth: 300 },
});
