import { describe, expect, it } from 'vitest';
import { spendingByCategory } from '../spending';
import type { Category, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-12';
const cats: Category[] = [
  { id: 'lazer', name: 'lazer', icon: 'lazer', kind: 'despesa' },
  { id: 'mercado', name: 'mercado', icon: 'mercado', kind: 'despesa' },
  { id: 'saude', name: 'saúde', icon: 'saude', kind: 'despesa' },
];

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'vini', initialBalance: 0, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: cats,
    transactions: [],
    recurrences: [],
    budgets: [],
    goals: [],
    cards: [],
    investments: [],
    accounts: [],
    ...over,
  };
}
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`,
  kind: 'despesa',
  amount: 1000,
  description: 'x',
  categoryId: null,
  date: TODAY,
  status: 'realizada',
  paymentMethod: null,
  createdAt: '2026-11-01T00:00:00Z',
  ...p,
});

describe('gastos por categoria', () => {
  it('lazer com limite de r$ 1.000 e r$ 650 gastos: 65% usado, r$ 350 restantes', () => {
    const s = base({
      budgets: [{ id: 'b1', categoryId: 'lazer', amount: 100000 }],
      transactions: [tx({ categoryId: 'lazer', amount: 40000 }), tx({ categoryId: 'lazer', amount: 25000, cardId: 'c1' })],
    });
    const r = spendingByCategory(s, cats, '2026-11', TODAY);
    expect(r.withLimit).toHaveLength(1);
    expect(r.withLimit[0]).toMatchObject({ categoryId: 'lazer', spent: 65000, limit: 100000, available: 35000, over: 0, status: 'tranquilo' });
    expect(r.withLimit[0].ratio).toBeCloseTo(0.65);
  });

  it('categorias sem limite aparecem com o total, inclusive as sem gasto', () => {
    const s = base({ transactions: [tx({ categoryId: 'mercado', amount: 30000 }), tx({ categoryId: null, amount: 10000 })] });
    const r = spendingByCategory(s, cats, '2026-11', TODAY);
    expect(r.withoutLimit.map((c) => [c.categoryId, c.spent, c.limit])).toEqual([
      ['mercado', 30000, null],
      [null, 10000, null],
      ['lazer', 0, null],
      ['saude', 0, null],
    ]);
    expect(r.total).toBe(40000);
    expect(r.withoutLimit[0].share).toBeCloseTo(0.75);
  });

  it('perto do limite (80%+) e passou do limite', () => {
    const s = base({
      budgets: [
        { id: 'b1', categoryId: 'lazer', amount: 10000 },
        { id: 'b2', categoryId: 'mercado', amount: 10000 },
      ],
      transactions: [tx({ categoryId: 'lazer', amount: 8500 }), tx({ categoryId: 'mercado', amount: 12000 })],
    });
    const r = spendingByCategory(s, cats, '2026-11', TODAY);
    expect(r.withLimit.map((c) => [c.categoryId, c.status, c.over, c.available])).toEqual([
      ['mercado', 'passou', 2000, 0],
      ['lazer', 'atencao', 0, 1500],
    ]);
  });

  it('não conta pagamento de fatura, caixinha, transferência, receitas nem outros meses', () => {
    const s = base({
      transactions: [
        tx({ categoryId: 'lazer', amount: 5000 }),
        tx({ categoryId: 'lazer', amount: 9999, paysCardId: 'c1' }),
        tx({ categoryId: 'lazer', amount: 9999, investmentId: 'i1' }),
        tx({ categoryId: 'lazer', amount: 9999, transferId: 'x1' }),
        tx({ categoryId: 'lazer', amount: 9999, kind: 'receita' }),
        tx({ categoryId: 'lazer', amount: 9999, date: '2026-10-30' }),
        tx({ categoryId: 'lazer', amount: 9999, status: 'pendente', date: '2026-11-20' }),
      ],
    });
    const lazer = spendingByCategory(s, cats, '2026-11', TODAY).withoutLimit.find((c) => c.categoryId === 'lazer')!;
    expect(lazer.spent).toBe(5000);
    expect(lazer.transactions).toHaveLength(1);
    expect(lazer.committed).toBe(9999); // a pendente entra como prevista
  });

  it('o que ainda está previsto desconta do quanto ainda dá pra gastar', () => {
    const s = base({
      budgets: [{ id: 'b1', categoryId: 'saude', amount: 50000 }],
      transactions: [tx({ categoryId: 'saude', amount: 10000 })],
      recurrences: [
        { id: 'r1', kind: 'despesa', amount: 15000, description: 'academia', categoryId: 'saude', paymentMethod: null,
          dayOfMonth: 25, startMonth: '2026-01', skippedDates: [], createdAt: '' },
      ],
    });
    const saude = spendingByCategory(s, cats, '2026-11', TODAY).withLimit[0];
    expect(saude).toMatchObject({ spent: 10000, committed: 15000, available: 25000 });
  });

  it('categoria apagada conta como "sem categoria"', () => {
    const s = base({ transactions: [tx({ categoryId: 'sumiu', amount: 700 })] });
    const r = spendingByCategory(s, cats, '2026-11', TODAY);
    expect(r.withoutLimit[0]).toMatchObject({ categoryId: null, spent: 700 });
  });
});
