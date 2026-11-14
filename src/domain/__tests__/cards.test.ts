import { describe, expect, it } from 'vitest';
import {
  budgetProgress,
  cardInvoices,
  cardLimitUsed,
  currentBalance,
  dailyAllowance,
  horizon,
  invoiceOf,
  invoicePeriod,
  monthSummary,
  upcomingEntries,
} from '../finance';
import type { Card, Recurrence, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-14';

// nubank: fecha dia 3, vence dia 10.  inter: fecha dia 25, vence dia 5 do mês seguinte.
const nubank: Card = { id: 'nu', name: 'nubank', closingDay: 3, dueDay: 10, creditLimit: 300000, createdAt: '' };
const inter: Card = { id: 'in', name: 'inter', closingDay: 25, dueDay: 5, creditLimit: null, createdAt: '' };

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'v', initialBalance: 500000, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [],
    transactions: [],
    recurrences: [],
    budgets: [],
    goals: [],
    cards: [nubank, inter],
    ...over,
  };
}

let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, kind: 'despesa', amount: 1000, description: 'x', categoryId: null, date: TODAY,
  status: 'realizada', paymentMethod: null, createdAt: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`, ...p,
});
const rec = (p: Partial<Recurrence>): Recurrence => ({
  id: `r${++n}`, kind: 'despesa', amount: 5590, description: 'streaming', categoryId: 'assinaturas', paymentMethod: null,
  dayOfMonth: 8, startMonth: '2026-11', occurrences: null, skippedDates: [], createdAt: '', ...p,
});

describe('ciclo da fatura', () => {
  it('compra até o fechamento entra na fatura do mês; depois, na seguinte', () => {
    expect(invoiceOf(nubank, '2026-11-03')).toEqual({ closingDate: '2026-11-03', dueDate: '2026-11-10' });
    expect(invoiceOf(nubank, '2026-11-04')).toEqual({ closingDate: '2026-12-03', dueDate: '2026-12-10' });
  });
  it('vencimento "antes" do fechamento cai no mês seguinte', () => {
    expect(invoiceOf(inter, '2026-11-14')).toEqual({ closingDate: '2026-11-25', dueDate: '2026-12-05' });
    expect(invoiceOf(inter, '2026-11-26')).toEqual({ closingDate: '2026-12-25', dueDate: '2027-01-05' });
  });
  it('dias que não existem no mês usam o último dia', () => {
    const c: Card = { ...nubank, closingDay: 31, dueDay: 8 };
    expect(invoiceOf(c, '2027-02-27')).toEqual({ closingDate: '2027-02-28', dueDate: '2027-03-08' });
  });
  it('período de compras de uma fatura', () => {
    expect(invoicePeriod(nubank, '2026-12-10')).toEqual({ start: '2026-11-04', closingDate: '2026-12-03' });
    expect(invoicePeriod(inter, '2026-12-05')).toEqual({ start: '2026-10-26', closingDate: '2026-11-25' });
  });
});

describe('compras no cartão e o saldo', () => {
  it('compra no cartão não mexe no saldo, mas vira fatura prevista no vencimento', () => {
    const s = base({ transactions: [tx({ amount: 12000, cardId: 'nu', categoryId: 'alimentacao' })] });
    expect(currentBalance(s)).toBe(500000);
    const up = upcomingEntries(s, TODAY, '2026-12-31');
    expect(up).toHaveLength(1);
    expect(up[0]).toMatchObject({ description: 'fatura nubank', amount: 12000, originalDate: '2026-12-10', invoiceDate: '2026-12-10' });
    expect(horizon(s, '2026-12', TODAY).days.find((d) => d.date === '2026-12-10')?.endBalance).toBe(488000);
  });

  it('pagar a fatura substitui a previsão (nada duplicado)', () => {
    const compra = tx({ amount: 12000, cardId: 'nu' });
    const pagamento = tx({ amount: 12000, date: '2026-12-10', status: 'realizada', paysCardId: 'nu', invoiceDate: '2026-12-10', description: 'fatura nubank' });
    const s = base({ transactions: [compra, pagamento] });
    expect(upcomingEntries(s, '2026-12-11', '2026-12-31')).toHaveLength(0);
    expect(currentBalance(s)).toBe(488000);
    expect(cardInvoices(s, nubank, '2026-12-31', '2026-12-11')[0].status).toBe('paga');
  });

  it('estorno no cartão abate da fatura', () => {
    const s = base({
      transactions: [tx({ amount: 20000, cardId: 'in' }), tx({ kind: 'receita', amount: 5000, cardId: 'in', description: 'estorno' })],
    });
    expect(cardInvoices(s, inter, '2026-12-31', TODAY)[0].total).toBe(15000);
  });

  it('assinatura no cartão entra na fatura, não na conta', () => {
    const s = base({ recurrences: [rec({ cardId: 'nu', dayOfMonth: 20 })] });
    const up = upcomingEntries(s, TODAY, '2026-12-31');
    expect(up.map((e) => e.description)).toEqual(['fatura nubank']);
    expect(up[0].amount).toBe(5590);
    // e não fica "a confirmar" sozinha quando passa da data
    expect(upcomingEntries(s, '2026-11-25', '2026-11-30').filter((e) => e.overdue)).toHaveLength(0);
  });

  it('fatura vencida e não paga fica "a confirmar"', () => {
    const s = base({ transactions: [tx({ amount: 8000, cardId: 'nu', date: '2026-11-02' })] });
    const up = upcomingEntries(s, TODAY, TODAY);
    expect(up[0]).toMatchObject({ overdue: true, originalDate: '2026-11-10', date: TODAY });
  });

  it('fatura que venceu antes de começar no teo é ignorada', () => {
    const s = base({ transactions: [tx({ amount: 8000, cardId: 'nu', date: '2026-10-01' })] });
    expect(upcomingEntries(s, TODAY, '2026-12-31')).toHaveLength(0);
  });

  it('resumo do mês olha a conta; a fatura entra como saída prevista', () => {
    const s = base({ transactions: [tx({ amount: 12000, cardId: 'nu' }), tx({ amount: 3000 })] });
    const nov = monthSummary(s, '2026-11', TODAY);
    expect(nov.expense).toBe(3000);
    const dez = monthSummary(s, '2026-12', TODAY);
    expect(dez.pendingExpense).toBe(12000);
  });
});

describe('planejamento com cartão', () => {
  it('compra no cartão conta no planejamento; pagamento da fatura não conta de novo', () => {
    const s = base({
      budgets: [{ id: 'b', categoryId: 'alimentacao', amount: 50000 }],
      transactions: [
        tx({ amount: 12000, cardId: 'nu', categoryId: 'alimentacao', date: '2026-11-05' }),
        tx({ amount: 12000, paysCardId: 'nu', invoiceDate: '2026-11-10', date: '2026-11-10', categoryId: null }),
      ],
    });
    const [p] = budgetProgress(s, '2026-11', TODAY);
    expect(p.spent).toBe(12000);
  });
});

describe('dá pra gastar por dia com cartão', () => {
  it('compra de hoje no cartão reduz o "ainda dá hoje", não o valor por dia', () => {
    const s0 = base({ cards: [{ ...nubank, closingDay: 20, dueDay: 28 }], transactions: [] });
    const s1 = base({
      cards: [{ ...nubank, closingDay: 20, dueDay: 28 }],
      transactions: [tx({ amount: 4000, cardId: 'nu' })], // vence 28/11, dentro do mês
    });
    expect(dailyAllowance(s1, TODAY).perDay).toBe(dailyAllowance(s0, TODAY).perDay);
    expect(dailyAllowance(s1, TODAY).leftToday).toBe(dailyAllowance(s0, TODAY).perDay - 4000);
  });
  it('compra antiga no cartão com fatura no mês reduz o valor por dia', () => {
    const card = { ...nubank, closingDay: 20, dueDay: 28 };
    const s0 = base({ cards: [card] });
    const s1 = base({ cards: [card], transactions: [tx({ amount: 17000, cardId: 'nu', date: '2026-11-05' })] });
    expect(dailyAllowance(s1, TODAY).available).toBe(dailyAllowance(s0, TODAY).available - 17000);
  });
});

describe('limite', () => {
  it('soma faturas não pagas (sem previsões)', () => {
    const s = base({
      transactions: [tx({ amount: 10000, cardId: 'nu' }), tx({ amount: 5000, cardId: 'nu', date: '2026-12-20' })],
      recurrences: [rec({ cardId: 'nu' })],
    });
    expect(cardLimitUsed(s, nubank, TODAY)).toBe(15000);
  });
});
