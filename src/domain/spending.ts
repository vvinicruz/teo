/**
 * gastos por categoria: quanto saiu em cada categoria no mês, com ou sem limite.
 * consumo = despesas realizadas na conta e no cartão, na data da compra (igual ao planejamento).
 * não entram: pagamento de fatura (a compra já foi contada), guardar na caixinha e transferências.
 */
import { addMonths, monthName, monthOf, type ISODate, type MonthKey } from './dates';
import { upcomingConsumption, type BudgetStatus } from './finance';
import { sum, type Cents } from './money';
import type { Category, Snapshot, Transaction } from './types';

export interface CategorySpending {
  /** categoria (vazio = sem categoria). */
  categoryId: string | null;
  /** gasto no mês (conta + cartão). */
  spent: Cents;
  /** ainda previsto no mês nessa categoria (contas fixas, parcelas...). */
  committed: Cents;
  /** limite mensal (vazio = sem limite). */
  limit: Cents | null;
  /** gasto / limite (0 quando não há limite). */
  ratio: number;
  /** quanto ainda dá pra gastar: limite − gasto − previsto (mínimo 0). vazio = sem limite. */
  available: Cents | null;
  /** quanto passou do limite (0 quando não passou). */
  over: Cents;
  /** situação em relação ao limite. vazio = sem limite. */
  status: BudgetStatus | null;
  /** parte do total gasto no mês (0 a 1). */
  share: number;
  /** despesas do mês nessa categoria, da mais recente para a mais antiga. */
  transactions: Transaction[];
}

export interface SpendingReport {
  month: MonthKey;
  /** total gasto no mês, em todas as categorias. */
  total: Cents;
  /** total ainda previsto no mês. */
  committed: Cents;
  /** soma dos limites definidos. */
  planned: Cents;
  /** gasto nas categorias que têm limite. */
  spentPlanned: Cents;
  /** categorias com limite (as que mais usaram o limite primeiro). */
  withLimit: CategorySpending[];
  /** categorias sem limite (as que mais gastaram primeiro; sem gasto no fim). */
  withoutLimit: CategorySpending[];
}

/** a partir de quanto do limite usado mostramos "perto do limite". */
export const NEAR_LIMIT = 0.8;

export function limitStatus(ratio: number): BudgetStatus {
  return ratio > 1 ? 'passou' : ratio >= NEAR_LIMIT ? 'atencao' : 'tranquilo';
}

/** despesas que contam como gasto do mês. */
export function monthExpenses(s: Snapshot, month: MonthKey): Transaction[] {
  return s.transactions.filter(
    (t) =>
      t.status === 'realizada' &&
      t.kind === 'despesa' &&
      !t.paysCardId &&
      !t.investmentId &&
      !t.transferId &&
      monthOf(t.date) === month,
  );
}

/**
 * gastos do mês por categoria. mostra todas as categorias de despesa (mesmo sem gasto),
 * as arquivadas que tiveram gasto no mês e "sem categoria" quando houver.
 */
export function spendingByCategory(
  s: Snapshot,
  categories: Category[],
  month: MonthKey,
  todayDate: ISODate,
): SpendingReport {
  const expenses = monthExpenses(s, month);
  const upcoming = upcomingConsumption(s, month, todayDate).filter((e) => e.kind === 'despesa');
  const total = sum(expenses.map((t) => t.amount));
  const limits = new Map(s.budgets.filter((b) => b.amount > 0).map((b) => [b.categoryId, b.amount]));

  // categoria apagada conta como "sem categoria"
  const known = new Set(s.categories.map((c) => c.id));
  const resolve = (id?: string | null) => (id && known.has(id) ? id : null);
  const keys = new Set<string | null>([...categories.map((c) => c.id), ...expenses.map((t) => resolve(t.categoryId))]);
  for (const id of limits.keys()) if (known.has(id)) keys.add(id);

  const rows: CategorySpending[] = [];
  for (const key of keys) {
    const mine = expenses.filter((t) => resolve(t.categoryId) === key);
    const spent = sum(mine.map((t) => t.amount));
    if (key === null && spent === 0) continue;
    const committed = sum(upcoming.filter((e) => resolve(e.categoryId) === key).map((e) => e.amount));
    const limit = key ? (limits.get(key) ?? null) : null;
    const ratio = limit ? spent / limit : 0;
    rows.push({
      categoryId: key,
      spent,
      committed,
      limit,
      ratio,
      available: limit ? Math.max(0, limit - spent - committed) : null,
      over: limit ? Math.max(0, spent - limit) : 0,
      status: limit ? limitStatus(ratio) : null,
      share: total ? spent / total : 0,
      transactions: [...mine].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date))),
    });
  }

  const withLimit = rows.filter((r) => r.limit).sort((a, b) => b.ratio - a.ratio || b.spent - a.spent);
  const withoutLimit = rows.filter((r) => !r.limit).sort((a, b) => b.spent - a.spent);
  return {
    month,
    total,
    committed: sum(upcoming.map((e) => e.amount)),
    planned: sum(withLimit.map((r) => r.limit ?? 0)),
    spentPlanned: sum(withLimit.map((r) => r.spent)),
    withLimit,
    withoutLimit,
  };
}

// ---------- detalhes de uma categoria: histórico, comparação e avisos ----------

/** categoria de um lançamento (categoria apagada conta como "sem categoria"). */
function categoryKey(s: Snapshot, id?: string | null): string | null {
  return id && s.categories.some((c) => c.id === id) ? id : null;
}

/** quanto saiu numa categoria no mês (até um dia, se informado). */
export function spentIn(s: Snapshot, categoryId: string | null, month: MonthKey, untilDay?: number): Cents {
  return sum(
    monthExpenses(s, month)
      .filter((t) => categoryKey(s, t.categoryId) === categoryId)
      .filter((t) => untilDay === undefined || Number(t.date.slice(8, 10)) <= untilDay)
      .map((t) => t.amount),
  );
}

/** gastos de uma categoria num mês, do mais recente para o mais antigo. */
export function categoryExpenses(s: Snapshot, categoryId: string | null, month: MonthKey): Transaction[] {
  return monthExpenses(s, month)
    .filter((t) => categoryKey(s, t.categoryId) === categoryId)
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

export interface MonthSpending {
  month: MonthKey;
  spent: Cents;
  /** o mês tem algum gasto registrado (em qualquer categoria)? meses sem nada não entram nas comparações. */
  active: boolean;
}

/** gastos de uma categoria nos últimos `count` meses, terminando em `month` (do mais antigo ao mais novo). */
export function categoryHistory(s: Snapshot, categoryId: string | null, month: MonthKey, count = 6): MonthSpending[] {
  const out: MonthSpending[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const m = addMonths(month, -i);
    out.push({ month: m, spent: spentIn(s, categoryId, m), active: monthExpenses(s, m).length > 0 });
  }
  return out;
}

export interface SpendingInsight {
  tone: 'bom' | 'atencao' | 'neutro';
  text: string;
}

/**
 * avisos sobre uma categoria num mês, comparando com o mês anterior e com o limite.
 * no mês atual (ainda em andamento) a comparação é com o mesmo período do mês passado.
 */
export function categoryInsights(
  s: Snapshot,
  categoryId: string | null,
  name: string,
  month: MonthKey,
  todayDate: ISODate,
  money: (c: Cents) => string,
): SpendingInsight[] {
  const out: SpendingInsight[] = [];
  const limit = categoryId ? (s.budgets.find((b) => b.categoryId === categoryId && b.amount > 0)?.amount ?? null) : null;
  const current = monthOf(todayDate);
  const partial = month === current;
  const day = Number(todayDate.slice(8, 10));
  const prev = addMonths(month, -1);

  // limite: como foram os últimos meses fechados
  if (limit) {
    const closed = categoryHistory(s, categoryId, partial ? prev : month, 3).filter((m) => m.active);
    const over = closed.filter((m) => m.spent > limit).length;
    if (closed.length >= 2 && over === closed.length) {
      out.push({
        tone: 'atencao',
        text: `cuidado: nos últimos ${closed.length} meses você passou do limite de ${name} todas as vezes. que tal rever o limite ou esses gastos?`,
      });
    } else if (over >= 2) {
      out.push({
        tone: 'atencao',
        text: `cuidado: em ${over} dos últimos ${closed.length} meses você passou do limite de ${name}.`,
      });
    } else if (closed.length >= 2 && over === 0) {
      out.push({ tone: 'bom', text: `você ficou dentro do limite nos últimos ${closed.length} meses. muito bem!` });
    }
  }

  // comparação com o mês anterior
  const prevActive = monthExpenses(s, prev).length > 0;
  if (prevActive) {
    const now = spentIn(s, categoryId, month, partial ? day : undefined);
    const before = spentIn(s, categoryId, prev, partial ? day : undefined);
    const ref = partial ? `até o dia ${day} do mês passado` : `em ${monthName(prev)}`;
    const diff = now - before;
    if (before > 0 && diff < 0) {
      out.push({ tone: 'bom', text: `muito bem! você gastou ${money(-diff)} a menos que ${ref}. isso é ótimo!` });
    } else if (diff > 0 && (before === 0 || diff > before * 0.1)) {
      out.push({
        tone: limit && now > limit ? 'atencao' : 'neutro',
        text: before === 0 ? `${ref} você não tinha gasto nada com ${name}.` : `você gastou ${money(diff)} a mais que ${ref}.`,
      });
    } else if (before > 0) {
      out.push({ tone: 'neutro', text: `você está gastando parecido com ${ref}.` });
    }
  }
  return out;
}
