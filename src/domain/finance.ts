/**
 * motor financeiro do teo.
 *
 * regras principais:
 * - saldo atual = saldo inicial + receitas realizadas − despesas realizadas, só da conta.
 * - compras no cartão de crédito não mexem no saldo na hora: entram na fatura do cartão,
 *   e a fatura vira uma despesa prevista no dia do vencimento. pagar a fatura (um
 *   lançamento da conta ligado a ela) substitui a previsão.
 * - previsões (contas pendentes, ocorrências de recorrências e faturas) nunca entram no
 *   saldo atual.
 * - uma ocorrência de recorrência deixa de ser prevista quando existe um lançamento ligado
 *   a ela (recurrenceId + occurrenceDate). assim nada é contado duas vezes.
 * - previsões com data passada que não foram confirmadas ficam "a confirmar" e entram
 *   na projeção a partir de hoje (o dinheiro ainda não entrou/saiu).
 * - o planejamento por categoria olha o consumo (compras na conta e no cartão, na data da
 *   compra). pagamentos de fatura não têm categoria, então nada é contado duas vezes.
 * - o restante planejado vira "gasto planejado" diário na projeção. se você gastou mais do
 *   que planejou, o restante vira zero.
 */
import {
  addDays,
  addMonths,
  daysInclusive,
  daysInMonth,
  firstDay,
  lastDay,
  makeDate,
  monthDays,
  monthOf,
  parseMonth,
  type ISODate,
  type MonthKey,
} from './dates';
import { sum, type Cents } from './money';
import type { Budget, Card, Kind, Recurrence, Snapshot, Transaction } from './types';

export type EntrySource = 'realizada' | 'pendente' | 'prevista';

export interface Entry {
  key: string;
  kind: Kind;
  amount: Cents;
  description: string;
  categoryId: string | null;
  /** data em que o valor conta (na projeção, itens atrasados contam hoje). */
  date: ISODate;
  /** data original do lançamento ou da ocorrência. */
  originalDate: ISODate;
  source: EntrySource;
  /** previsão com data no passado, ainda não confirmada. */
  overdue: boolean;
  transactionId?: string;
  recurrenceId?: string;
  /** "3/10" para parcelas. */
  installment?: string;
  /** compra feita no cartão (não mexe no saldo) ou fatura do cartão. */
  cardId?: string;
  /** presente nas previsões de fatura: vencimento da fatura. */
  invoiceDate?: ISODate;
}

const signed = (kind: Kind, amount: Cents) => (kind === 'receita' ? amount : -amount);

// ---------- recorrências ----------

export function occurrenceDate(rec: Recurrence, month: MonthKey): ISODate {
  const { year, month: m } = parseMonth(month);
  return makeDate(year, m, Math.min(rec.dayOfMonth, daysInMonth(month)));
}

function monthIndex(m: MonthKey): number {
  const { year, month } = parseMonth(m);
  return year * 12 + month - 1;
}

/** ocorrências de uma recorrência entre duas datas (inclusive), sem as puladas. */
export function recurrenceOccurrences(
  rec: Recurrence,
  from: ISODate,
  to: ISODate,
): { date: ISODate; index: number }[] {
  const out: { date: ISODate; index: number }[] = [];
  const startIdx = monthIndex(rec.startMonth);
  let m = monthOf(from) < rec.startMonth ? rec.startMonth : monthOf(from);
  const endMonth = monthOf(to);
  while (m <= endMonth) {
    const index = monthIndex(m) - startIdx + 1;
    if (rec.occurrences && index > rec.occurrences) break;
    const date = occurrenceDate(rec, m);
    if (date >= from && date <= to && !rec.skippedDates.includes(date)) {
      out.push({ date, index });
    }
    m = addMonths(m, 1);
  }
  return out;
}

/** última data em que a recorrência ocorre, ou null se não tiver fim. */
export function recurrenceEnd(rec: Recurrence): ISODate | null {
  if (!rec.occurrences) return null;
  return occurrenceDate(rec, addMonths(rec.startMonth, rec.occurrences - 1));
}

function coveredOccurrences(transactions: Transaction[]): Set<string> {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.recurrenceId && t.occurrenceDate) set.add(`${t.recurrenceId}|${t.occurrenceDate}`);
  }
  return set;
}

// ---------- entradas ----------

function txToEntry(t: Transaction, todayDate: ISODate, shiftOverdue: boolean): Entry {
  const overdue = t.status === 'pendente' && t.date < todayDate && !t.cardId;
  return {
    key: `t:${t.id}`,
    kind: t.kind,
    amount: t.amount,
    description: t.description,
    categoryId: t.categoryId,
    date: overdue && shiftOverdue ? todayDate : t.date,
    originalDate: t.date,
    source: t.status,
    overdue,
    transactionId: t.id,
    recurrenceId: t.recurrenceId ?? undefined,
    cardId: t.cardId ?? undefined,
  };
}

function occurrenceEntries(
  s: Snapshot,
  recs: Recurrence[],
  from: ISODate,
  to: ISODate,
  todayDate: ISODate,
  shiftOverdue: boolean,
): Entry[] {
  const covered = coveredOccurrences(s.transactions);
  // previsões anteriores ao início do uso do teo já estão refletidas no saldo inicial.
  const effectiveFrom = from < s.settings.initialBalanceDate ? s.settings.initialBalanceDate : from;
  const out: Entry[] = [];
  for (const rec of recs) {
    for (const occ of recurrenceOccurrences(rec, effectiveFrom, to)) {
      if (covered.has(`${rec.id}|${occ.date}`)) continue;
      // no cartão, a ocorrência faz parte da fatura: não fica "a confirmar" sozinha.
      const overdue = occ.date < todayDate && !rec.cardId;
      out.push({
        key: `r:${rec.id}:${occ.date}`,
        kind: rec.kind,
        amount: rec.amount,
        description: rec.description,
        categoryId: rec.categoryId,
        date: overdue && shiftOverdue ? todayDate : occ.date,
        originalDate: occ.date,
        source: 'prevista',
        overdue,
        recurrenceId: rec.id,
        installment: rec.occurrences ? `${occ.index}/${rec.occurrences}` : undefined,
        cardId: rec.cardId ?? undefined,
      });
    }
  }
  return out;
}

/** ocorrências previstas (ainda sem lançamento) da conta, entre duas datas. */
export function predictedEntries(
  s: Snapshot,
  from: ISODate,
  to: ISODate,
  todayDate: ISODate,
  shiftOverdue = true,
): Entry[] {
  return occurrenceEntries(
    s,
    s.recurrences.filter((r) => !r.cardId),
    from,
    to,
    todayDate,
    shiftOverdue,
  );
}

// ---------- cartões e faturas ----------

function dayIn(month: MonthKey, day: number): ISODate {
  const { year, month: m } = parseMonth(month);
  return makeDate(year, m, Math.min(day, daysInMonth(month)));
}

/** dia em que a fatura fecha num mês. */
export function closingDateIn(card: Card, month: MonthKey): ISODate {
  return dayIn(month, card.closingDay);
}

/** vencimento da fatura que fecha numa data. se vence "antes" do fechamento, é no mês seguinte. */
export function dueDateFor(card: Card, closingDate: ISODate): ISODate {
  const m = monthOf(closingDate);
  return dayIn(card.dueDay > card.closingDay ? m : addMonths(m, 1), card.dueDay);
}

/** em qual fatura uma compra entra. compras até o dia do fechamento entram na fatura do mês. */
export function invoiceOf(card: Card, purchaseDate: ISODate): { closingDate: ISODate; dueDate: ISODate } {
  let closing = closingDateIn(card, monthOf(purchaseDate));
  if (purchaseDate > closing) closing = closingDateIn(card, addMonths(monthOf(purchaseDate), 1));
  return { closingDate: closing, dueDate: dueDateFor(card, closing) };
}

/** período de compras de uma fatura, a partir do vencimento. */
export function invoicePeriod(card: Card, dueDate: ISODate): { start: ISODate; closingDate: ISODate } {
  const closingMonth = card.dueDay > card.closingDay ? monthOf(dueDate) : addMonths(monthOf(dueDate), -1);
  const closingDate = closingDateIn(card, closingMonth);
  const start = addDays(closingDateIn(card, addMonths(closingMonth, -1)), 1);
  return { start, closingDate };
}

export type InvoiceStatus = 'aberta' | 'fechada' | 'paga';

export interface Invoice {
  card: Card;
  closingDate: ISODate;
  dueDate: ISODate;
  /** compras (realizadas e previstas) da fatura. */
  items: Entry[];
  /** total: compras − estornos. */
  total: Cents;
  payment: Transaction | null;
  status: InvoiceStatus;
}

interface InvoiceOptions {
  /** ignora compras avulsas desta data (usado no "dá pra gastar hoje"). */
  excludePurchasesOn?: ISODate;
}

/** compras do cartão (lançamentos + recorrências previstas) até uma data. */
function cardItems(s: Snapshot, card: Card, to: ISODate, todayDate: ISODate, opts: InvoiceOptions = {}): Entry[] {
  const txs = s.transactions
    .filter((t) => t.cardId === card.id && t.date <= to)
    .filter((t) => !(opts.excludePurchasesOn && t.date === opts.excludePurchasesOn && !t.recurrenceId))
    .map((t) => txToEntry(t, todayDate, false));
  const recs = occurrenceEntries(
    s,
    s.recurrences.filter((r) => r.cardId === card.id),
    s.settings.initialBalanceDate,
    to,
    todayDate,
    false,
  );
  return [...txs, ...recs];
}

/** faturas de um cartão com compras até `to`, da mais antiga para a mais nova. */
export function cardInvoices(
  s: Snapshot,
  card: Card,
  to: ISODate,
  todayDate: ISODate,
  opts: InvoiceOptions = {},
): Invoice[] {
  const groups = new Map<ISODate, { closingDate: ISODate; items: Entry[] }>();
  for (const item of cardItems(s, card, to, todayDate, opts)) {
    const { closingDate, dueDate } = invoiceOf(card, item.originalDate);
    const g = groups.get(dueDate) ?? { closingDate, items: [] };
    g.items.push(item);
    groups.set(dueDate, g);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([dueDate, g]) => {
      const payment =
        s.transactions.find((t) => t.paysCardId === card.id && t.invoiceDate === dueDate) ?? null;
      const total = sum(g.items.map((e) => -signed(e.kind, e.amount)));
      const status: InvoiceStatus = payment ? 'paga' : todayDate <= g.closingDate ? 'aberta' : 'fechada';
      return { card, closingDate: g.closingDate, dueDate, items: g.items.sort(compareEntries), total, payment, status };
    });
}

/** uma fatura específica (pelo vencimento), mesmo sem compras. */
export function invoiceByDueDate(s: Snapshot, card: Card, dueDate: ISODate, todayDate: ISODate): Invoice {
  const found = cardInvoices(s, card, dueDate, todayDate).find((i) => i.dueDate === dueDate);
  if (found) return found;
  const { closingDate } = invoicePeriod(card, dueDate);
  const payment = s.transactions.find((t) => t.paysCardId === card.id && t.invoiceDate === dueDate) ?? null;
  return {
    card,
    closingDate,
    dueDate,
    items: [],
    total: 0,
    payment,
    status: payment ? 'paga' : todayDate <= closingDate ? 'aberta' : 'fechada',
  };
}

/** faturas não pagas com vencimento até `to`, como despesas previstas da conta. */
function invoiceEntries(s: Snapshot, todayDate: ISODate, to: ISODate, opts: InvoiceOptions = {}): Entry[] {
  const out: Entry[] = [];
  for (const card of s.cards) {
    for (const inv of cardInvoices(s, card, to, todayDate, opts)) {
      // faturas que venceram antes de começar no teo já estão no saldo inicial.
      if (inv.payment || inv.total <= 0 || inv.dueDate > to || inv.dueDate < s.settings.initialBalanceDate) continue;
      const overdue = inv.dueDate < todayDate;
      out.push({
        key: `f:${card.id}:${inv.dueDate}`,
        kind: 'despesa',
        amount: inv.total,
        description: `fatura ${card.name}`,
        categoryId: null,
        date: overdue ? todayDate : inv.dueDate,
        originalDate: inv.dueDate,
        source: 'prevista',
        overdue,
        cardId: card.id,
        invoiceDate: inv.dueDate,
      });
    }
  }
  return out;
}

/** quanto do limite do cartão está em uso (faturas não pagas). */
export function cardLimitUsed(s: Snapshot, card: Card, todayDate: ISODate): Cents {
  const horizonEnd = lastDay(addMonths(monthOf(todayDate), 24));
  return sum(
    cardInvoices(s, card, horizonEnd, todayDate)
      .filter((i) => !i.payment)
      .map((i) => sum(i.items.filter((e) => e.source !== 'prevista').map((e) => -signed(e.kind, e.amount)))),
  );
}

// ---------- o que ainda vai acontecer ----------

/** tudo o que ainda vai entrar ou sair da conta até `to`: pendentes, recorrências e faturas. */
export function upcomingEntries(s: Snapshot, todayDate: ISODate, to: ISODate, opts: InvoiceOptions = {}): Entry[] {
  const pending = s.transactions
    .filter((t) => t.status === 'pendente' && !t.cardId && t.date <= to)
    .map((t) => txToEntry(t, todayDate, true));
  const predicted = predictedEntries(s, s.settings.initialBalanceDate, to, todayDate, true);
  return [...pending, ...predicted, ...invoiceEntries(s, todayDate, to, opts)].sort(compareEntries);
}

/** itens com data passada que ainda não foram confirmados. */
export function overdueEntries(s: Snapshot, todayDate: ISODate): Entry[] {
  return upcomingEntries(s, todayDate, todayDate).filter((e) => e.overdue);
}

function compareEntries(a: Entry, b: Entry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.originalDate !== b.originalDate) return a.originalDate < b.originalDate ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === 'receita' ? -1 : 1;
  return a.description.localeCompare(b.description);
}

/** previsões da conta dentro de um mês futuro (sem deslocar atrasados). */
function monthUpcoming(s: Snapshot, month: MonthKey, todayDate: ISODate): Entry[] {
  return [
    ...s.transactions
      .filter((t) => t.status === 'pendente' && !t.cardId && monthOf(t.date) === month)
      .map((t) => txToEntry(t, todayDate, false)),
    ...predictedEntries(s, firstDay(month), lastDay(month), todayDate, false),
    ...invoiceEntries(s, todayDate, lastDay(month)).filter((e) => monthOf(e.originalDate) === month),
  ];
}

// ---------- saldos ----------

/** lançamentos realizados que mexem no saldo da conta (compras no cartão ficam de fora). */
export function realizedTransactions(s: Snapshot): Transaction[] {
  return s.transactions.filter((t) => t.status === 'realizada' && !t.cardId);
}

/** saldo atual: só o que já aconteceu de verdade na conta. */
export function currentBalance(s: Snapshot): Cents {
  return s.settings.initialBalance + sum(realizedTransactions(s).map((t) => signed(t.kind, t.amount)));
}

/** saldo real ao fim de um dia (apenas lançamentos realizados até aquela data). */
export function balanceAt(s: Snapshot, date: ISODate): Cents {
  return (
    s.settings.initialBalance +
    sum(realizedTransactions(s).filter((t) => t.date <= date).map((t) => signed(t.kind, t.amount)))
  );
}

export interface MonthSummary {
  month: MonthKey;
  income: Cents; // realizadas na conta no mês
  expense: Cents; // realizadas na conta no mês (inclui pagamento de fatura)
  pendingIncome: Cents; // ainda vão entrar no mês (inclui atrasadas se for o mês atual)
  pendingExpense: Cents;
}

export function monthSummary(s: Snapshot, month: MonthKey, todayDate: ISODate): MonthSummary {
  const realized = realizedTransactions(s).filter((t) => monthOf(t.date) === month);
  const isCurrent = month === monthOf(todayDate);
  const isPast = month < monthOf(todayDate);
  const upcoming = isCurrent
    ? upcomingEntries(s, todayDate, lastDay(month))
    : isPast
      ? []
      : monthUpcoming(s, month, todayDate);
  return {
    month,
    income: sum(realized.filter((t) => t.kind === 'receita').map((t) => t.amount)),
    expense: sum(realized.filter((t) => t.kind === 'despesa').map((t) => t.amount)),
    pendingIncome: sum(upcoming.filter((e) => e.kind === 'receita').map((e) => e.amount)),
    pendingExpense: sum(upcoming.filter((e) => e.kind === 'despesa').map((e) => e.amount)),
  };
}

// ---------- planejamento ----------

export type BudgetStatus = 'tranquilo' | 'atencao' | 'passou';

export interface BudgetProgress {
  budget: Budget;
  spent: Cents; // consumido na categoria no mês (conta + cartão)
  committed: Cents; // pendente/previsto na categoria no mês
  remaining: Cents; // planejado − gasto − comprometido (mínimo 0)
  ratio: number; // gasto / planejado
  status: BudgetStatus;
}

/** consumo ainda por vir num mês, por categoria (conta e cartão). */
function upcomingConsumption(s: Snapshot, month: MonthKey, todayDate: ISODate): Entry[] {
  if (month < monthOf(todayDate)) return [];
  const isCurrent = month === monthOf(todayDate);
  const cash = isCurrent
    ? upcomingEntries(s, todayDate, lastDay(month)).filter((e) => !e.invoiceDate)
    : monthUpcoming(s, month, todayDate).filter((e) => !e.invoiceDate);
  const cardPending = s.transactions
    .filter((t) => t.cardId && t.status === 'pendente' && monthOf(t.date) === month)
    .map((t) => txToEntry(t, todayDate, false));
  const cardPredicted = occurrenceEntries(
    s,
    s.recurrences.filter((r) => !!r.cardId),
    firstDay(month),
    lastDay(month),
    todayDate,
    false,
  );
  return [...cash, ...cardPending, ...cardPredicted];
}

export function budgetProgress(s: Snapshot, month: MonthKey, todayDate: ISODate): BudgetProgress[] {
  // consumo = compras realizadas na conta e no cartão, na data da compra.
  const consumed = s.transactions.filter(
    (t) => t.status === 'realizada' && t.kind === 'despesa' && !t.paysCardId && monthOf(t.date) === month,
  );
  const upcoming = upcomingConsumption(s, month, todayDate);
  return s.budgets
    .filter((b) => b.amount > 0)
    .map((budget) => {
      const spent = sum(consumed.filter((t) => t.categoryId === budget.categoryId).map((t) => t.amount));
      const committed = sum(
        upcoming
          .filter((e) => e.kind === 'despesa' && e.categoryId === budget.categoryId)
          .map((e) => e.amount),
      );
      const remaining = Math.max(0, budget.amount - spent - committed);
      const ratio = budget.amount > 0 ? spent / budget.amount : 0;
      const status: BudgetStatus = ratio > 1 ? 'passou' : ratio >= 0.8 ? 'atencao' : 'tranquilo';
      return { budget, spent, committed, remaining, ratio, status };
    });
}

/** quanto ainda está planejado para gastar no mês (soma do restante de cada categoria). */
export function remainingPlanned(s: Snapshot, month: MonthKey, todayDate: ISODate): Cents {
  return sum(budgetProgress(s, month, todayDate).map((b) => b.remaining));
}

// ---------- quanto dá pra gastar por dia ----------

export interface DailyAllowance {
  /** valor sugerido por dia até o fim do mês. */
  perDay: Cents;
  /** quanto ainda dá hoje (perDay − gasto de hoje). pode ser negativo. */
  leftToday: Cents;
  /** gasto de hoje, na conta e no cartão. */
  spentToday: Cents;
  /** dinheiro livre até o fim do mês (antes de dividir pelos dias). */
  available: Cents;
  daysLeft: number;
}

/**
 * dinheiro livre = saldo atual + receitas que ainda vão entrar − despesas que ainda vão sair
 * (inclusive faturas que vencem no mês) − reserva, dividido pelos dias que faltam (contando hoje).
 * os gastos avulsos de hoje (na conta ou no cartão) são devolvidos à conta, para que o valor
 * por dia não mude a cada café — eles aparecem no "ainda dá hoje".
 */
export function dailyAllowance(s: Snapshot, todayDate: ISODate): DailyAllowance {
  const month = monthOf(todayDate);
  const upcoming = upcomingEntries(s, todayDate, lastDay(month), { excludePurchasesOn: todayDate });
  const todays = s.transactions.filter(
    (t) =>
      t.status === 'realizada' &&
      t.kind === 'despesa' &&
      t.date === todayDate &&
      !t.recurrenceId &&
      !t.paysCardId,
  );
  const spentTodayCash = sum(todays.filter((t) => !t.cardId).map((t) => t.amount));
  const spentToday = sum(todays.map((t) => t.amount));
  const available =
    currentBalance(s) + spentTodayCash + sum(upcoming.map((e) => signed(e.kind, e.amount))) - s.settings.reserve;
  const daysLeft = daysInclusive(todayDate, lastDay(month));
  const perDay = available > 0 ? Math.floor(available / daysLeft) : 0;
  return { perDay, leftToday: perDay - spentToday, spentToday, available, daysLeft };
}

// ---------- horizonte de saldo ----------

export interface HorizonDay {
  date: ISODate;
  entries: Entry[];
  /** gasto planejado (planejamento por categoria) distribuído neste dia. só em dias futuros/hoje. */
  plannedSpending: Cents;
  /** saldo ao fim do dia: real para dias passados, projetado para hoje em diante. */
  endBalance: Cents;
  isPast: boolean;
  isToday: boolean;
}

export interface Horizon {
  month: MonthKey;
  days: HorizonDay[];
  /** saldo no início do mês (real se o mês já começou). */
  startBalance: Cents;
  currentBalance: Cents;
  /** saldo previsto no último dia do mês. */
  projectedEnd: Cents;
  futureIncome: Cents;
  futureExpense: Cents;
  plannedSpending: Cents;
  lowest: { date: ISODate; balance: Cents } | null;
  isPastMonth: boolean;
}

/** gasto planejado por dia, para um mês, a partir de um dia. */
function plannedPerDay(s: Snapshot, month: MonthKey, from: ISODate, todayDate: ISODate) {
  const remaining = remainingPlanned(s, month, todayDate);
  const days = daysInclusive(from, lastDay(month));
  const base = Math.floor(remaining / days);
  // o resto dos centavos vai para o primeiro dia, para que a soma bata exatamente.
  return { base, extra: remaining - base * days };
}

export function horizon(s: Snapshot, month: MonthKey, todayDate: ISODate): Horizon {
  const thisMonth = monthOf(todayDate);
  const isPastMonth = month < thisMonth;
  const now = currentBalance(s);

  // o que aconteceu de verdade em cada dia: conta e cartão (o cartão só aparece, não mexe no saldo).
  const happenedByDay = new Map<ISODate, Entry[]>();
  for (const t of s.transactions) {
    if (t.status !== 'realizada' || monthOf(t.date) !== month) continue;
    const list = happenedByDay.get(t.date) ?? [];
    list.push(txToEntry(t, todayDate, false));
    happenedByDay.set(t.date, list);
  }

  if (isPastMonth) {
    const days = monthDays(month).map((date) => ({
      date,
      entries: (happenedByDay.get(date) ?? []).sort(compareEntries),
      plannedSpending: 0,
      endBalance: balanceAt(s, date),
      isPast: true,
      isToday: false,
    }));
    return {
      month,
      days,
      startBalance: balanceAt(s, lastDayOfPreviousMonth(month)),
      currentBalance: now,
      projectedEnd: days[days.length - 1].endBalance,
      futureIncome: 0,
      futureExpense: 0,
      plannedSpending: 0,
      lowest: lowestOf(days),
      isPastMonth: true,
    };
  }

  // projeção de hoje até o fim do mês escolhido (só o que mexe na conta).
  const upcoming = upcomingEntries(s, todayDate, lastDay(month));
  const upcomingByDay = new Map<ISODate, Entry[]>();
  for (const e of upcoming) {
    const list = upcomingByDay.get(e.date) ?? [];
    list.push(e);
    upcomingByDay.set(e.date, list);
  }

  let running = now;
  let startBalance = month === thisMonth ? balanceAt(s, lastDayOfPreviousMonth(month)) : now;
  let futureIncome = 0;
  let futureExpense = 0;
  let plannedTotal = 0;
  const days: HorizonDay[] = [];

  // meses entre hoje e o mês escolhido: só acumulam o saldo.
  let m = thisMonth;
  while (m <= month) {
    const from = m === thisMonth ? todayDate : firstDay(m);
    const planned = plannedPerDay(s, m, from, todayDate);
    if (m === month && m !== thisMonth) startBalance = running;
    for (const date of monthDays(m)) {
      if (date < todayDate) {
        if (m === month) {
          days.push({
            date,
            entries: (happenedByDay.get(date) ?? []).sort(compareEntries),
            plannedSpending: 0,
            endBalance: balanceAt(s, date),
            isPast: true,
            isToday: false,
          });
        }
        continue;
      }
      const future = upcomingByDay.get(date) ?? [];
      const plannedSpending = planned.base + (date === from ? planned.extra : 0);
      running += sum(future.map((e) => signed(e.kind, e.amount))) - plannedSpending;
      if (m === month) {
        futureIncome += sum(future.filter((e) => e.kind === 'receita').map((e) => e.amount));
        futureExpense += sum(future.filter((e) => e.kind === 'despesa').map((e) => e.amount));
        plannedTotal += plannedSpending;
        const happenedToday = date === todayDate ? (happenedByDay.get(date) ?? []) : [];
        days.push({
          date,
          entries: [...happenedToday, ...future].sort(compareEntries),
          plannedSpending,
          endBalance: running,
          isPast: false,
          isToday: date === todayDate,
        });
      }
    }
    m = addMonths(m, 1);
  }

  return {
    month,
    days,
    startBalance,
    currentBalance: now,
    projectedEnd: running,
    futureIncome,
    futureExpense,
    plannedSpending: plannedTotal,
    lowest: lowestOf(days.filter((d) => !d.isPast)),
    isPastMonth: false,
  };
}

/** último dia do mês anterior. */
function lastDayOfPreviousMonth(month: MonthKey): ISODate {
  return lastDay(addMonths(month, -1));
}

function lowestOf(days: HorizonDay[]): { date: ISODate; balance: Cents } | null {
  if (!days.length) return null;
  let low = days[0];
  for (const d of days) if (d.endBalance < low.endBalance) low = d;
  return { date: low.date, balance: low.endBalance };
}

// ---------- metas ----------

export function goalProgress(saved: Cents, target: Cents): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, saved / target));
}
