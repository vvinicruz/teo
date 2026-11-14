import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, FileUp, Pencil, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AmountInput,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  EntryRow,
  IconButton,
  Money,
  Screen,
  Sheet,
  Text,
  useFeedback,
} from '../components';
import { useData } from '../data/DataProvider';
import { addMonths, friendlyDate, monthName, monthOf, shortDate } from '../domain/dates';
import { closingDateIn, dueDateFor, invoiceByDueDate, invoiceOf, invoicePeriod } from '../domain/finance';
import { formatMoney } from '../domain/money';
import { useToday } from '../hooks/useToday';
import { openEntry } from '../lib/navigation';
import { colors, space } from '../theme';

export default function CartaoDetalhe() {
  const { id, fatura } = useLocalSearchParams<{ id: string; fatura?: string }>();
  const { data, payInvoice, deleteTransaction } = useData();
  const { toast, confirm } = useFeedback();
  const todayDate = useToday();
  const card = data.cards.find((c) => c.id === id);

  // navegamos pelo mês de fechamento; o vencimento sai dele.
  const initialClosingMonth = card
    ? monthOf(fatura ? invoicePeriod(card, fatura).closingDate : invoiceOf(card, todayDate).closingDate)
    : monthOf(todayDate);
  const [closingMonth, setClosingMonth] = useState(initialClosingMonth);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payToday, setPayToday] = useState(true);
  const [paying, setPaying] = useState(false);

  const invoice = useMemo(
    () => (card ? invoiceByDueDate(data, card, dueDateFor(card, closingDateIn(card, closingMonth)), todayDate) : null),
    [card, closingMonth, data, todayDate],
  );

  if (!card || !invoice) {
    return (
      <Screen back title="cartão">
        <Text color={colors.textSoft} center style={{ marginTop: space.xxxl }}>
          esse cartão não existe mais.
        </Text>
      </Screen>
    );
  }

  const period = invoicePeriod(card, invoice.dueDate);
  const statusBadge =
    invoice.status === 'paga' ? (
      <Badge label="paga" tone="ok" />
    ) : invoice.status === 'aberta' ? (
      <Badge label="aberta" tone="pendente" />
    ) : invoice.dueDate < todayDate ? (
      <Badge label="venceu" tone="atencao" />
    ) : (
      <Badge label="fechada" tone="neutro" />
    );

  const openPay = () => {
    setPayAmount(invoice.total);
    setPayToday(true);
    setPayOpen(true);
  };

  const pay = async () => {
    if (payAmount <= 0) return;
    setPaying(true);
    try {
      await payInvoice(card, invoice.dueDate, { amount: payAmount, date: payToday ? todayDate : invoice.dueDate });
      toast('fatura paga! tudo em ordem :)');
      setPayOpen(false);
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    } finally {
      setPaying(false);
    }
  };

  const undoPayment = async () => {
    if (!invoice.payment) return;
    const ok = await confirm({
      title: 'desfazer o pagamento?',
      message: 'o valor volta para o seu saldo e a fatura volta a aparecer como prevista no horizonte.',
      confirmLabel: 'desfazer',
    });
    if (!ok) return;
    try {
      await deleteTransaction(invoice.payment.id);
      toast('pagamento desfeito.', 'info');
    } catch {
      toast('não conseguimos salvar agora. tenta de novo?', 'erro');
    }
  };

  return (
    <Screen
      back
      title={card.name}
      right={<IconButton icon={Pencil} label="editar cartão" onPress={() => router.push({ pathname: '/cartao-form', params: { id: card.id } })} background={colors.surface} />}
    >
      <View style={styles.monthRow}>
        <IconButton icon={ChevronLeft} label="fatura anterior" onPress={() => setClosingMonth(addMonths(closingMonth, -1))} />
        <Text variant="bodyStrong">fatura de {monthName(monthOf(invoice.dueDate), monthOf(invoice.dueDate).slice(0, 4) !== todayDate.slice(0, 4))}</Text>
        <IconButton icon={ChevronRight} label="próxima fatura" onPress={() => setClosingMonth(addMonths(closingMonth, 1))} />
      </View>

      <Card style={{ gap: space.sm }}>
        <View style={styles.statusRow}>
          <Text variant="small" color={colors.textSoft}>
            compras de {shortDate(period.start)} a {shortDate(period.closingDate)}
          </Text>
          {statusBadge}
        </View>
        <Money value={invoice.total} variant="display" />
        <Text variant="small" color={colors.textSoft}>
          {invoice.payment
            ? `paga ${friendlyDate(invoice.payment.date, todayDate)}${invoice.payment.amount !== invoice.total ? ` (${formatMoney(invoice.payment.amount)})` : ''}`
            : `vence ${friendlyDate(invoice.dueDate, todayDate)}`}
        </Text>
        {invoice.items.some((e) => e.source === 'prevista') ? (
          <Text variant="small" color={colors.textFaint}>
            inclui assinaturas e parcelas previstas.
          </Text>
        ) : null}
        {!invoice.payment && invoice.total > 0 ? (
          <Button label="pagar fatura" onPress={openPay} style={{ marginTop: space.md }} />
        ) : invoice.payment ? (
          <Button label="desfazer pagamento" variant="ghost" small onPress={undoPayment} style={{ marginTop: space.md, alignSelf: 'flex-start' }} />
        ) : null}
      </Card>

      <View style={styles.actions}>
        <Button
          label="nova compra"
          icon={Plus}
          variant="secondary"
          small
          onPress={() => router.push({ pathname: '/movimentacao', params: { cardId: card.id } })}
          style={{ flex: 1 }}
        />
        <Button
          label="importar"
          icon={FileUp}
          variant="secondary"
          small
          onPress={() => router.push({ pathname: '/importar', params: { cardId: card.id } })}
          style={{ flex: 1 }}
        />
      </View>

      {invoice.items.length === 0 ? (
        <EmptyState compact title="nenhuma compra nesta fatura" message="as compras feitas nesse período aparecem aqui." />
      ) : (
        <Card padded={false} style={styles.list}>
          {invoice.items.map((e) => (
            <EntryRow key={e.key} item={{ ...e, date: e.originalDate, cardId: undefined }} onPress={() => openEntry(e)} />
          ))}
        </Card>
      )}

      <Sheet visible={payOpen} onClose={() => setPayOpen(false)} title={`pagar fatura do ${card.name}`}>
        <View style={{ gap: space.lg }}>
          <Text color={colors.textSoft}>quanto você pagou? se pagou só uma parte, ajuste o valor.</Text>
          <AmountInput value={payAmount} onChange={setPayAmount} />
          <View style={{ flexDirection: 'row', gap: space.sm, justifyContent: 'center' }}>
            <Chip label="paguei hoje" selected={payToday} onPress={() => setPayToday(true)} />
            {invoice.dueDate < todayDate ? (
              <Chip label={`paguei no dia ${shortDate(invoice.dueDate)}`} selected={!payToday} onPress={() => setPayToday(false)} />
            ) : null}
          </View>
          <Button label="confirmar pagamento" onPress={pay} loading={paying} disabled={payAmount <= 0} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: space.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.sm, marginVertical: space.lg },
  list: { paddingHorizontal: space.lg, paddingVertical: space.xs },
});
