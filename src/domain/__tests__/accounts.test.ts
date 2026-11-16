import { describe, expect, it } from 'vitest';
import { accountBalance, budgetProgress, currentBalance, monthSummary } from '../finance';
import type { Snapshot, Transaction } from '../types';

const TODAY = '2026-11-16';
function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'v', initialBalance: 100000, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], budgets: [{ id: 'b', categoryId: 'mercado', amount: 50000 }], goals: [], cards: [], investments: [],
    accounts: [{ id: 'itau', name: 'itaú', initialBalance: 50000, createdAt: '' }],
    ...over,
  };
}
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, kind: 'despesa', amount: 1000, description: 'x', categoryId: null, date: TODAY, status: 'realizada', paymentMethod: null, createdAt: '', ...p,
});

describe('várias contas', () => {
  it('cada conta tem seu saldo; o total soma todas', () => {
    const s = base({ transactions: [tx({ amount: 3000, categoryId: 'mercado' }), tx({ amount: 2000, accountId: 'itau', categoryId: 'mercado' })] });
    expect(accountBalance(s, null)).toBe(97000);
    expect(accountBalance(s, 'itau')).toBe(48000);
    expect(currentBalance(s)).toBe(145000);
    expect(budgetProgress(s, '2026-11', TODAY)[0].spent).toBe(5000);
  });

  it('transferência entre contas muda os saldos, mas não é gasto nem receita', () => {
    const s = base({
      transactions: [
        tx({ amount: 20000, transferId: 'x', description: 'para itaú' }),
        tx({ kind: 'receita', amount: 20000, transferId: 'x', accountId: 'itau', description: 'da conta principal' }),
      ],
    });
    expect(accountBalance(s, null)).toBe(80000);
    expect(accountBalance(s, 'itau')).toBe(70000);
    expect(currentBalance(s)).toBe(150000);
    expect(monthSummary(s, '2026-11', TODAY)).toMatchObject({ income: 0, expense: 0 });
  });
});
