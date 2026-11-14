import { X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { Goal } from '../domain/types';
import { colors, space } from '../theme';
import { Button } from './Button';
import { Card } from './Card';
import { IconButton } from './IconButton';
import { Mascot } from './Mascot';
import { Text } from './Text';

/** lembrete gentil, sem cobrança, para quem está há um tempo sem guardar para a meta. */
export function GoalNudgeCard({ goal, days, onSave, onDismiss }: { goal: Goal; days: number; onSave: () => void; onDismiss: () => void }) {
  const weeks = Math.floor(days / 7);
  const when = days >= 60 ? `${Math.floor(days / 30)} meses` : `${weeks} semanas`;
  return (
    <Card tone="cream" style={styles.card}>
      <View style={styles.head}>
        <Mascot size={40} mood="tranquilo" />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">e a “{goal.name}”?</Text>
          <Text variant="small" color={colors.textSoft}>
            faz {when} que ela não recebe nada. que tal guardar um pouquinho hoje? qualquer valor já conta.
          </Text>
        </View>
        <IconButton icon={X} label="dispensar lembrete" onPress={onDismiss} size={18} color={colors.textFaint} />
      </View>
      <Button label="guardar agora" small onPress={onSave} style={{ alignSelf: 'flex-start' }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.md, padding: space.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
});
