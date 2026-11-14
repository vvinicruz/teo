import { today } from './dates';
import type { Category, Settings, Snapshot } from './types';

/** categorias iniciais. ids estáveis por usuário são gerados na criação da conta. */
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'alimentação', icon: 'alimentacao', kind: 'despesa' },
  { name: 'moradia', icon: 'moradia', kind: 'despesa' },
  { name: 'transporte', icon: 'transporte', kind: 'despesa' },
  { name: 'saúde', icon: 'saude', kind: 'despesa' },
  { name: 'lazer', icon: 'lazer', kind: 'despesa' },
  { name: 'compras', icon: 'compras', kind: 'despesa' },
  { name: 'educação', icon: 'educacao', kind: 'despesa' },
  { name: 'assinaturas', icon: 'assinaturas', kind: 'despesa' },
  { name: 'salário', icon: 'salario', kind: 'receita' },
  { name: 'renda extra', icon: 'renda-extra', kind: 'receita' },
  { name: 'outros', icon: 'outros', kind: 'ambos' },
];

export function defaultSettings(): Settings {
  return {
    name: '',
    initialBalance: 0,
    initialBalanceDate: today(),
    reserve: 0,
    hideValues: false,
    onboarded: false,
  };
}

export function emptySnapshot(newId: () => string): Snapshot {
  return {
    settings: defaultSettings(),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c, id: newId() })),
    transactions: [],
    recurrences: [],
    budgets: [],
    goals: [],
    cards: [],
    investments: [],
  };
}
