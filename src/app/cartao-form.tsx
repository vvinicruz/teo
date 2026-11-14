import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AmountInput, Button, Card, IconButton, Screen, Text, TextField, useFeedback } from '../components';
import { useData } from '../data/DataProvider';
import { monthOf, shortDate } from '../domain/dates';
import { invoiceOf } from '../domain/finance';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

const dayOk = (v: string) => {
  const n = parseInt(v, 10);
  return n >= 1 && n <= 31 ? n : null;
};

export default function CartaoForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addCard, updateCard, deleteCard } = useData();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();
  const existing = id ? data.cards.find((c) => c.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [closing, setClosing] = useState(existing ? String(existing.closingDay) : '');
  const [due, setDue] = useState(existing ? String(existing.dueDay) : '');
  const [limit, setLimit] = useState(existing?.creditLimit ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/cartoes'));

  if (id && !existing) {
    return (
      <Screen back title="cartão">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          esse cartão não existe mais.
        </Text>
      </Screen>
    );
  }

  const closingDay = dayOk(closing);
  const dueDay = dayOk(due);
  const preview =
    closingDay && dueDay
      ? invoiceOf({ id: '', name, closingDay, dueDay, creditLimit: null, createdAt: '' }, todayDate)
      : null;

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('dá um nome para o cartão, tipo "nubank" ou "itaú".');
    if (!closingDay) return setError('o dia de fechamento precisa ser entre 1 e 31.');
    if (!dueDay) return setError('o dia de vencimento precisa ser entre 1 e 31.');
    setSaving(true);
    const payload = { name: name.trim().toLowerCase(), closingDay, dueDay, creditLimit: limit > 0 ? limit : null };
    try {
      if (existing) await updateCard({ ...existing, ...payload });
      else await addCard(payload);
      toast(existing ? 'cartão atualizado.' : 'cartão cadastrado! as faturas já aparecem no horizonte.');
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `apagar o cartão ${existing.name}?`,
      message: 'se ele já tiver compras, vamos só escondê-lo para não perder seu histórico.',
      confirmLabel: 'apagar cartão',
      danger: true,
    });
    if (!ok) return;
    try {
      const r = await deleteCard(existing.id);
      toast(r === 'arquivado' ? 'cartão escondido. o histórico continua.' : 'cartão apagado.', 'info');
      router.replace('/cartoes');
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      title={existing ? 'editar cartão' : 'novo cartão'}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label="salvar cartão" onPress={save} loading={saving} />}
    >
      <View style={{ gap: space.xl, marginTop: space.md }}>
        <TextField label="nome do cartão" value={name} onChangeText={setName} placeholder="ex.: nubank, itaú, inter" maxLength={40} autoFocus={!existing} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TextField
              label="fecha todo dia"
              value={closing}
              onChangeText={(t) => setClosing(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="ex.: 3"
            />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              label="vence todo dia"
              value={due}
              onChangeText={(t) => setDue(t.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              inputMode="numeric"
              placeholder="ex.: 10"
            />
          </View>
        </View>
        <Text variant="small" color={colors.textFaint}>
          os dois dias aparecem no app do banco, na fatura. compras depois do fechamento vão para a fatura seguinte.
        </Text>

        {preview ? (
          <Card tone="cream" style={{ padding: space.lg }}>
            <Text variant="small" color={colors.textSoft}>
              uma compra feita hoje entra na fatura que fecha em {shortDate(preview.closingDate)} e vence em{' '}
              <Text variant="smallStrong">{shortDate(preview.dueDate)}</Text>
              {monthOf(preview.dueDate) !== monthOf(todayDate) ? ' (mês que vem)' : ''}.
            </Text>
          </Card>
        ) : null}

        <AmountInput value={limit} onChange={setLimit} label="limite (opcional)" size="medium" />

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {existing ? <Button label="apagar cartão" icon={Trash2} variant="danger" onPress={remove} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
});
