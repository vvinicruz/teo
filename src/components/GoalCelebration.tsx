import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useData } from '../data/DataProvider';
import { goalProgress } from '../domain/finance';
import { milestoneFor } from '../domain/goals';
import { goalSaved } from '../domain/investments';
import { formatMoney } from '../domain/money';
import type { Goal, Snapshot } from '../domain/types';
import { colors, space } from '../theme';
import { Button } from './Button';
import { Mascot } from './Mascot';
import { ProgressBar } from './ProgressBar';
import { Sheet } from './Sheet';
import { Text } from './Text';

const MESSAGES: Record<number, { title: string; body: string }> = {
  25: { title: 'um quarto do caminho!', body: 'o primeiro passo é o mais difícil, e você já deu. continua assim :)' },
  50: { title: 'metade do caminho!', body: 'olha só onde você chegou. daqui pra frente é ladeira abaixo.' },
  75: { title: 'falta pouquinho!', body: 'três quartos já estão guardados. a reta final é sua.' },
  100: { title: 'meta concluída!', body: 'você conseguiu. que orgulho! tudo em ordem :)' },
};

type Pending = { goal: Goal; milestone: number; key: string };

/** primeiro marco ainda não comemorado. */
function findPending(data: Snapshot, ready: boolean): Pending | null {
  if (!ready) return null;
  for (const goal of data.goals) {
    if (goal.lastMilestone == null) continue;
    const milestone = milestoneFor(goalProgress(goalSaved(data, goal), goal.target));
    if (milestone > goal.lastMilestone) return { goal, milestone, key: `${goal.id}:${milestone}` };
  }
  return null;
}

/**
 * comemora quando uma meta passa de 25%, 50%, 75% ou 100%. cada marco aparece uma vez só:
 * o marco é gravado quando a pessoa fecha a mensagem.
 */
export function GoalCelebration() {
  const { data, status, updateGoal } = useData();
  const initializing = useRef(false);

  // primeiro marco ainda não comemorado (calculado direto dos dados).
  const pending = findPending(data, status === 'ready');

  // metas que ainda não eram acompanhadas começam no marco atual, sem festa retroativa.
  useEffect(() => {
    if (status !== 'ready' || initializing.current) return;
    const goal = data.goals.find((g) => g.lastMilestone == null);
    if (!goal) return;
    initializing.current = true;
    updateGoal({ ...goal, lastMilestone: milestoneFor(goalProgress(goalSaved(data, goal), goal.target)) })
      .catch(() => {})
      .finally(() => {
        initializing.current = false;
      });
  }, [data, status, updateGoal]);

  // mantém o conteúdo na tela durante a animação de fechar.
  const [showing, setShowing] = useState<Pending | null>(null);
  if (pending && pending.key !== showing?.key) setShowing(pending);

  const close = () => {
    if (pending) updateGoal({ ...pending.goal, lastMilestone: pending.milestone }).catch(() => {});
  };

  const msg = showing ? MESSAGES[showing.milestone] : null;
  const saved = showing ? goalSaved(data, showing.goal) : 0;

  return (
    <Sheet visible={!!pending} onClose={close}>
      {showing && msg ? (
        <View style={{ alignItems: 'center', gap: space.md, paddingBottom: space.md }}>
          <Mascot size={88} mood="feliz" />
          <Text variant="title" center>
            {msg.title}
          </Text>
          <Text color={colors.textSoft} center style={{ maxWidth: 320 }}>
            “{showing.goal.name}” chegou a {showing.milestone}%. {msg.body}
          </Text>
          <View style={{ alignSelf: 'stretch', gap: 6, marginVertical: space.sm }}>
            <ProgressBar value={goalProgress(saved, showing.goal.target)} height={10} />
            <Text variant="small" color={colors.textSoft} center>
              {formatMoney(saved)} de {formatMoney(showing.goal.target)}
            </Text>
          </View>
          <Button label={showing.milestone === 100 ? 'comemorar :)' : 'continuar'} onPress={close} style={{ alignSelf: 'stretch' }} />
          <Button
            label="ver a meta"
            variant="ghost"
            onPress={() => {
              const id = showing.goal.id;
              close();
              router.push({ pathname: '/objetivo', params: { id } });
            }}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}
