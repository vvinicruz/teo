import { describe, expect, it } from 'vitest';
import { budgetProgress, currentBalance, dailyAllowance, monthSummary } from '../finance';
import { goalSaved, investmentBalance, monthlyYield, monthlyYieldPct, totalInvested } from '../investments';
import type { Investment, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-14';
const caixinha: Investment = {
  id: 'cx', name: 'caixinha nubank', kind: 'caixinha', cdiPercent: 100, balance: 400000,
  balanceUpdatedAt: '2026-11-10T12:00:00.000Z', createdAt: '2026-11-10T12:00:00.000Z',
};

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'v', initialBalance: 300000, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], goals: [], cards: [], investments: [caixinha],
    budgets: [{ id: 'b', categoryId: 'alimentacao', amount: 50000 }],
    ...over,
  };
}
let n = 0;
const mov = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, kind: 'despesa', amount: 50000, description: 'guardar', categoryId: null, date: TODAY,
  status: 'realizada', paymentMethod: null, investmentId: 'cx', createdAt: `2026-11-14T10:00:0${n % 10}.000Z`, ...p,
});

describe('caixinhas', () => {
  it('guardar tira da conta e soma na caixinha; resgatar faz o contrário', () => {
    const s = base({ transactions: [mov({ amount: 50000 }), mov({ kind: 'receita', amount: 20000, description: 'resgatar' })] });
    expect(currentBalance(s)).toBe(300000 - 50000 + 20000);
    expect(investmentBalance(s, caixinha)).toBe(400000 + 50000 - 20000);
    expect(totalInvested(s)).toBe(430000);
  });

  it('atualizar o valor considera só o que veio depois', () => {
    const antes = mov({ amount: 50000, createdAt: '2026-11-09T00:00:00.000Z' });
    const s = base({ transactions: [antes] });
    expect(investmentBalance(s, caixinha)).toBe(400000);
  });

  it('guardar não é gasto: fora do "saiu no mês", do planejamento e do "gasto de hoje"', () => {
    const s = base({ transactions: [mov({ amount: 50000, categoryId: 'alimentacao' })] });
    expect(monthSummary(s, '2026-11', TODAY).expense).toBe(0);
    expect(budgetProgress(s, '2026-11', TODAY)[0].spent).toBe(0);
    expect(dailyAllowance(s, TODAY).spentToday).toBe(0);
    // mas o dinheiro saiu da conta, então sobra menos para o dia a dia
    expect(dailyAllowance(s, TODAY).available).toBe(250000);
  });

  it('rendimento estimado: % do cdi, poupança e tesouro selic', () => {
    const rates = { cdiAnnual: 13.65, selicAnnual: 13.75 };
    expect(monthlyYieldPct(caixinha, rates)!).toBeCloseTo(1.072, 3);
    expect(monthlyYield(400000, caixinha, rates)).toBe(4288);
    expect(monthlyYieldPct({ ...caixinha, kind: 'poupanca' }, rates)).toBe(0.5);
    expect(monthlyYieldPct({ ...caixinha, kind: 'poupanca' }, { cdiAnnual: 7, selicAnnual: 7 })!).toBeCloseTo(0.3994, 3);
    expect(monthlyYieldPct({ ...caixinha, kind: 'tesouro', cdiPercent: null }, rates)!).toBeCloseTo(1.0794, 3);
    expect(monthlyYield(400000, { ...caixinha, cdiPercent: null }, rates)).toBeNull();
  });

  it('meta ligada à caixinha acompanha o saldo dela', () => {
    const s = base({ transactions: [mov({ amount: 10000 })] });
    const goal = { id: 'g', name: 'viagem', icon: 'viagem', target: 500000, saved: 0, investmentId: 'cx', createdAt: '' };
    expect(goalSaved(s, goal)).toBe(410000);
    expect(goalSaved(s, { ...goal, investmentId: null, saved: 1234 })).toBe(1234);
  });
});
