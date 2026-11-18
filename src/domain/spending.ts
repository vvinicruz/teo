/**
 * gastos por categoria: quanto saiu em cada categoria no mês, com ou sem limite.
 * consumo = despesas realizadas na conta e no cartão, na data da compra (igual ao planejamento).
 * não entram: pagamento de fatura (a compra já foi contada), guardar na caixinha e transferências.
 */
import { monthOf, type ISODate, type MonthKey } from './dates';
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
