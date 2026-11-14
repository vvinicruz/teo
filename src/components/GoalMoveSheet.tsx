import { useState } from 'react';
import { View } from 'react-native';
import { useData } from '../data/DataProvider';
import { monthOf, today } from '../domain/dates';
import { formatMoney } from '../domain/money';
import type { Goal } from '../domain/types';
import { colors, space } from '../theme';
import { AmountInput } from './AmountInput';
import { Button } from './Button';
import { useFeedback } from './Feedback';
import { InvestmentMoveSheet } from './InvestmentMoveSheet';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Move = 'guardar' | 'retirar';

interface Props {
  goal: Goal | null;
  initial?: Move;
  onClose: () => void;
}

/**
 * guardar/retirar numa meta. se a meta está ligada a uma caixinha, o dinheiro vai de
 * verdade para a caixinha; senão, só registramos quanto foi separado.
 */
export function GoalMoveSheet({ goal, initial = 'guardar', onClose }: Props) {
  const { data, updateGoal } = useData();
  const { toast } = useFeedback();
  const [move, setMove] = useState<Move>(initial);
  const [value, setValue] = useState(0);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  const investment = goal?.investmentId ? data.investments.find((i) => i.id === goal.investmentId) : undefined;
  const key = goal && !investment ? `${goal.id}:${initial}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setMove(initial);
    setValue(0);
  }

  if (goal && investment) {
    return (
      <InvestmentMoveSheet
        investment={investment}
        initial={initial === 'retirar' ? 'resgatar' : 'guardar'}
        goalName={goal.name}
        onClose={onClose}
      />
    );
  }

  const save = async () => {
    if (!goal || value <= 0) return;
    const saved = move === 'guardar' ? goal.saved + value : Math.max(0, goal.saved - value);
    const month = monthOf(today());
    const months = goal.contributionMonths ?? [];
    setSaving(true);
    try {
      await updateGoal({
        ...goal,
        saved,
        ...(move === 'guardar'
          ? {
              lastContributionAt: new Date().toISOString(),
              contributionMonths: months.includes(month) ? months : [...months, month],
            }
          : {}),
      });
      toast(move === 'guardar' ? `mais um passo rumo a "${goal.name}"!` : 'valor retirado da meta.');
      onClose();
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!goal} onClose={onClose} title={goal?.name}>
      <View style={{ gap: space.lg }}>
        <Segmented<Move>
          value={move}
          onChange={setMove}
          options={[
            { value: 'guardar', label: 'guardar' },
            { value: 'retirar', label: 'retirar' },
          ]}
        />
        <AmountInput value={value} onChange={setValue} autoFocus color={move === 'guardar' ? colors.primary : colors.text} />
        {goal ? (
          <Text variant="small" color={colors.textSoft} center>
            hoje na meta: {formatMoney(goal.saved)}
          </Text>
        ) : null}
        <Button label={move === 'guardar' ? 'guardar valor' : 'retirar valor'} onPress={save} loading={saving} disabled={value <= 0} />
      </View>
    </Sheet>
  );
}
