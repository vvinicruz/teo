import { describe, expect, it } from 'vitest';
import { upcomingEntries } from '../finance';
import { daysSinceContribution, goalForecast, goalPace, goalStreak, goalToNudge, milestoneFor } from '../goals';
import type { Goal, Investment, Recurrence, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-14';
const cx: Investment = { id: 'cx', name: 'caixinha', kind: 'caixinha', cdiPercent: 100, balance: 100000, balanceUpdatedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' };
const viagem: Goal = { id: 'g', name: 'viagem', icon: 'viagem', target: 500000, saved: 0, investmentId: 'cx', createdAt: '2026-08-01T00:00:00Z' };

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'v', initialBalance: 300000, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], budgets: [], goals: [viagem], cards: [], investments: [cx], ...over,
  };
}
let n = 0;
const guardar = (date: string, amount = 20000, kind: 'despesa' | 'receita' = 'despesa'): Transaction => ({
  id: `t${++n}`, kind, amount, description: 'guardar', categoryId: null, date, status: 'realizada',
  paymentMethod: null, investmentId: 'cx', createdAt: `${date}T12:00:00Z`,
});

describe('marcos', () => {
  it('25, 50, 75 e 100%', () => {
    expect([0, 0.24, 0.25, 0.5, 0.74, 0.99, 1, 1.2].map(milestoneFor)).toEqual([0, 0, 25, 50, 50, 75, 100, 100]);
  });
});

describe('ritmo e previsão', () => {
  it('usa a média dos últimos meses', () => {
    const s = base({ transactions: [guardar('2026-09-10'), guardar('2026-10-10'), guardar('2026-11-10')] });
    expect(goalPace(s, viagem, TODAY)).toBe(20000);
    const f = goalForecast(s, viagem, TODAY);
    // tem 1.000 + 600 = 1.600; faltam 3.400; a 200/mês = 17 meses
    expect(f.saved).toBe(160000);
    expect(f.etaMonth).toBe('2028-04');
    expect(f.boost).toEqual({ extra: 4000, monthsSooner: 2 });
  });

  it('com "guardar todo mês", o ritmo é o valor combinado', () => {
    const plano: Recurrence = { id: 'r', kind: 'despesa', amount: 50000, description: 'guardar', categoryId: null, paymentMethod: null,
      dayOfMonth: 5, startMonth: '2026-12', occurrences: null, skippedDates: [], investmentId: 'cx', createdAt: '' };
    const s = base({ recurrences: [plano] });
    expect(goalPace(s, viagem, TODAY)).toBe(50000);
    expect(goalForecast(s, viagem, TODAY).etaMonth).toBe('2027-07');
    // e aparece no horizonte como saída da conta
    expect(upcomingEntries(s, TODAY, '2026-12-31')[0]).toMatchObject({ amount: 50000, investmentId: 'cx' });
  });

  it('com prazo: quanto precisa por mês e se está no caminho', () => {
    const s = base({ goals: [{ ...viagem, deadline: '2027-11-30' }], transactions: [guardar('2026-11-01', 20000)] });
    const f = goalForecast(s, s.goals[0], TODAY);
    expect(f.neededPerMonth).toBe(Math.ceil(380000 / 12));
    expect(f.onTrack).toBe(false);
  });

  it('sem histórico, não inventa previsão', () => {
    const f = goalForecast(base(), viagem, TODAY);
    expect(f.pace).toBeNull();
    expect(f.etaMonth).toBeNull();
  });
});

describe('sequência', () => {
  it('conta meses seguidos e não quebra no mês atual', () => {
    const s = base({ transactions: [guardar('2026-08-02'), guardar('2026-09-02'), guardar('2026-10-02')] });
    expect(goalStreak(s, viagem, TODAY)).toEqual({ months: 3, thisMonth: false });
    const s2 = base({ transactions: [...s.transactions, guardar('2026-11-03')] });
    expect(goalStreak(s2, viagem, TODAY)).toEqual({ months: 4, thisMonth: true });
  });
  it('mês em que resgatou mais do que guardou não conta', () => {
    const s = base({ transactions: [guardar('2026-09-02'), guardar('2026-10-02', 10000), guardar('2026-10-20', 30000, 'receita')] });
    expect(goalStreak(s, viagem, TODAY).months).toBe(0);
  });
  it('meta sem caixinha usa os meses registrados', () => {
    const g: Goal = { ...viagem, investmentId: null, contributionMonths: ['2026-10', '2026-11'] };
    expect(goalStreak(base({ goals: [g] }), g, TODAY)).toEqual({ months: 2, thisMonth: true });
  });
});

describe('lembrete gentil', () => {
  it('lembra depois de 3 semanas sem guardar', () => {
    const s = base({ transactions: [guardar('2026-10-20')] });
    expect(daysSinceContribution(s, viagem, TODAY)).toBe(25);
    expect(goalToNudge(s, TODAY, new Set())?.days).toBe(25);
    expect(goalToNudge(s, TODAY, new Set(['g']))).toBeNull();
  });
  it('não lembra quem guardou há pouco, quem tem "todo mês" ou meta concluída', () => {
    expect(goalToNudge(base({ transactions: [guardar('2026-11-01')] }), TODAY, new Set())).toBeNull();
    const plano = { id: 'r', kind: 'despesa' as const, amount: 1, description: '', categoryId: null, paymentMethod: null,
      dayOfMonth: 5, startMonth: '2026-11', occurrences: null, skippedDates: [], investmentId: 'cx', createdAt: '' };
    expect(goalToNudge(base({ recurrences: [plano] }), TODAY, new Set())).toBeNull();
    expect(goalToNudge(base({ goals: [{ ...viagem, target: 50000 }] }), TODAY, new Set())).toBeNull();
  });
});
