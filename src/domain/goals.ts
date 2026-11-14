/**
 * motivação para as metas: ritmo, previsão de chegada, sequência, marcos e lembretes.
 * tudo calculado a partir do que a pessoa realmente guardou — nada inventado.
 */
import { addMonths, daysInclusive, monthOf, type ISODate, type MonthKey } from './dates';
import { recurrenceEnd } from './finance';
import { goalSaved } from './investments';
import { sum, type Cents } from './money';
import type { Goal, Recurrence, Snapshot, Transaction } from './types';

export const MILESTONES = [25, 50, 75, 100] as const;

/** marco atingido para um progresso (0 a 1): 0, 25, 50, 75 ou 100. */
export function milestoneFor(progress: number): number {
  if (progress >= 1) return 100;
  return Math.floor(Math.max(0, progress) * 4) * 25;
}

/** guardar/resgatar da caixinha ligada à meta. */
function goalMoves(s: Snapshot, goal: Goal): Transaction[] {
  if (!goal.investmentId) return [];
  return s.transactions.filter((t) => t.investmentId === goal.investmentId && t.status === 'realizada');
}

/** "guardar todo mês" ativo para a caixinha da meta. */
export function goalPlan(s: Snapshot, goal: Goal, todayDate: ISODate): Recurrence | null {
  if (!goal.investmentId) return null;
  return (
    s.recurrences.find((r) => {
      if (r.investmentId !== goal.investmentId) return false;
      const end = recurrenceEnd(r);
      return !end || end >= todayDate;
    }) ?? null
  );
}

/**
 * quanto a pessoa guarda por mês para a meta:
 * o "guardar todo mês", se houver; senão, a média do que guardou nos últimos 3 meses.
 */
export function goalPace(s: Snapshot, goal: Goal, todayDate: ISODate): Cents | null {
  const plan = goalPlan(s, goal, todayDate);
  if (plan) return plan.amount;
  const moves = goalMoves(s, goal);
  if (!moves.length) return null;
  const since = addMonths(monthOf(todayDate), -2);
  const recent = moves.filter((t) => monthOf(t.date) >= since);
  if (!recent.length) return null;
  const first = recent.reduce((m, t) => (t.date < m ? t.date : m), recent[0].date);
  const months = Math.max(1, Math.min(3, monthsBetween(monthOf(first), monthOf(todayDate)) + 1));
  const net = sum(recent.map((t) => (t.kind === 'despesa' ? t.amount : -t.amount)));
  return net > 0 ? Math.round(net / months) : null;
}

function monthsBetween(a: MonthKey, b: MonthKey): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

export interface GoalForecast {
  saved: Cents;
  remaining: Cents;
  pace: Cents | null;
  /** mês em que chega lá, no ritmo atual. */
  etaMonth: MonthKey | null;
  /** quanto precisaria guardar por mês para chegar no prazo (se houver prazo). */
  neededPerMonth: Cents | null;
  /** no ritmo atual, chega até o prazo? */
  onTrack: boolean | null;
  /** sugestão: guardando um pouco a mais, quantos meses antes chega. */
  boost: { extra: Cents; monthsSooner: number } | null;
}

export function goalForecast(s: Snapshot, goal: Goal, todayDate: ISODate): GoalForecast {
  const saved = goalSaved(s, goal);
  const remaining = Math.max(0, goal.target - saved);
  const pace = goalPace(s, goal, todayDate);
  const thisMonth = monthOf(todayDate);
  const monthsNeeded = pace && remaining > 0 ? Math.ceil(remaining / pace) : null;
  const etaMonth = remaining === 0 ? thisMonth : monthsNeeded ? addMonths(thisMonth, monthsNeeded) : null;

  let neededPerMonth: Cents | null = null;
  let onTrack: boolean | null = null;
  if (goal.deadline && remaining > 0) {
    const monthsLeft = Math.max(1, monthsBetween(thisMonth, monthOf(goal.deadline)));
    neededPerMonth = Math.ceil(remaining / monthsLeft);
    onTrack = etaMonth ? etaMonth <= monthOf(goal.deadline) : false;
  }

  let boost: GoalForecast['boost'] = null;
  if (pace && monthsNeeded && monthsNeeded > 2) {
    // um empurrãozinho de ~20% do ritmo, arredondado para dezenas de reais.
    const extra = Math.max(2000, Math.ceil((pace * 0.2) / 1000) * 1000);
    const faster = Math.ceil(remaining / (pace + extra));
    if (monthsNeeded - faster >= 1) boost = { extra, monthsSooner: monthsNeeded - faster };
  }

  return { saved, remaining, pace, etaMonth, neededPerMonth, onTrack, boost };
}

/** meses em que a pessoa guardou algo para a meta. */
function contributionMonths(s: Snapshot, goal: Goal): Set<MonthKey> {
  if (!goal.investmentId) return new Set(goal.contributionMonths ?? []);
  const byMonth = new Map<MonthKey, number>();
  for (const t of goalMoves(s, goal)) {
    const m = monthOf(t.date);
    byMonth.set(m, (byMonth.get(m) ?? 0) + (t.kind === 'despesa' ? t.amount : -t.amount));
  }
  return new Set([...byMonth.entries()].filter(([, v]) => v > 0).map(([m]) => m));
}

/**
 * sequência: meses seguidos guardando para a meta. o mês atual ainda não conta como
 * "quebra" — a pessoa tem até o fim dele para guardar.
 */
export function goalStreak(s: Snapshot, goal: Goal, todayDate: ISODate): { months: number; thisMonth: boolean } {
  const months = contributionMonths(s, goal);
  const current = monthOf(todayDate);
  const thisMonth = months.has(current);
  let m = thisMonth ? current : addMonths(current, -1);
  let count = 0;
  while (months.has(m)) {
    count += 1;
    m = addMonths(m, -1);
  }
  return { months: count, thisMonth };
}

/** dias desde a última vez que guardou para a meta (ou desde que ela foi criada). */
export function daysSinceContribution(s: Snapshot, goal: Goal, todayDate: ISODate): number {
  let last: ISODate | null = null;
  if (goal.investmentId) {
    for (const t of goalMoves(s, goal)) if (t.kind === 'despesa' && (!last || t.date > last)) last = t.date;
  } else if (goal.lastContributionAt) {
    last = goal.lastContributionAt.slice(0, 10);
  }
  const from = last ?? goal.createdAt.slice(0, 10);
  if (!from || from > todayDate) return 0;
  return daysInclusive(from, todayDate) - 1;
}

/** dias sem guardar a partir dos quais o teo lembra, com carinho. */
export const NUDGE_AFTER_DAYS = 21;

/** a meta que mais merece um lembrete gentil agora (ou null). */
export function goalToNudge(s: Snapshot, todayDate: ISODate, dismissed: Set<string>): { goal: Goal; days: number } | null {
  let best: { goal: Goal; days: number } | null = null;
  for (const goal of s.goals) {
    if (dismissed.has(goal.id)) continue;
    if (goalSaved(s, goal) >= goal.target) continue;
    // quem tem "guardar todo mês" ativo já está no caminho.
    if (goalPlan(s, goal, todayDate)) continue;
    const days = daysSinceContribution(s, goal, todayDate);
    if (days >= NUDGE_AFTER_DAYS && (!best || days > best.days)) best = { goal, days };
  }
  return best;
}
