import { router, useLocalSearchParams } from 'expo-router';
import { CalendarDays, CreditCard, FileUp, Repeat, SkipForward, Trash2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Button,
  Card,
  CategoryPicker,
  Chip,
  DatePickerSheet,
  DestinationPicker,
  Icon,
  IconButton,
  Pressable,
  Screen,
  Segmented,
  Text,
  TextField,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addDays, friendlyDate, monthOf, parseISODate, shortDate } from '../domain/dates';
import { invoiceOf } from '../domain/finance';
import { PAYMENT_METHODS, type Kind, type PaymentMethod, type Status } from '../domain/types';
import { useCategories } from '../hooks/useCategories';
import { useToday } from '../hooks/useToday';
import { colors, radius, space } from '../theme';

type Params = {
  id?: string;
  date?: string;
  kind?: Kind;
  recurrenceId?: string;
  occurrenceDate?: string;
  /** já abre como compra num cartão. */
  cardId?: string;
};

type RepeatMode = 'nao' | 'sempre' | 'parcelas';

export default function Movimentacao() {
  const params = useLocalSearchParams<Params>();
  const { data, addTransaction, updateTransaction, deleteTransaction, addRecurrence, skipOccurrence } = useData();
  const { forKind, get } = useCategories();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();

  const existing = params.id ? data.transactions.find((t) => t.id === params.id) : undefined;
  const recurrence = params.recurrenceId
    ? data.recurrences.find((r) => r.id === params.recurrenceId)
    : existing?.recurrenceId
      ? data.recurrences.find((r) => r.id === existing.recurrenceId)
      : undefined;
  const fromPrediction = !existing && !!recurrence && !!params.occurrenceDate;

  const initialDate =
    existing?.date ??
    (fromPrediction ? (params.occurrenceDate! <= todayDate ? params.occurrenceDate! : todayDate) : params.date) ??
    todayDate;

  const [kind, setKind] = useState<Kind>(existing?.kind ?? recurrence?.kind ?? params.kind ?? 'despesa');
  const [amount, setAmount] = useState(existing?.amount ?? (fromPrediction ? recurrence!.amount : 0));
  const [description, setDescription] = useState(existing?.description ?? (fromPrediction ? recurrence!.description : ''));
  const [categoryId, setCategoryId] = useState<string | null>(
    existing?.categoryId ?? (fromPrediction ? recurrence!.categoryId : null),
  );
  const [date, setDate] = useState(initialDate);
  const [status, setStatus] = useState<Status>(
    existing?.status ?? (initialDate > todayDate ? 'pendente' : 'realizada'),
  );
  const [cardId, setCardId] = useState<string | null>(
    existing ? (existing.cardId ?? null) : fromPrediction ? (recurrence!.cardId ?? null) : (params.cardId ?? null),
  );
  const [payment, setPayment] = useState<PaymentMethod | null>(
    existing?.paymentMethod ?? (fromPrediction ? recurrence!.paymentMethod : params.cardId ? 'credito' : null),
  );
  const [repeat, setRepeat] = useState<RepeatMode>('nao');
  const [installments, setInstallments] = useState('2');
  const [dateOpen, setDateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const list = forKind(kind);
    // mantém a categoria atual visível mesmo se tiver sido arquivada.
    const current = get(categoryId);
    return current && !list.includes(current) ? [current, ...list] : list;
  }, [forKind, kind, categoryId, get]);

  const future = date > todayDate;
  const isIncome = kind === 'receita';
  // pagamento de fatura: um lançamento especial, sem categoria nem cartão.
  const paidCard = existing?.paysCardId ? data.cards.find((c) => c.id === existing.paysCardId) : undefined;
  const isInvoicePayment = !!existing?.paysCardId;
  const card = cardId ? data.cards.find((c) => c.id === cardId) : undefined;
  const hasCards = data.cards.some((c) => !c.archived) || !!cardId;
  const accent = isIncome ? colors.income : colors.text;

  const title = existing ? 'editar movimentação' : fromPrediction ? 'confirmar previsão' : 'nova movimentação';

  if (params.id && !existing) {
    return (
      <Screen back title="movimentação">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          essa movimentação não existe mais.
        </Text>
      </Screen>
    );
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = async () => {
    setError(null);
    if (amount <= 0) return setError('qual é o valor?');
    const finalDescription = description.trim() || get(categoryId)?.name || (isIncome ? 'receita' : 'despesa');
    // compra no cartão já aconteceu: quem "paga" depois é a fatura.
    const finalStatus: Status = cardId ? 'realizada' : future ? 'pendente' : status;
    let parcelas: number | null = null;
    if (repeat === 'parcelas') {
      parcelas = parseInt(installments, 10);
      if (!(parcelas >= 2 && parcelas <= 120)) return setError('o número de parcelas precisa ser entre 2 e 120.');
    }
    setSaving(true);
    try {
      if (existing) {
        await updateTransaction({
          ...existing,
          kind,
          amount,
          description: finalDescription,
          categoryId,
          date,
          status: finalStatus,
          paymentMethod: payment,
          cardId: isInvoicePayment ? null : cardId,
        });
        toast('prontinho, alteração salva.');
      } else if (repeat !== 'nao') {
        // cria a recorrência; a ocorrência deste mês vira lançamento se já aconteceu.
        const rec = await addRecurrence({
          kind,
          amount,
          description: finalDescription,
          categoryId,
          paymentMethod: payment,
          dayOfMonth: parseISODate(date).day,
          startMonth: monthOf(date),
          occurrences: parcelas,
          cardId,
        });
        if (finalStatus === 'realizada') {
          await addTransaction({
            kind,
            amount,
            description: finalDescription,
            categoryId,
            date,
            status: 'realizada',
            paymentMethod: payment,
            recurrenceId: rec.id,
            occurrenceDate: date,
            cardId,
          });
        }
        toast(repeat === 'sempre' ? 'prontinho! vai se repetir todo mês.' : `prontinho! ${parcelas} parcelas no horizonte.`);
      } else {
        await addTransaction({
          kind,
          amount,
          description: finalDescription,
          categoryId,
          date,
          status: finalStatus,
          paymentMethod: payment,
          recurrenceId: fromPrediction ? recurrence!.id : null,
          occurrenceDate: fromPrediction ? params.occurrenceDate! : null,
          cardId,
        });
        toast(
          card
            ? `anotado! entra na fatura do ${card.name}.`
            : finalStatus === 'pendente'
            ? 'anotado! vai aparecer no seu horizonte.'
            : isIncome
              ? 'oba! receita registrada.'
              : 'prontinho, sua movimentação foi salva.',
        );
      }
      close();
    } catch {
      setSaving(false);
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirm({
      title: 'apagar esta movimentação?',
      message: existing.recurrenceId
        ? 'ela faz parte de uma conta fixa. a previsão deste mês volta a aparecer no horizonte.'
        : 'essa ação não pode ser desfeita.',
      confirmLabel: 'apagar',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteTransaction(existing.id);
      toast('movimentação apagada.', 'info');
      close();
    } catch {
      toast('não conseguimos apagar agora. tenta de novo?', 'erro');
    }
  };

  const skip = async () => {
    if (!recurrence || !params.occurrenceDate) return;
    const ok = await confirm({
      title: 'pular este mês?',
      message: `a previsão de "${recurrence.description}" em ${friendlyDate(params.occurrenceDate, todayDate)} sai do horizonte. os outros meses continuam iguais.`,
      confirmLabel: 'pular este mês',
    });
    if (!ok) return;
    try {
      await skipOccurrence(recurrence.id, params.occurrenceDate);
      toast('combinado, este mês fica de fora.', 'info');
      close();
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      title={title}
      right={<IconButton icon={X} label="fechar" onPress={close} background={colors.surface} />}
      footer={<Button label={existing ? 'salvar alterações' : fromPrediction ? (isIncome ? 'confirmar recebimento' : 'confirmar pagamento') : 'salvar'} onPress={save} loading={saving} />}
    >
      {!existing && !fromPrediction ? (
        <Segmented<Kind>
          value={kind}
          onChange={(k) => {
            setKind(k);
            if (categoryId && !forKind(k).some((c) => c.id === categoryId)) setCategoryId(null);
          }}
          options={[
            { value: 'despesa', label: 'despesa', color: colors.primary },
            { value: 'receita', label: 'receita', color: colors.income },
          ]}
        />
      ) : null}

      {!existing && !fromPrediction ? (
        <Pressable onPress={() => router.replace({ pathname: '/importar', params: cardId ? { cardId } : {} })} style={styles.importLink}>
          <Icon as={FileUp} size={16} color={colors.primary} />
          <Text variant="small" color={colors.textSoft}>
            tem o extrato do banco?{' '}
            <Text variant="smallStrong" color={colors.primary}>
              importar arquivo
            </Text>
          </Text>
        </Pressable>
      ) : null}

      {paidCard ? (
        <View style={styles.recInfo}>
          <Icon as={CreditCard} size={18} color={colors.primary} />
          <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
            pagamento da fatura do <Text variant="smallStrong">{paidCard.name}</Text>
            {existing?.invoiceDate ? ` que vence em ${shortDate(existing.invoiceDate)}` : ''}. apagar este lançamento faz a
            fatura voltar a ficar em aberto.
          </Text>
        </View>
      ) : null}

      {recurrence ? (
        <Pressable onPress={() => router.push({ pathname: '/recorrencia', params: { id: recurrence.id } })} style={styles.recInfo}>
          <Icon as={Repeat} size={18} color={colors.primary} />
          <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
            {fromPrediction ? 'previsão de ' : 'faz parte de '}
            <Text variant="smallStrong">{recurrence.description}</Text>, todo dia {recurrence.dayOfMonth}
            {fromPrediction ? '. ajuste o valor se foi diferente.' : '.'}
          </Text>
          <Text variant="smallStrong" color={colors.primary}>
            editar
          </Text>
        </Pressable>
      ) : null}

      <View style={{ marginVertical: space.xl }}>
        <AmountInput value={amount} onChange={setAmount} color={accent} autoFocus={!existing && !fromPrediction} />
        {error ? (
          <Text variant="small" color={colors.danger} center>
            {error}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: space.xl }}>
        <TextField
          label="descrição"
          value={description}
          onChangeText={setDescription}
          placeholder={isIncome ? 'ex.: freela, salário' : 'ex.: mercado, uber, café'}
          maxLength={80}
          returnKeyType="done"
        />

        {hasCards && !isInvoicePayment ? (
          <View style={styles.block}>
            <Text variant="smallStrong" color={colors.textSoft}>
              {isIncome ? 'onde entrou?' : 'onde foi?'}
            </Text>
            <DestinationPicker
              value={cardId}
              onChange={(id) => {
                setCardId(id);
                if (id && !payment) setPayment('credito');
                if (!id && payment === 'credito') setPayment(null);
              }}
            />
            {card ? (
              <Text variant="small" color={colors.textFaint}>
                {isIncome
                  ? 'estorno no cartão: abate da fatura.'
                  : `não sai do saldo agora: entra na fatura do ${card.name} que vence em ${shortDate(invoiceOf(card, date).dueDate)}.`}
              </Text>
            ) : null}
          </View>
        ) : null}

        {!isInvoicePayment ? (
          <View style={styles.block}>
            <Text variant="smallStrong" color={colors.textSoft}>
              categoria
            </Text>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} income={isIncome} />
          </View>
        ) : null}

        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            data
          </Text>
          <View style={styles.wrap}>
            <Chip label="hoje" selected={date === todayDate} onPress={() => setDate(todayDate)} />
            <Chip label="ontem" selected={date === addDays(todayDate, -1)} onPress={() => setDate(addDays(todayDate, -1))} />
            <Chip
              label={date !== todayDate && date !== addDays(todayDate, -1) ? friendlyDate(date, todayDate) : 'outra data'}
              icon={CalendarDays}
              selected={date !== todayDate && date !== addDays(todayDate, -1)}
              onPress={() => setDateOpen(true)}
            />
          </View>
        </View>

        {card || isInvoicePayment ? null : (
        <View style={styles.block}>
          <Text variant="smallStrong" color={colors.textSoft}>
            {isIncome ? 'já recebeu?' : 'já pagou?'}
          </Text>
          {future ? (
            <Text variant="small" color={colors.textSoft}>
              como a data é futura, fica como {isIncome ? 'receita prevista' : 'conta a pagar'} até você confirmar.
            </Text>
          ) : (
            <View style={styles.wrap}>
              <Chip label={isIncome ? 'sim, recebi' : 'sim, paguei'} selected={status === 'realizada'} onPress={() => setStatus('realizada')} />
              <Chip label={isIncome ? 'ainda não' : 'ainda não paguei'} selected={status === 'pendente'} onPress={() => setStatus('pendente')} />
            </View>
          )}
        </View>
        )}

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

        {!existing && !fromPrediction ? (
          <View style={styles.block}>
            <Text variant="smallStrong" color={colors.textSoft}>
              repetir?
            </Text>
            <View style={styles.wrap}>
              <Chip label="não" selected={repeat === 'nao'} onPress={() => setRepeat('nao')} />
              <Chip label="todo mês" icon={Repeat} selected={repeat === 'sempre'} onPress={() => setRepeat('sempre')} />
              <Chip label="parcelado" selected={repeat === 'parcelas'} onPress={() => setRepeat('parcelas')} />
            </View>
            {repeat === 'parcelas' ? (
              <TextField
                label="quantas parcelas?"
                value={installments}
                onChangeText={(t) => setInstallments(t.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                inputMode="numeric"
                hint={`o valor acima é de cada parcela, todo dia ${parseISODate(date).day}.`}
              />
            ) : repeat === 'sempre' ? (
              <Text variant="small" color={colors.textFaint}>
                vai aparecer no horizonte todo dia {parseISODate(date).day}. você pode ajustar ou parar quando quiser.
              </Text>
            ) : null}
          </View>
        ) : null}

        {existing ? (
          <Button label="apagar movimentação" icon={Trash2} variant="danger" onPress={remove} style={{ marginTop: space.md }} />
        ) : null}
        {fromPrediction ? (
          <Card tone="cream" style={{ gap: space.sm }}>
            <Text variant="small" color={colors.textSoft}>
              não vai acontecer este mês?
            </Text>
            <Button label="pular só este mês" icon={SkipForward} variant="ghost" small onPress={skip} />
          </Card>
        ) : null}
      </View>

      <DatePickerSheet visible={dateOpen} value={date} onClose={() => setDateOpen(false)} onChange={(d) => {
        setDate(d);
        if (d > todayDate) setStatus('pendente');
      }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  importLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: space.md },
  recInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
});
