import { router, useLocalSearchParams } from 'expo-router';
import { ChevronDown, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AmountInput, Button, Card, Chip, Icon, IconButton, Pressable, Screen, Sheet, Text, TextField, useFeedback } from '../components';
import { BANKS } from '../domain/banks';
import { formatRate } from '../domain/interest';
import { useCardRates } from '../hooks/useCardRates';
import { periodLabel, rateFor } from '../lib/bcbRates';
import { useData } from '../data/DataProvider';
import { monthOf, shortDate } from '../domain/dates';
import { invoiceOf } from '../domain/finance';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

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
  const [bankCode, setBankCode] = useState<string | null>(existing?.bankCode ?? null);
  const [bankOpen, setBankOpen] = useState(false);
  // taxa digitada pela pessoa (da fatura). vazio = usamos a média do banco no banco central.
  const [rateText, setRateText] = useState(
    existing?.revolvingRateSource === 'fatura' && existing.revolvingRate != null
      ? String(existing.revolvingRate).replace('.', ',')
      : '',
  );
  const rates = useCardRates();
  const bank = BANKS.find((b) => b.code === bankCode);
  const bcbRate = rates ? rateFor(rates, bankCode, 'rotativo') : null;
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
    const typedRate = rateText.trim() ? Number(rateText.replace(',', '.')) : null;
    if (typedRate !== null && !(typedRate >= 0 && typedRate <= 50)) {
      setSaving(false);
      return setError('a taxa precisa ser um número entre 0 e 50 (% ao mês).');
    }
    const payload = {
      name: name.trim().toLowerCase(),
      closingDay,
      dueDay,
      creditLimit: limit > 0 ? limit : null,
      bankCode,
      bankName: bank?.name ?? null,
      revolvingRate: typedRate ?? bcbRate?.monthly ?? existing?.revolvingRate ?? null,
      revolvingRateSource: typedRate !== null ? ('fatura' as const) : bcbRate ? ('bcb' as const) : (existing?.revolvingRateSource ?? null),
    };
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

        <View style={{ gap: space.sm }}>
          <Text variant="smallStrong" color={colors.textSoft}>
            banco do cartão
          </Text>
          <Pressable onPress={() => setBankOpen(true)} style={styles.select} accessibilityRole="button" accessibilityLabel="escolher banco">
            <Text color={bank ? colors.text : colors.textFaint} style={{ flex: 1 }}>
              {bank?.name ?? 'escolher banco'}
            </Text>
            <Icon as={ChevronDown} size={18} color={colors.textFaint} />
          </Pressable>
          <Text variant="small" color={colors.textFaint}>
            usamos para estimar os juros se um dia a fatura não for paga inteira.
          </Text>
        </View>

        <TextField
          label="juros do rotativo (% ao mês, opcional)"
          value={rateText}
          onChangeText={(t) => setRateText(t.replace(/[^\d,.]/g, '').slice(0, 5))}
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder={bcbRate ? formatRate(bcbRate.monthly).replace('%', '') : 'ex.: 13,5'}
          hint={
            bcbRate && rates
              ? `está na sua fatura, como "juros do rotativo". se deixar vazio, usamos ${formatRate(bcbRate.monthly)} ao mês: a média ${bcbRate.isMarketAverage ? 'dos bancos' : `do ${bank?.name}`} no banco central (${periodLabel(rates)}).`
              : rates === undefined && bankCode
                ? 'buscando a média do seu banco no banco central…'
                : 'está na sua fatura, como "juros do rotativo".'
          }
        />

        <AmountInput value={limit} onChange={setLimit} label="limite (opcional)" size="medium" />

        {error ? (
          <Text variant="small" color={colors.danger}>
            {error}
          </Text>
        ) : null}

        {existing ? <Button label="apagar cartão" icon={Trash2} variant="danger" onPress={remove} /> : null}
      </View>

      <Sheet visible={bankOpen} onClose={() => setBankOpen(false)} title="qual é o banco do cartão?">
        <View style={styles.banks}>
          {BANKS.map((b) => (
            <Chip
              key={b.code}
              label={b.name}
              selected={bankCode === b.code}
              onPress={() => {
                setBankCode(b.code);
                if (!name.trim()) setName(b.name);
                setBankOpen(false);
              }}
            />
          ))}
          <Chip
            label="outro banco"
            selected={bankCode === null}
            onPress={() => {
              setBankCode(null);
              setBankOpen(false);
            }}
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  banks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
