import { router } from 'expo-router';
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  CategoryIcon,
  FadeIn,
  Icon,
  IconButton,
  Money,
  Pressable,
  Sheet,
  Text,
} from '../../components';
import { useData } from '../../data/DataProvider';
import { addMonths, monthName, monthOf, parseISODate, weekday } from '../../domain/dates';
import { dailyAllowance, horizon, type Entry, type HorizonDay } from '../../domain/finance';
import { formatMoney } from '../../domain/money';
import { useCategories } from '../../hooks/useCategories';
import { useToday } from '../../hooks/useToday';
import { openEntry } from '../../lib/navigation';
import { colors, MAX_WIDTH, radius, space } from '../../theme';

export default function Horizonte() {
  const insets = useSafeAreaInsets();
  const { data } = useData();
  const todayDate = useToday();
  const thisMonth = monthOf(todayDate);
  const [month, setMonth] = useState(thisMonth);
  const [help, setHelp] = useState(false);
  // guarda o mês em que os dias passados foram abertos; trocar de mês recolhe de novo.
  const [pastOpenFor, setPastOpenFor] = useState<string | null>(null);
  const showPast = pastOpenFor === month;

  const h = useMemo(() => horizon(data, month, todayDate), [data, month, todayDate]);
  const allowance = useMemo(() => dailyAllowance(data, todayDate), [data, todayDate]);
  const hide = data.settings.hideValues;
  const isCurrent = month === thisMonth;

  // no mês atual, os dias que já passaram ficam recolhidos para o foco ser o que vem pela frente.
  const pastDays = isCurrent ? h.days.filter((d) => d.isPast) : [];
  const visibleDays = isCurrent && !showPast ? h.days.filter((d) => !d.isPast) : h.days;

  const change = h.projectedEnd - (isCurrent || h.isPastMonth ? h.currentBalance : h.startBalance);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <IconButton icon={ChevronLeft} label="mês anterior" onPress={() => setMonth(addMonths(month, -1))} />
        <Pressable onPress={() => setMonth(thisMonth)} style={{ alignItems: 'center' }} accessibilityLabel="voltar para este mês">
          <Text variant="caption" color={colors.textSoft}>
            horizonte de saldo
          </Text>
          <Text variant="heading">{monthName(month, monthOf(todayDate).slice(0, 4) !== month.slice(0, 4))}</Text>
        </Pressable>
        <IconButton icon={ChevronRight} label="próximo mês" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.inner}>
          <FadeIn key={month}>
            <Card style={{ gap: space.lg }}>
              <View style={styles.flow}>
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.textSoft}>
                    {h.isPastMonth ? 'início do mês' : isCurrent ? 'hoje' : 'início do mês (previsto)'}
                  </Text>
                  <Money value={h.isPastMonth || !isCurrent ? h.startBalance : h.currentBalance} variant="heading" />
                </View>
                <Icon as={ArrowRight} color={colors.textFaint} size={20} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text variant="caption" color={colors.textSoft}>
                    {h.isPastMonth ? 'fim do mês' : 'fim do mês (previsto)'}
                  </Text>
                  <Money value={h.projectedEnd} variant="heading" color={h.projectedEnd < 0 ? colors.danger : colors.primary} />
                </View>
              </View>

              {!h.isPastMonth ? (
                <View style={styles.stats}>
                  <Stat label="vai entrar" value={h.futureIncome} color={colors.income} sign="+" />
                  <Stat label="vai sair" value={h.futureExpense} color={colors.text} sign="-" />
                  <Stat label="planejado" value={h.plannedSpending} color={colors.textSoft} sign="-" />
                </View>
              ) : (
                <Text variant="small" color={colors.textSoft}>
                  {change >= 0 ? 'você terminou o mês com ' : 'o mês terminou com '}
                  {hide ? 'variação no saldo' : `${formatMoney(change, { sign: true })} de diferença`}.
                </Text>
              )}

              {isCurrent && (
                <View style={styles.allowance}>
                  <Text variant="small" color={colors.textSoft} style={{ flex: 1 }}>
                    dá pra gastar por dia, até o fim do mês
                  </Text>
                  <Money value={allowance.perDay} variant="bodyStrong" color={colors.primary} />
                </View>
              )}
            </Card>

            {h.lowest && !h.isPastMonth && h.lowest.balance < h.projectedEnd ? (
              <View style={[styles.hint, h.lowest.balance < 0 && styles.hintWarn]}>
                <Text variant="small" color={h.lowest.balance < 0 ? colors.attention : colors.textSoft} style={{ flex: 1 }}>
                  {h.lowest.balance < 0
                    ? `atenção carinhosa: no dia ${parseISODate(h.lowest.date).day} o saldo pode ficar negativo${hide ? '' : ` (${formatMoney(h.lowest.balance)})`}.`
                    : `o dia mais apertado é ${parseISODate(h.lowest.date).day}${hide ? '' : `, com ${formatMoney(h.lowest.balance)}`}.`}
                </Text>
              </View>
            ) : null}

            <Pressable onPress={() => setHelp(true)} style={styles.legend} accessibilityRole="button">
              <Icon as={Info} size={16} color={colors.textFaint} />
              <Text variant="small" color={colors.textFaint}>
                {h.isPastMonth ? 'mês encerrado: só o que aconteceu de verdade.' : 'a partir de hoje, os saldos são previsões.'}
              </Text>
            </Pressable>
          </FadeIn>

          {pastDays.length > 0 ? (
            <Pressable onPress={() => setPastOpenFor(showPast ? null : month)} style={styles.pastToggle} accessibilityRole="button">
              <Icon as={showPast ? ChevronUp : ChevronDown} size={18} color={colors.textSoft} />
              <Text variant="smallStrong" color={colors.textSoft}>
                {showPast
                  ? 'esconder os dias que já passaram'
                  : `ver ${pastDays.length === 1 ? 'o dia que já passou' : `os ${pastDays.length} dias que já passaram`}`}
              </Text>
            </Pressable>
          ) : null}

          <View style={styles.timeline}>
            {visibleDays.map((d, i) => (
              <DayRow
                key={d.date}
                day={d}
                beforeStart={d.date < data.settings.initialBalanceDate}
                first={i === 0}
                last={i === visibleDays.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <Sheet visible={help} onClose={() => setHelp(false)} title="como o horizonte funciona">
        <View style={{ gap: space.md }}>
          <Text color={colors.textSoft}>
            o horizonte mostra como seu dinheiro deve se comportar dia a dia, como uma agenda.
          </Text>
          <Text color={colors.textSoft}>
            · dias que já passaram mostram o saldo real.{'\n'}· de hoje em diante, o saldo é uma previsão: soma o que vai
            entrar, tira contas e compromissos, e desconta o que você planejou gastar por categoria.{'\n'}· quando você
            registra um gasto que já estava previsto, ele substitui a previsão. nada é contado duas vezes.{'\n'}· itens com
            data passada que ainda não foram confirmados entram como se fossem hoje.
          </Text>
          <Text color={colors.textSoft}>
            o valor por dia é: saldo atual + o que vai entrar − o que vai sair − sua reserva, dividido pelos dias que faltam.
          </Text>
        </View>
      </Sheet>
    </View>
  );
}

function Stat({ label, value, color, sign }: { label: string; value: number; color: string; sign: '+' | '-' }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" color={colors.textSoft}>
        {label}
      </Text>
      <Money value={sign === '-' ? -value : value} sign={sign === '+'} variant="smallStrong" color={value === 0 ? colors.textFaint : color} />
    </View>
  );
}

function DayRow({
  day,
  first,
  last,
  beforeStart,
}: {
  day: HorizonDay;
  first: boolean;
  last: boolean;
  /** dia anterior ao início do uso do teo: não temos como saber o saldo real. */
  beforeStart: boolean;
}) {
  const { day: n } = parseISODate(day.date);
  const negative = day.endBalance < 0;
  const empty = day.entries.length === 0 && day.plannedSpending === 0;
  const dotStyle = day.isToday ? styles.dotToday : day.isPast ? styles.dotPast : styles.dotFuture;

  return (
    <View style={styles.dayRow}>
      {/* coluna da data */}
      <Pressable
        onPress={() => router.push({ pathname: '/movimentacao', params: { date: day.date } })}
        style={styles.dateCol}
        accessibilityLabel={`adicionar no dia ${n}`}
        scaleTo={0.94}
      >
        <Text variant={day.isToday ? 'heading' : 'bodyStrong'} color={day.isToday ? colors.primary : day.isPast ? colors.textFaint : colors.text}>
          {n}
        </Text>
        <Text variant="caption" color={day.isToday ? colors.primary : colors.textFaint}>
          {day.isToday ? 'hoje' : weekday(day.date, true)}
        </Text>
      </Pressable>

      {/* linha do tempo */}
      <View style={styles.rail}>
        <View style={[styles.railLine, first && { top: 18 }, last && { bottom: undefined, height: 18 }]} />
        <View style={[styles.dot, dotStyle, negative && !day.isPast && styles.dotNegative]} />
      </View>

      {/* conteúdo */}
      <View style={[styles.dayBody, empty && styles.dayBodyEmpty, day.isToday && styles.dayBodyToday]}>
        {day.entries.map((e) => (
          <DayEntry key={e.key} entry={e} />
        ))}
        {day.plannedSpending > 0 ? (
          <View style={styles.entryLine}>
            <Text variant="small" color={colors.textFaint} style={{ flex: 1 }}>
              gastos planejados do dia
            </Text>
            <Money value={-day.plannedSpending} variant="small" color={colors.textFaint} />
          </View>
        ) : null}
        <View style={[styles.balanceLine, !empty && styles.balanceLineSep]}>
          <Text variant="caption" color={colors.textFaint}>
            {beforeStart && empty ? 'antes de você começar no teo' : day.isPast ? 'saldo do dia' : 'saldo previsto'}
          </Text>
          {beforeStart && empty ? null : (
            <Money
              value={day.endBalance}
              variant={empty ? 'small' : 'smallStrong'}
              color={negative ? colors.danger : empty ? colors.textSoft : colors.text}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function DayEntry({ entry }: { entry: Entry }) {
  const { get } = useCategories();
  const { data } = useData();
  const cat = get(entry.categoryId);
  const income = entry.kind === 'receita';
  const planned = entry.source !== 'realizada';
  const isInvoice = !!entry.invoiceDate;
  // compra no cartão aparece no dia da compra, mas não mexe no saldo: ela vai para a fatura.
  const cardName = entry.cardId && !isInvoice ? data.cards.find((c) => c.id === entry.cardId)?.name : null;
  return (
    <Pressable onPress={() => openEntry(entry)} style={styles.entryLine} scaleTo={0.98} accessibilityRole="button">
      <CategoryIcon icon={entry.investmentId ? 'reserva' : isInvoice ? 'cartao' : cat?.icon} size={28} tone={income ? 'income' : planned || cardName ? 'muted' : 'cream'} />
      <View style={{ flex: 1 }}>
        <Text variant="smallStrong" numberOfLines={1}>
          {entry.description}
        </Text>
        <Text variant="caption" color={entry.overdue ? colors.attention : colors.textFaint}>
          {entry.overdue
            ? `a confirmar · era dia ${parseISODate(entry.originalDate).day}`
            : cardName
              ? `no cartão ${cardName} · vai para a fatura`
              : entry.investmentId
                ? entry.source !== 'realizada'
                  ? 'guardar na caixinha · previsto'
                  : entry.kind === 'despesa'
                    ? 'guardado na caixinha'
                  : 'resgatado da caixinha'
              : isInvoice
                ? 'fatura prevista'
                : entry.source === 'realizada'
                  ? 'realizada'
                  : entry.source === 'pendente'
                    ? 'pendente'
                    : entry.installment
                      ? `prevista · ${entry.installment}`
                      : 'prevista'}
        </Text>
      </View>
      <Money
        value={income ? entry.amount : -entry.amount}
        sign={income}
        variant="smallStrong"
        color={income ? colors.income : planned || cardName ? colors.textSoft : colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl },
  flow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  stats: { flexDirection: 'row', gap: space.md, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.line },
  allowance: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  hint: { marginTop: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: colors.muted },
  hintWarn: { backgroundColor: colors.attentionSoft },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.lg },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.md,
    marginBottom: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  timeline: { paddingTop: space.xs },
  dayRow: { flexDirection: 'row', alignItems: 'stretch' },
  dateCol: { width: 42, alignItems: 'center', paddingTop: 8 },
  rail: { width: 22, alignItems: 'center' },
  railLine: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.line },
  dot: { marginTop: 14, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotPast: { backgroundColor: colors.line, borderColor: colors.line },
  dotFuture: { backgroundColor: colors.background, borderColor: colors.textFaint },
  dotToday: { width: 14, height: 14, borderRadius: 7, marginTop: 12, backgroundColor: colors.primary, borderColor: colors.cream },
  dotNegative: { borderColor: colors.danger },
  dayBody: {
    flex: 1,
    marginLeft: space.sm,
    marginBottom: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
  },
  dayBodyEmpty: { backgroundColor: 'transparent', borderColor: 'transparent', paddingVertical: 10 },
  dayBodyToday: { borderColor: colors.primary },
  entryLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  balanceLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceLineSep: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: space.sm },
});

