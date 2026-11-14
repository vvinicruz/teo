import { describe, expect, it } from 'vitest';
import {
  budgetProgress,
  currentBalance,
  dailyAllowance,
  horizon,
  monthSummary,
  overdueEntries,
  recurrenceOccurrences,
  upcomingEntries,
} from '../finance';
import { formatMoney, parseMoney, centsFromDigits } from '../money';
import { addMonths, daysInclusive, monthDays } from '../dates';
import type { Recurrence, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-12';

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: {
      name: 'vini',
      initialBalance: 100000, // R$ 1.000,00
      initialBalanceDate: '2026-11-01',
      reserve: 0,
      hideValues: false,
      onboarded: true,
    },
    categories: [],
    transactions: [],
    recurrences: [],
    budgets: [],
    goals: [],
    cards: [],
    ...over,
  };
}

let n = 0;
function tx(p: Partial<Transaction>): Transaction {
  n += 1;
  return {
    id: `t${n}`,
    kind: 'despesa',
    amount: 1000,
    description: 'x',
    categoryId: null,
    date: TODAY,
    status: 'realizada',
    paymentMethod: null,
    createdAt: '2026-11-01T00:00:00Z',
    ...p,
  };
}

function rec(p: Partial<Recurrence>): Recurrence {
  n += 1;
  return {
    id: `r${n}`,
    kind: 'despesa',
    amount: 50000,
    description: 'aluguel',
    categoryId: 'moradia',
    paymentMethod: null,
    dayOfMonth: 20,
    startMonth: '2026-11',
    occurrences: null,
    skippedDates: [],
    createdAt: '2026-11-01T00:00:00Z',
    ...p,
  };
}

describe('dinheiro', () => {
  it('formata no padrão brasileiro', () => {
    expect(formatMoney(123456)).toBe('R$ 1.234,56');
    expect(formatMoney(0)).toBe('R$ 0,00');
    expect(formatMoney(-500)).toBe('- R$ 5,00');
    expect(formatMoney(500, { sign: true })).toBe('+ R$ 5,00');
  });
  it('lê valores digitados', () => {
    expect(parseMoney('1.234,56')).toBe(123456);
    expect(parseMoney('12,5')).toBe(1250);
    expect(parseMoney('R$ 80')).toBe(8000);
    expect(parseMoney('')).toBeNull();
    expect(centsFromDigits('12345')).toBe(12345);
  });
});

describe('datas', () => {
  it('conta dias e meses corretamente', () => {
    expect(daysInclusive('2026-11-12', '2026-11-30')).toBe(19);
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(monthDays('2028-02')).toHaveLength(29);
  });
});

describe('saldo atual', () => {
  it('soma só o que foi realizado', () => {
    const s = base({
      transactions: [
        tx({ kind: 'receita', amount: 50000 }),
        tx({ amount: 20000 }),
        tx({ amount: 99999, status: 'pendente', date: '2026-11-20' }),
      ],
    });
    expect(currentBalance(s)).toBe(100000 + 50000 - 20000);
  });
});

describe('recorrências', () => {
  it('usa o último dia em meses curtos e respeita parcelas', () => {
    const r = rec({ dayOfMonth: 31, startMonth: '2027-01', occurrences: 3 });
    const occ = recurrenceOccurrences(r, '2027-01-01', '2027-12-31');
    expect(occ.map((o) => o.date)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('não duplica quando a ocorrência é registrada como realizada', () => {
    const r = rec({ dayOfMonth: 20, amount: 50000 });
    const before = base({ recurrences: [r] });
    expect(upcomingEntries(before, TODAY, '2026-11-30')).toHaveLength(1);

    const after = base({
      recurrences: [r],
      transactions: [
        tx({ amount: 52000, recurrenceId: r.id, occurrenceDate: '2026-11-20', date: TODAY }),
      ],
    });
    expect(upcomingEntries(after, TODAY, '2026-11-30')).toHaveLength(0);
    const h = horizon(after, '2026-11', TODAY);
    // saldo previsto = 1000 - 520 (valor real, não 500 + 520)
    expect(h.projectedEnd).toBe(100000 - 52000);
  });

  it('pular uma ocorrência remove só aquela previsão', () => {
    const r = rec({ skippedDates: ['2026-12-20'] });
    const occ = recurrenceOccurrences(r, '2026-11-01', '2027-01-31');
    expect(occ.map((o) => o.date)).toEqual(['2026-11-20', '2027-01-20']);
  });

  it('previsão passada não confirmada fica "a confirmar" e conta a partir de hoje', () => {
    const salario = rec({ kind: 'receita', amount: 300000, dayOfMonth: 5, description: 'salário' });
    const s = base({ recurrences: [salario] });
    const overdue = overdueEntries(s, TODAY);
    expect(overdue).toHaveLength(1);
    expect(overdue[0].date).toBe(TODAY);
    expect(overdue[0].originalDate).toBe('2026-11-05');
    expect(currentBalance(s)).toBe(100000); // não entra no saldo atual
    expect(horizon(s, '2026-11', TODAY).projectedEnd).toBe(400000);
  });

  it('ignora ocorrências anteriores ao início do uso', () => {
    const r = rec({ startMonth: '2026-01', dayOfMonth: 10 });
    const s = base({ recurrences: [r] });
    // outubro e antes já estão no saldo inicial; novembro dia 10 (< hoje) fica a confirmar
    expect(overdueEntries(s, TODAY).map((e) => e.originalDate)).toEqual(['2026-11-10']);
  });
});

describe('planejamento e o exemplo do mercado', () => {
  it('gastar 120 com 80 planejados entra na projeção sem duplicar', () => {
    const budgets = [{ id: 'b1', categoryId: 'alimentacao', amount: 8000 }];
    const planned = base({ budgets });
    const h1 = horizon(planned, '2026-11', TODAY);
    expect(h1.plannedSpending).toBe(8000);
    expect(h1.projectedEnd).toBe(100000 - 8000);

    const spent = base({
      budgets,
      transactions: [tx({ amount: 12000, categoryId: 'alimentacao', description: 'mercado' })],
    });
    const h2 = horizon(spent, '2026-11', TODAY);
    expect(h2.plannedSpending).toBe(0);
    expect(h2.projectedEnd).toBe(100000 - 12000);

    const [p] = budgetProgress(spent, '2026-11', TODAY);
    expect(p.status).toBe('passou');
    expect(p.remaining).toBe(0);
  });

  it('gasto parcial reduz o planejado restante', () => {
    const s = base({
      budgets: [{ id: 'b1', categoryId: 'alimentacao', amount: 8000 }],
      transactions: [tx({ amount: 3000, categoryId: 'alimentacao' })],
    });
    const h = horizon(s, '2026-11', TODAY);
    expect(h.plannedSpending).toBe(5000);
    expect(h.projectedEnd).toBe(100000 - 3000 - 5000);
    // a soma distribuída nos dias bate exatamente
    expect(h.days.reduce((a, d) => a + d.plannedSpending, 0)).toBe(5000);
  });
});

describe('horizonte de saldo', () => {
  it('mostra todos os dias do mês', () => {
    const h = horizon(base(), '2026-11', TODAY);
    expect(h.days).toHaveLength(30);
    expect(h.days.filter((d) => d.isPast)).toHaveLength(11);
    expect(h.days.find((d) => d.isToday)?.date).toBe(TODAY);
  });

  it('projeta meses futuros a partir do saldo previsto', () => {
    const s = base({
      recurrences: [
        rec({ kind: 'receita', amount: 300000, dayOfMonth: 5, startMonth: '2026-12', description: 'salário' }),
        rec({ amount: 100000, dayOfMonth: 10, startMonth: '2026-12' }),
      ],
    });
    const dez = horizon(s, '2026-12', TODAY);
    expect(dez.startBalance).toBe(100000);
    expect(dez.projectedEnd).toBe(100000 + 300000 - 100000);
    expect(dez.days.find((d) => d.date === '2026-12-05')?.endBalance).toBe(400000);
    const jan = horizon(s, '2027-01', TODAY);
    expect(jan.projectedEnd).toBe(100000 + 2 * 200000);
  });

  it('encontra o dia de saldo mais baixo', () => {
    const s = base({
      transactions: [
        tx({ amount: 90000, status: 'pendente', date: '2026-11-20' }),
        tx({ kind: 'receita', amount: 50000, status: 'pendente', date: '2026-11-25' }),
      ],
    });
    const h = horizon(s, '2026-11', TODAY);
    expect(h.lowest).toEqual({ date: '2026-11-20', balance: 10000 });
    expect(h.projectedEnd).toBe(60000);
  });

  it('mês passado mostra só o realizado', () => {
    const s = base({
      settings: { ...base().settings, initialBalanceDate: '2026-10-01' },
      transactions: [tx({ amount: 5000, date: '2026-10-10' })],
    });
    const h = horizon(s, '2026-10', TODAY);
    expect(h.isPastMonth).toBe(true);
    expect(h.projectedEnd).toBe(95000);
    expect(h.days.find((d) => d.date === '2026-10-09')?.endBalance).toBe(100000);
  });
});

describe('quanto dá pra gastar por dia', () => {
  it('divide o dinheiro livre pelos dias restantes, descontando a reserva', () => {
    const s = base({
      settings: { ...base().settings, reserve: 5000 },
      transactions: [tx({ amount: 19000, status: 'pendente', date: '2026-11-28' })],
    });
    const d = dailyAllowance(s, TODAY);
    // (1000 - 190 - 50) / 19 dias
    expect(d.daysLeft).toBe(19);
    expect(d.perDay).toBe(Math.floor(76000 / 19));
  });

  it('o café de hoje reduz o "ainda dá hoje", não o valor por dia', () => {
    const s0 = base();
    const s1 = base({ transactions: [tx({ amount: 1500, description: 'café' })] });
    expect(dailyAllowance(s1, TODAY).perDay).toBe(dailyAllowance(s0, TODAY).perDay);
    expect(dailyAllowance(s1, TODAY).leftToday).toBe(dailyAllowance(s0, TODAY).perDay - 1500);
  });

  it('nunca sugere valor negativo', () => {
    const s = base({ transactions: [tx({ amount: 500000, status: 'pendente', date: '2026-11-20' })] });
    expect(dailyAllowance(s, TODAY).perDay).toBe(0);
  });
});

describe('resumo do mês', () => {
  it('separa realizado de previsto', () => {
    const s = base({
      recurrences: [rec({ amount: 50000, dayOfMonth: 20 })],
      transactions: [tx({ kind: 'receita', amount: 30000 }), tx({ amount: 1000 })],
    });
    const m = monthSummary(s, '2026-11', TODAY);
    expect(m).toMatchObject({ income: 30000, expense: 1000, pendingIncome: 0, pendingExpense: 50000 });
  });
});
