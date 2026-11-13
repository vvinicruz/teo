/**
 * motor financeiro do teo.
 *
 * regras principais:
 * - saldo atual = saldo inicial + receitas realizadas − despesas realizadas.
 * - previsões (contas pendentes e ocorrências de recorrências) nunca entram no saldo atual.
 * - uma ocorrência de recorrência deixa de ser prevista quando existe um lançamento ligado
 *   a ela (recurrenceId + occurrenceDate). assim nada é contado duas vezes.
 * - previsões com data passada que não foram confirmadas ficam "a confirmar" e entram
 *   na projeção a partir de hoje (o dinheiro ainda não entrou/saiu).
 * - o planejamento por categoria vira "gasto planejado" diário na projeção, descontando
 *   o que já foi gasto ou já está comprometido na categoria. se você gastou mais do que
 *   planejou, a diferença já está no saldo atual e o restante planejado vira zero.
 */
import {
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
import type { Budget, Kind, Recurrence, Snapshot, Transaction } from './types';

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
  const overdue = t.status === 'pendente' && t.date < todayDate;
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
  };
}

/** ocorrências previstas (ainda sem lançamento) entre duas datas. */
export function predictedEntries(
  s: Snapshot,
  from: ISODate,
  to: ISODate,
  todayDate: ISODate,
  shiftOverdue = true,
): Entry[] {
  const covered = coveredOccurrences(s.transactions);
  // previsões anteriores ao início do uso do teo já estão refletidas no saldo inicial.
  const effectiveFrom = from < s.settings.initialBalanceDate ? s.settings.initialBalanceDate : from;
  const out: Entry[] = [];
  for (const rec of s.recurrences) {
    for (const occ of recurrenceOccurrences(rec, effectiveFrom, to)) {
      if (covered.has(`${rec.id}|${occ.date}`)) continue;
      const overdue = occ.date < todayDate;
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
      });
    }
  }
  return out;
}

/** tudo o que ainda vai entrar ou sair: pendentes + previstas, até `to`, incluindo atrasados. */
export function upcomingEntries(s: Snapshot, todayDate: ISODate, to: ISODate): Entry[] {
  const pending = s.transactions
    .filter((t) => t.status === 'pendente' && t.date <= to)
    .map((t) => txToEntry(t, todayDate, true));
  const predicted = predictedEntries(s, s.settings.initialBalanceDate, to, todayDate, true);
  return [...pending, ...predicted].sort(compareEntries);
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

// ---------- saldos ----------

export function realizedTransactions(s: Snapshot): Transaction[] {
  return s.transactions.filter((t) => t.status === 'realizada');
}

/** saldo atual: só o que já aconteceu de verdade. */
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
  income: Cents; // realizadas no mês
  expense: Cents; // realizadas no mês
  pendingIncome: Cents; // ainda vão entrar no mês (inclui atrasadas se for o mês atual)
  pendingExpense: Cents;
}

export function monthSummary(s: Snapshot, month: MonthKey, todayDate: ISODate): MonthSummary {
  const realized = realizedTransactions(s).filter((t) => monthOf(t.date) === month);
  const isCurrent = month === monthOf(todayDate);
  const isPast = month < monthOf(todayDate);
  let upcoming: Entry[] = [];
  if (isCurrent) upcoming = upcomingEntries(s, todayDate, lastDay(month));
  else if (!isPast) {
    upcoming = [
      ...s.transactions
        .filter((t) => t.status === 'pendente' && monthOf(t.date) === month)
        .map((t) => txToEntry(t, todayDate, false)),
      ...predictedEntries(s, firstDay(month), lastDay(month), todayDate, false),
    ];
  }
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
  spent: Cents; // realizado na categoria no mês
  committed: Cents; // pendente/previsto na categoria no mês
  remaining: Cents; // planejado − gasto − comprometido (mínimo 0)
  ratio: number; // gasto / planejado
  status: BudgetStatus;
}

export function budgetProgress(s: Snapshot, month: MonthKey, todayDate: ISODate): BudgetProgress[] {
  const realized = realizedTransactions(s).filter(
    (t) => t.kind === 'despesa' && monthOf(t.date) === month,
  );
  const isPast = month < monthOf(todayDate);
  const upcoming = isPast
    ? []
    : month === monthOf(todayDate)
      ? upcomingEntries(s, todayDate, lastDay(month))
      : [
          ...s.transactions
            .filter((t) => t.status === 'pendente' && monthOf(t.date) === month)
            .map((t) => txToEntry(t, todayDate, false)),
          ...predictedEntries(s, firstDay(month), lastDay(month), todayDate, false),
        ];
  return s.budgets
    .filter((b) => b.amount > 0)
    .map((budget) => {
      const spent = sum(realized.filter((t) => t.categoryId === budget.categoryId).map((t) => t.amount));
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
  spentToday: Cents;
  /** dinheiro livre até o fim do mês (antes de dividir pelos dias). */
  available: Cents;
  daysLeft: number;
}

/**
 * dinheiro livre = saldo atual + receitas que ainda vão entrar − despesas que ainda vão sair − reserva.
 * dividido pelos dias que faltam (contando hoje). os gastos do dia que não são compromissos
 * (sem recorrência) são devolvidos à conta para que o valor de hoje não mude a cada café.
 */
export function dailyAllowance(s: Snapshot, todayDate: ISODate): DailyAllowance {
  const month = monthOf(todayDate);
  const upcoming = upcomingEntries(s, todayDate, lastDay(month));
  const spentToday = sum(
    s.transactions
      .filter(
        (t) =>
          t.status === 'realizada' && t.kind === 'despesa' && t.date === todayDate && !t.recurrenceId,
      )
      .map((t) => t.amount),
  );
  const available =
    currentBalance(s) +
    spentToday +
    sum(upcoming.map((e) => signed(e.kind, e.amount))) -
    s.settings.reserve;
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
  const realized = realizedTransactions(s);
  const now = currentBalance(s);

  const realizedByDay = new Map<ISODate, Entry[]>();
  for (const t of realized) {
    if (monthOf(t.date) !== month) continue;
    const list = realizedByDay.get(t.date) ?? [];
    list.push(txToEntry(t, todayDate, false));
    realizedByDay.set(t.date, list);
  }

  if (isPastMonth) {
    const days = monthDays(month).map((date) => ({
      date,
      entries: (realizedByDay.get(date) ?? []).sort(compareEntries),
      plannedSpending: 0,
      endBalance: balanceAt(s, date),
      isPast: true,
      isToday: false,
    }));
    const startBalance = balanceAt(s, makeDateBefore(firstDay(month)));
    return {
      month,
      days,
      startBalance,
      currentBalance: now,
      projectedEnd: days[days.length - 1].endBalance,
      futureIncome: 0,
      futureExpense: 0,
      plannedSpending: 0,
      lowest: lowestOf(days),
      isPastMonth: true,
    };
  }

  // projeção de hoje até o fim do mês escolhido.
  const upcoming = upcomingEntries(s, todayDate, lastDay(month));
  const upcomingByDay = new Map<ISODate, Entry[]>();
  for (const e of upcoming) {
    const list = upcomingByDay.get(e.date) ?? [];
    list.push(e);
    upcomingByDay.set(e.date, list);
  }

  let running = now;
  let startBalance = month === thisMonth ? balanceAt(s, makeDateBefore(firstDay(month))) : now;
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
            entries: (realizedByDay.get(date) ?? []).sort(compareEntries),
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
        const realizedToday = date === todayDate ? (realizedByDay.get(date) ?? []) : [];
        days.push({
          date,
          entries: [...realizedToday, ...future].sort(compareEntries),
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

/** último dia do mês anterior ao da data. */
function makeDateBefore(date: ISODate): ISODate {
  return lastDay(addMonths(monthOf(date), -1));
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
