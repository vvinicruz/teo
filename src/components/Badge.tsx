import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { Text } from './Text';

type Tone = 'prevista' | 'pendente' | 'atencao' | 'ok' | 'neutro';

const tones: Record<Tone, { bg: string; fg: string }> = {
  prevista: { bg: colors.muted, fg: colors.textSoft },
  pendente: { bg: colors.cream, fg: colors.primary },
  atencao: { bg: colors.attentionSoft, fg: colors.attention },
  ok: { bg: colors.incomeSoft, fg: colors.income },
  neutro: { bg: colors.muted, fg: colors.text },
};

export function Badge({ label, tone = 'neutro' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.base, { backgroundColor: t.bg }]}>
      <Text variant="caption" color={t.fg}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
});
