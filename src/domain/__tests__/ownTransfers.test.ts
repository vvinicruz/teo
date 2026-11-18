import { describe, expect, it } from 'vitest';
import { buildImportRows, mentionsOwnName, OUTSIDE_TEO, type ParsedStatement } from '../importer';
import type { Snapshot, Transaction } from '../types';

const TODAY = '2026-11-18';
function snap(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'vini', initialBalance: 0, initialBalanceDate: '2026-10-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], budgets: [], goals: [], cards: [], investments: [], accounts: [],
    ...over,
  };
}
const extrato = (lines: [string, number, string][]): ParsedStatement => ({
  format: 'ofx',
  looksLikeCard: false,
  lines: lines.map(([date, amount, description], i) => ({ date, amount, description, externalId: `ofx:${i}:${description}` })),
});

describe('transferências para a própria pessoa', () => {
  it('reconhece o nome da pessoa na descrição', () => {
    expect(mentionsOwnName('pix transf viniciu11 10', 'vini')).toBe(true);
    expect(mentionsOwnName('pix transf viniciu11 10', 'Vinícius Henrique')).toBe(true);
    expect(mentionsOwnName('pix transf bia souza', 'bia')).toBe(true);
    expect(mentionsOwnName('pix transf maria silva', 'vini')).toBe(false);
    expect(mentionsOwnName('pix transf vin', 'vini')).toBe(false);
  });

  it('pix com o nome da pessoa vira a pergunta "foi entre suas contas?"', () => {
    const rows = buildImportRows(
      snap(),
      extrato([
        ['2026-10-13', -5000, 'pix transf viniciu11 10'],
        ['2026-10-13', -3000, 'pix transf maria s'],
        ['2026-10-06', 324900, 'remuneracao salario'],
      ]),
      { cardId: null, accountId: null },
      TODAY,
    );
    expect(rows[0]).toMatchObject({ suggestion: { type: 'minha-conta', reason: 'nome' }, decision: null, categoryId: null });
    expect(rows[1].suggestion).toBeNull();
    expect(rows[2].suggestion).toBeNull();
  });

  it('aprende: um igual já marcado antes vem marcado sozinho, para a mesma conta', () => {
    const base = { kind: 'despesa' as const, amount: 5000, categoryId: null, date: '2026-10-13', status: 'realizada' as const,
      paymentMethod: 'transferencia' as const, transferId: 'tr1', createdAt: '' };
    const saida: Transaction = { ...base, id: 's', description: 'pix transf viniciu11 10', accountId: null, externalId: 'ofx:x' };
    const entrada: Transaction = { ...base, id: 'e', kind: 'receita', description: 'transferência de conta principal', accountId: 'nu', externalId: null };
    const rows = buildImportRows(
      snap({ transactions: [saida, entrada], settings: { ...snap().settings, name: 'jo' } }),
      extrato([['2026-10-16', -10000, 'pix transf viniciu16 10']]),
      { cardId: null, accountId: null },
      TODAY,
    );
    expect(rows[0]).toMatchObject({ suggestion: { type: 'minha-conta', reason: 'antes' }, decision: 'transferencia', autoMatched: true, transferTo: 'nu' });
  });

  it('sem conta conhecida, a transferência vai para "fora do teo"', () => {
    const rows = buildImportRows(snap(), extrato([['2026-10-13', -5000, 'pix transf viniciu11 10']]), { cardId: null, accountId: null }, TODAY);
    expect(rows[0].transferTo).toBe(OUTSIDE_TEO);
  });

  it('transferência já registrada no teo (função transferir) é reconhecida, e não perguntada de novo', () => {
    const lado: Transaction = { id: 'a', kind: 'despesa', amount: 40000, description: 'transferência para nubank', categoryId: null,
      date: '2026-11-06', status: 'realizada', paymentMethod: 'transferencia', transferId: 'tr9', accountId: null, createdAt: '' };
    const rows = buildImportRows(snap({ transactions: [lado] }), extrato([['2026-11-06', -40000, 'pix transf viniciu06 11']]), { cardId: null, accountId: null }, TODAY);
    expect(rows[0].suggestion).toMatchObject({ type: 'parecida', transaction: { id: 'a' } });
  });
});

describe('pix já importado como gasto', () => {
  it('reimportar oferece transformar em transferência (sem importar de novo)', () => {
    const st = extrato([['2026-10-13', -5000, 'pix transf viniciu11 10']]);
    const antigo: Transaction = { id: 'g1', kind: 'despesa', amount: 5000, description: 'pix transf viniciu11 10', categoryId: null,
      date: '2026-10-13', status: 'realizada', paymentMethod: 'pix', accountId: null, externalId: st.lines[0].externalId, createdAt: '' };
    const rows = buildImportRows(snap({ transactions: [antigo] }), st, { cardId: null, accountId: null }, TODAY);
    expect(rows[0]).toMatchObject({ suggestion: { type: 'minha-conta', existing: { id: 'g1' } }, decision: null });
  });
});
