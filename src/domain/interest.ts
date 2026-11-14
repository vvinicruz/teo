/**
 * juros do rotativo do cartão.
 *
 * quando a fatura não é paga inteira, o que falta vira crédito rotativo e vai para a
 * próxima fatura com juros + iof. o teo estima esse custo para avisar a pessoa — sempre
 * como estimativa, porque a taxa real depende do contrato de cada cliente.
 *
 * regras usadas (lei 14.690/2023 e resolução cmn 5.112/2023):
 * - o rotativo dura no máximo até a próxima fatura; depois o banco precisa oferecer parcelamento.
 * - juros e encargos não podem passar de 100% do valor devido.
 */
import type { Cents } from './money';

/** iof de crédito para pessoa física: 0,38% fixo + 0,0082% ao dia. */
export const IOF_FIXED = 0.0038;
export const IOF_DAILY = 0.000082;

export interface RevolvingEstimate {
  /** quanto ficou faltando pagar. */
  remaining: Cents;
  /** juros estimados até a próxima fatura. */
  interest: Cents;
  /** iof estimado. */
  iof: Cents;
  /** juros + iof. */
  cost: Cents;
  /** o que deve aparecer na próxima fatura por causa disso (falta + custo). */
  nextInvoiceImpact: Cents;
}

/**
 * estima o custo de deixar `remaining` no rotativo por um mês.
 * `monthlyRatePct` em % ao mês (ex.: 13.38).
 */
export function estimateRevolving(remaining: Cents, monthlyRatePct: number, days = 30): RevolvingEstimate {
  if (remaining <= 0) return { remaining: 0, interest: 0, iof: 0, cost: 0, nextInvoiceImpact: 0 };
  const interest = Math.round(remaining * (monthlyRatePct / 100) * (days / 30));
  const iof = Math.round(remaining * (IOF_FIXED + IOF_DAILY * days));
  // teto legal: juros e encargos não passam de 100% da dívida.
  const cost = Math.min(interest + iof, remaining);
  return { remaining, interest, iof, cost, nextInvoiceImpact: remaining + cost };
}

/** formata uma taxa: 13.38 → "13,38%". */
export function formatRate(pct: number): string {
  return `${pct.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}
