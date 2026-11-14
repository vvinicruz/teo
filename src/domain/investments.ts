/**
 * dinheiro guardado (caixinhas, cdb, poupança, tesouro selic).
 *
 * - o saldo de uma caixinha = último valor informado + o que foi guardado − o que foi
 *   resgatado depois disso.
 * - guardar/resgatar são lançamentos da conta ligados à caixinha: mexem no saldo da conta,
 *   mas não são gasto nem receita (não entram em planejamento nem em "entrou/saiu no mês").
 * - o rendimento é sempre uma estimativa, com cdi/selic do banco central, antes do imposto.
 */
import { sum, type Cents } from './money';
import type { Goal, Investment, Snapshot, Transaction } from './types';

/** guardar/resgatar feitos depois do último valor informado. */
function movesAfterUpdate(s: Snapshot, inv: Investment): Transaction[] {
  return s.transactions.filter(
    (t) => t.investmentId === inv.id && t.status === 'realizada' && t.createdAt > inv.balanceUpdatedAt,
  );
}

export function investmentBalance(s: Snapshot, inv: Investment): Cents {
  const moves = movesAfterUpdate(s, inv);
  // guardar = despesa da conta (entra na caixinha); resgatar = receita da conta (sai da caixinha).
  const delta = sum(moves.map((t) => (t.kind === 'despesa' ? t.amount : -t.amount)));
  return Math.max(0, inv.balance + delta);
}

export function totalInvested(s: Snapshot): Cents {
  return sum(s.investments.filter((i) => !i.archived).map((i) => investmentBalance(s, i)));
}

export interface MarketRates {
  /** cdi anualizado, em % ao ano (ex.: 13.65). */
  cdiAnnual: number;
  /** meta da selic, em % ao ano. */
  selicAnnual: number;
}

/**
 * rendimento estimado ao mês, em % (antes do imposto de renda).
 * - poupança: 0,5% ao mês quando a selic está acima de 8,5% ao ano; senão, 70% da selic (+ tr, ignorada).
 * - tesouro selic: acompanha a selic.
 * - caixinha/cdb/outro: % do cdi informado.
 */
export function monthlyYieldPct(inv: Investment, rates: MarketRates): number | null {
  const monthly = (annualPct: number) => (Math.pow(1 + annualPct / 100, 1 / 12) - 1) * 100;
  if (inv.kind === 'poupanca') {
    return rates.selicAnnual > 8.5 ? 0.5 : monthly(rates.selicAnnual * 0.7);
  }
  if (inv.kind === 'tesouro') return monthly(rates.selicAnnual) * ((inv.cdiPercent ?? 100) / 100);
  if (inv.cdiPercent == null) return null;
  // % do cdi aplica sobre a taxa diária; para valores comuns, aplicar sobre a mensal é uma boa aproximação.
  return monthly(rates.cdiAnnual) * (inv.cdiPercent / 100);
}

/** quanto deve render em um mês (estimativa, antes do imposto). */
export function monthlyYield(balance: Cents, inv: Investment, rates: MarketRates): Cents | null {
  const pct = monthlyYieldPct(inv, rates);
  return pct == null ? null : Math.round((balance * pct) / 100);
}

/** quanto a meta já tem: o saldo da caixinha ligada, ou o valor guardado na própria meta. */
export function goalSaved(s: Snapshot, goal: Goal): Cents {
  if (goal.investmentId) {
    const inv = s.investments.find((i) => i.id === goal.investmentId);
    if (inv) return investmentBalance(s, inv);
  }
  return goal.saved;
}
