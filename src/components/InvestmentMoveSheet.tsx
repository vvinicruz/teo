import { useState } from 'react';
import { View } from 'react-native';
import { useData } from '../data/DataProvider';
import { addDays } from '../domain/dates';
import { investmentBalance } from '../domain/investments';
import { formatMoney } from '../domain/money';
import type { Investment } from '../domain/types';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';
import { AmountInput } from './AmountInput';
import { Button } from './Button';
import { Chip } from './Chip';
import { useFeedback } from './Feedback';
import { Segmented } from './Segmented';
import { Sheet } from './Sheet';
import { Text } from './Text';

type Move = 'guardar' | 'resgatar';

interface Props {
  investment: Investment | null;
  initial?: Move;
  onClose: () => void;
  /** texto para o "obrigado" (ex.: nome da meta). */
  goalName?: string;
}

/** guardar dinheiro numa caixinha (sai da conta) ou resgatar (volta para a conta). */
export function InvestmentMoveSheet({ investment, initial = 'guardar', onClose, goalName }: Props) {
  const { data, moveInvestment } = useData();
  const { toast } = useFeedback();
  const todayDate = useToday();
  const [move, setMove] = useState<Move>(initial);
  const [amount, setAmount] = useState(0);
  const [yesterday, setYesterday] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // reinicia o formulário sempre que abrir para uma caixinha.
  const key = investment ? `${investment.id}:${initial}` : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setMove(initial);
    setAmount(0);
    setYesterday(false);
  }

  const current = investment ? investmentBalance(data, investment) : 0;
  const tooMuch = move === 'resgatar' && amount > current;

  const save = async () => {
    if (!investment || amount <= 0 || tooMuch) return;
    setSaving(true);
    try {
      await moveInvestment(investment, move, amount, yesterday ? addDays(todayDate, -1) : todayDate);
      toast(
        move === 'guardar'
          ? goalName
            ? `mais um passo rumo a "${goalName}"!`
            : 'guardado! cada real conta :)'
          : 'resgate registrado. o valor voltou para a conta.',
      );
      onClose();
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={!!investment} onClose={onClose} title={investment?.name}>
      <View style={{ gap: space.lg }}>
        <Segmented<Move>
          value={move}
          onChange={setMove}
          options={[
            { value: 'guardar', label: 'guardar' },
            { value: 'resgatar', label: 'resgatar' },
          ]}
        />
        <AmountInput value={amount} onChange={setAmount} autoFocus color={move === 'guardar' ? colors.primary : colors.text} />
        <Text variant="small" color={tooMuch ? colors.danger : colors.textSoft} center>
          {tooMuch
            ? `a caixinha tem ${formatMoney(current)}. não dá para resgatar mais que isso.`
            : move === 'guardar'
              ? 'o valor sai do saldo da sua conta e vai para a caixinha.'
              : 'o valor sai da caixinha e volta para o saldo da sua conta.'}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
          <Chip label="hoje" selected={!yesterday} onPress={() => setYesterday(false)} />
          <Chip label="ontem" selected={yesterday} onPress={() => setYesterday(true)} />
        </View>
        <Button
          label={move === 'guardar' ? 'guardar' : 'resgatar'}
          onPress={save}
          loading={saving}
          disabled={amount <= 0 || tooMuch}
        />
      </View>
    </Sheet>
  );
}
