import { describe, expect, it } from 'vitest';
import { spendingPdf } from '../../lib/spendingPdf';
import { spendingByCategory } from '../spending';
import type { Category, Snapshot, Transaction } from '../types';

const cats: Category[] = [
  { id: 'lazer', name: 'lazer', icon: 'lazer', kind: 'despesa' },
  { id: 'mercado', name: 'alimentação', icon: 'mercado', kind: 'despesa' },
  { id: 'transporte', name: 'transporte', icon: 'transporte', kind: 'despesa' },
  { id: 'saude', name: 'saúde', icon: 'saude', kind: 'despesa' },
  { id: 'casa', name: 'casa', icon: 'casa', kind: 'despesa' },
];
let n = 0;
const tx = (categoryId: string | null, amount: number, description: string, date: string, cardId?: string): Transaction => ({
  id: `t${++n}`, kind: 'despesa', amount, description, categoryId, date, status: 'realizada', paymentMethod: null, cardId,
  createdAt: `2026-11-01T00:00:${String(n).padStart(2, '0')}Z`,
});

function snapshot(): Snapshot {
  const transactions: Transaction[] = [
    tx('lazer', 40000, 'show no allianz (ingresso)', '2026-11-08', 'nu'),
    tx('lazer', 25000, 'cinema e pipoca', '2026-11-03'),
    tx('mercado', 48790, 'supermercado assaí', '2026-11-10'),
    tx('mercado', 6250, 'padaria do zé', '2026-11-11'),
    tx('mercado', 12000, 'ifood', '2026-11-05', 'nu'),
    tx('transporte', 2095, 'uber * pending', '2026-11-11', 'nu'),
    tx('transporte', 25000, 'posto shell', '2026-11-02'),
    tx(null, 3990, 'compra sem categoria', '2026-11-09'),
  ];
  for (let i = 0; i < 40; i++) transactions.push(tx('casa', 1000 + i * 37, `item de casa número ${i + 1} com um nome bem comprido para testar o corte`, '2026-11-0' + ((i % 9) + 1)));
  return {
    settings: { name: 'vini', initialBalance: 0, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: cats, transactions, recurrences: [], goals: [], cards: [], investments: [], accounts: [],
    budgets: [
      { id: 'b1', categoryId: 'lazer', amount: 100000 },
      { id: 'b2', categoryId: 'mercado', amount: 70000 },
      { id: 'b3', categoryId: 'transporte', amount: 25000 },
    ],
  };
}

describe('relatório de gastos em pdf', () => {
  it('gera um pdf válido com as categorias e os totais', () => {
    const s = snapshot();
    const report = spendingByCategory(s, cats, '2026-11', '2026-11-18');
    const bytes = spendingPdf(report, {
      name: 'vini',
      generatedOn: '2026-11-18',
      categoryName: (id) => cats.find((c) => c.id === id)?.name ?? 'sem categoria',
      origin: (t) => (t.cardId ? 'cartão nubank' : 'conta principal'),
    });
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(text).toContain('(gastos de novembro de 2026)');
    expect(text).toContain('(dentro do limite)');
    expect(text).toContain('(passou do limite)');
    expect(text).toMatch(/\/Count [2-9]/); // a lista longa passa para outra página
    // xref aponta para o começo de cada objeto
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((o, i) => expect(text.slice(o, o + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`));
  });
});
