import { describe, expect, it } from 'vitest';
import { estimateRevolving, formatRate } from '../interest';

describe('estimativa do rotativo', () => {
  it('calcula juros do mês + iof', () => {
    const e = estimateRevolving(100000, 15);
    expect(e.interest).toBe(15000);
    expect(e.iof).toBe(626);
    expect(e.cost).toBe(15626);
    expect(e.nextInvoiceImpact).toBe(115626);
  });
  it('respeita o teto legal de 100% da dívida', () => {
    expect(estimateRevolving(10000, 150).cost).toBe(10000);
  });
  it('nada a estimar quando não falta pagar', () => {
    expect(estimateRevolving(0, 15).cost).toBe(0);
  });
  it('formata a taxa em português', () => {
    expect(formatRate(13.38)).toBe('13,38%');
    expect(formatRate(14)).toBe('14%');
  });
});
