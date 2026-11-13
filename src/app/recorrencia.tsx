import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  CategoryPicker,
  Chip,
  IconButton,
  Screen,
  Segmented,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addMonths, monthName, monthOf } from '../domain/dates';
import { recurrenceEnd } from '../domain/finance';
import { PAYMENT_METHODS, type Kind, type PaymentMethod } from '../domain/types';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { colors, space } from '../theme';

export default function RecorrenciaForm() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: Kind }>();
  const { data, addRecurrence, updateRecurrence, deleteRecurrence } = useData();
  const { forKind } = useCategories();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();
  const existing = id ? data.recurrences.find((r) => r.id === id) : undefined;

  const [kind, setKind] = useState<Kind>(existing?.kind ?? kindParam ?? 'despesa');
  const [amount, setAmount] = useState(existing?.amount ?? 0);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [day, setDay] = useState(String(existing?.dayOfMonth ?? Number(todayDate.slice(8))));
  const [startMonth, setStartMonth] = useState(existing?.startMonth ?? monthOf(todayDate));
  const [limited, setLimited] = useState(!!existing?.occurrences);
  const [count, setCount] = useState(String(existing?.occurrences ?? 12));
  const [payment, setPayment] = useState<PaymentMethod | null>(existing?.paymentMethod ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/recorrencias'));

  if (id && !existing) {
    return (
      <Screen back title="conta fixa">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa recorrência não existe mais.
        </Text>
      </Screen>
    );
  }

  const save = async () => {
    setError(null);
    const d = parseInt(day, 10);
    const n = parseInt(count, 10);
    if (amount <= 0) return setError('qual é o valor?');
    if (!description.trim()) return setError('dá um nome, tipo "aluguel" ou "salário".');
    if (!(d >= 1 && d <= 31)) return setError('o dia precisa ser entre 1 e 31.');
    if (limited && !(n >= 1 && n <= 120)) return setError('a quantidade precisa ser entre 1 e 120.');
    setSaving(true);
    const payload = {
      kind,
      amount,
      description: description.trim(),
      categoryId,
      paymentMethod: payment,
      dayOfMonth: d,
      startMonth,
      occurrences: limited ? n : null,
    };
    try {
      if (existing) await updateRecurrence({ ...existing, ...payload });
      else await addRecurrence(payload);
      toast(existing ? 'prontinho, previsões atualizadas.' : 'prontinho! já está no seu horizonte.');
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: `parar "${existing.description}"?`,
      message: 'as próximas previsões somem do horizonte. o que você já registrou continua no extrato.',
      confirmLabel: 'parar de repetir',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRecurrence(existing.id);
      toast('combinado, não vai mais se repetir.', 'info');
      close();
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const months = [-1, 0, 1, 2].map((d) => addMonths(monthOf(todayDate), d));
  if (!months.includes(startMonth)) months.unshift(startMonth);
  const preview = limited
    ? recurrenceEnd({
        ...(existing ?? { id: '', skippedDates: [], createdAt: '' }),
        kind,
        amount,
        description,
        categoryId,
        paymentMethod: payment,
        dayOfMonth: parseInt(day, 10) || 1,
        startMonth,
        occurrences: parseInt(count, 10) || 1,
      })
    : null;

  return (
    <Screen
      title={existing ? 'editar conta fixa' : 'nova conta fixa'}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label="salvar" onPress={save} loading={saving} />}
    >
      <Segmented<Kind>
        value={kind}
        onChange={(k) => {
          setKind(k);
          setCategoryId(null);
        }}
        options={[
          { value: 'despesa', label: 'despesa', color: colors.primary },
          { value: 'receita', label: 'receita', color: colors.income },
        ]}
      />
      <View style={{ marginVertical: space.xl }}>
        <AmountInput value={amount} onChange={setAmount} color={kind === 'receita' ? colors.income : colors.text} autoFocus={!existing} />
        {error ? (
          <Text variant="small" color={colors.danger} center>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: space.xl }}>
        <TextField
          label="nome"
          value={description}
          onChangeText={setDescription}
          placeholder={kind === 'receita' ? 'ex.: salário' : 'ex.: aluguel, internet, academia'}
          maxLength={80}
        />

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            categoria
          </Text>
          <CategoryPicker categories={forKind(kind)} value={categoryId} onChange={setCategoryId} income={kind === 'receita'} />
        </View>

        <TextField
          label="todo dia"
          value={day}
          onChangeText={(t) => setDay(t.replace(/\D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          inputMode="numeric"
          hint="se o mês não tiver esse dia (ex.: 31), usamos o último dia do mês."
        />

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            começa em
          </Text>
          <View style={styles.wrap}>
            {months.map((m) => (
              <Chip key={m} label={monthName(m)} selected={startMonth === m} onPress={() => setStartMonth(m)} />
            ))}
          </View>
        </View>

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            até quando?
          </Text>
          <View style={styles.wrap}>
            <Chip label="sem data para acabar" selected={!limited} onPress={() => setLimited(false)} />
            <Chip label="um número de vezes" selected={limited} onPress={() => setLimited(true)} />
          </View>
          {limited ? (
            <TextField
              value={count}
              onChangeText={(t) => setCount(t.replace(/\D/g, '').slice(0, 3))}
              keyboardType="number-pad"
              inputMode="numeric"
              hint={preview ? `última vez em ${monthName(monthOf(preview), true)}.` : undefined}
            />
          ) : null}
        </View>

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            forma de pagamento <Text variant="small" color={colors.textFaint}>(opcional)</Text>
          </Text>
          <View style={styles.wrap}>
            {PAYMENT_METHODS.map((p) => (
              <Chip key={p.id} label={p.label} selected={payment === p.id} onPress={() => setPayment(payment === p.id ? null : p.id)} />
            ))}
          </View>
        </View>

        {existing ? (
          <>
            <Text variant="small" color={colors.textFaint}>
              mudanças valem para as previsões que ainda não foram confirmadas. o que já foi registrado não muda.
            </Text>
            <Button label="parar de repetir" icon={Trash2} variant="danger" onPress={remove} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
