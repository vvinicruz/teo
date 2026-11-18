import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { buildImportRows, parseSpreadsheet } from '../importer';
import { isZip, readXlsx } from '../spreadsheet';
import type { Snapshot } from '../types';

/** monta um .xlsx mínimo, no formato da "fatura fechada" do itaú (dados fictícios). */
function itauXlsx(): Uint8Array {
  const strings = ['Nome', 'Pessoa Exemplo', 'Fatura Fechada - Novembro/2026', 'Cartão', 'Valor', 'Vencimento',
    'Itau Platinum Visa - final 0000', 'Lançamentos', 'Data', 'Lançamento', 'Parcelamento', 'Titularidade',
    'Pagamento Debito Minimo', 'Titular', 'Multa', 'Uber *Trip Help.uber.comsao Paulobr', 'Parc Automatico',
    'Parcela 2 de 12', 'Ticketbolt*ticket &amp; cia', 'Parcela 1 de 2', 'Subtotal  ', 'Importante saber'];
  const s = (ref: string, i: number) => `<c r="${ref}" t="s"><v>${i}</v></c>`;
  const n = (ref: string, v: string) => `<c r="${ref}"><v>${v}</v></c>`;
  const rows = [
    `<row r="3">${s('B3', 0)}${s('C3', 1)}</row>`,
    `<row r="8">${s('B8', 2)}</row>`,
    `<row r="9">${s('B9', 3)}${s('G9', 4)}${s('I9', 5)}</row>`,
    `<row r="10">${s('B10', 6)}${n('G10', '2159.71')}${n('I10', '46349')}</row>`,
    `<row r="13">${s('B13', 7)}</row>`,
    `<row r="14">${s('B14', 8)}${s('C14', 9)}${s('D14', 10)}${s('E14', 4)}${s('G14', 11)}</row>`,
    `<row r="15">${n('B15', '46332')}${s('C15', 12)}${n('E15', '-1299.65')}${s('G15', 13)}</row>`,
    `<row r="16">${n('B16', '46340')}${s('C16', 14)}${n('E16', '31.79')}${s('G16', 13)}</row>`,
    `<row r="17">${n('B17', '46314')}${s('C17', 15)}${n('E17', '12.74')}${s('G17', 13)}</row>`,
    `<row r="18">${n('B18', '46301')}${s('C18', 16)}${s('D18', 17)}${n('E18', '752.44')}${s('G18', 13)}</row>`,
    `<row r="19">${n('B19', '46337')}${s('C19', 18)}${s('D19', 19)}${n('E19', '113.46')}${s('G19', 13)}</row>`,
    `<row r="20">${n('B20', '46337')}<c r="C20" t="inlineStr"><is><t>Padaria</t></is></c>${n('E20', '56.9')}</row>`,
    `<row r="42">${s('D42', 20)}<c r="E42"/></row>`,
    `<row r="46">${s('B46', 21)}</row>`,
  ];
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Fatura" sheetId="1" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/sharedStrings.xml': strToU8(`<sst>${strings.map((t) => `<si><t>${t}</t></si>`).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData>${rows.join('')}</sheetData></worksheet>`),
  });
}

describe('planilha .xlsx', () => {
  it('lê a grade da primeira planilha (textos compartilhados, números e texto direto)', () => {
    const bytes = itauXlsx();
    expect(isZip(bytes)).toBe(true);
    const grid = readXlsx(bytes);
    expect(grid[13].slice(1, 5)).toEqual(['Data', 'Lançamento', 'Parcelamento', 'Valor']);
    expect(grid[17][3]).toBe('Parcela 2 de 12');
    expect(grid[18][2]).toBe('Ticketbolt*ticket & cia');
    expect(grid[19][2]).toBe('Padaria');
  });

  it('fatura do itaú: datas do excel, sinais, parcelas e vencimento', () => {
    const st = parseSpreadsheet(readXlsx(itauXlsx()));
    expect(st.looksLikeCard).toBe(true);
    expect(st.invoiceDueDate).toBe('2026-11-23');
    expect(st.lines.map((l) => [l.date, l.description, l.amount])).toEqual([
      ['2026-11-06', 'pagamento debito minimo', 129965],
      ['2026-11-14', 'multa', -3179],
      ['2026-10-19', 'uber *trip help.uber.comsao paulobr', -1274],
      ['2026-10-06', 'parc automatico 02/12', -75244],
      ['2026-11-11', 'ticketbolt*ticket & cia 01/02', -11346],
      ['2026-11-11', 'padaria', -5690],
    ]);
  });

  it('na importação para o cartão: pagamento é pulado e parcelas perguntam o restante', () => {
    const s: Snapshot = {
      settings: { name: '', initialBalance: 0, initialBalanceDate: '2026-01-01', reserve: 0, hideValues: false, onboarded: true },
      categories: [], transactions: [], recurrences: [], budgets: [], goals: [], investments: [], accounts: [],
      cards: [{ id: 'itau', name: 'itaú', closingDay: 14, dueDay: 21, creditLimit: null, createdAt: '' }],
    };
    const rows = buildImportRows(s, parseSpreadsheet(readXlsx(itauXlsx())), { cardId: 'itau', accountId: null }, '2026-11-18');
    expect(rows.find((r) => r.description.startsWith('pagamento'))?.decision).toBe('pular');
    expect(rows.find((r) => r.description.startsWith('parc automatico'))?.installment).toMatchObject({ n: 2, total: 12 });
  });

  it('extrato de conta em planilha: valor com sinal, ou colunas de entrada e saída', () => {
    const conta = parseSpreadsheet([
      ['Extrato conta corrente'],
      ['Data', 'Descrição', 'Valor (R$)', 'Saldo'],
      ['05/11/2026', 'PIX RECEBIDO', '1.000,00', '1.000,00'],
      ['06/11/2026', 'PIX ENVIADO', '-250,50', '749,50'],
    ]);
    expect(conta.looksLikeCard).toBe(false);
    expect(conta.lines.map((l) => l.amount)).toEqual([100000, -25050]);
    const colunas = parseSpreadsheet([
      ['Data', 'Histórico', 'Entrada', 'Saída'],
      ['46332', 'salario', '3836', ''],
      ['46333', 'aluguel', '', '1200'],
    ]);
    expect(colunas.lines.map((l) => l.amount)).toEqual([383600, -120000]);
  });
});

describe('fatura: datas das compras', () => {
  const card = { id: 'itau', name: 'itaú', closingDay: 14, dueDay: 21, creditLimit: null, createdAt: '' };
  const base = (over: Partial<Snapshot> = {}): Snapshot => ({
    settings: { name: '', initialBalance: 0, initialBalanceDate: '2026-01-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], budgets: [], goals: [], investments: [], accounts: [], cards: [card],
    ...over,
  });
  // fatura aberta de dezembro (vence 21/12): o itaú incluiu compras de 12/11 a 16/11 e parcelas antigas
  const grid = [
    ['Fatura Aberta - Dezembro/2026'],
    ['Cartão', 'Valor (parcial)', 'Vencimento'],
    ['Itau', '100', '46377'],
    ['Data', 'Lançamento', 'Parcelamento', 'Valor'],
    ['46342', 'Sams Club', '', '328.84'], // 16/11
    ['46340', 'Dominos Pizza', '', '86.8'], // 14/11
    ['46338', '99food', '', '42.21'], // 12/11
    ['46301', 'Parc Automatico', 'Parcela 3 de 12', '752.44'], // compra de 06/10
    ['46154', 'Zp *Olx', 'Parcela 8 de 10', '51.98'], // compra de 12/05
  ];

  it('mantém a data real e prende à fatura certa as compras de antes do período', () => {
    const rows = buildImportRows(base(), parseSpreadsheet(grid), { cardId: 'itau', accountId: null }, '2026-11-18');
    expect(rows.map((r) => [r.description, r.date, r.invoiceDate])).toEqual([
      ['sams club', '2026-11-16', null],
      ['dominos pizza', '2026-11-14', '2026-12-21'],
      ['99food', '2026-11-12', '2026-12-21'],
      ['parc automatico 03/12', '2026-12-06', null],
      ['zp *olx 08/10', '2026-12-12', null],
    ]);
  });

  it('compra presa à fatura entra nela (e não na anterior)', async () => {
    const { invoiceByDueDate } = await import('../finance');
    const tx = (id: string, date: string, amount: number, invoiceDate?: string) => ({
      id, kind: 'despesa' as const, amount, description: id, categoryId: null, date, status: 'realizada' as const,
      paymentMethod: 'credito' as const, cardId: 'itau', invoiceDate: invoiceDate ?? null, createdAt: '',
    });
    const s = base({ transactions: [tx('presa', '2026-11-12', 4221, '2026-12-21'), tx('normal', '2026-11-12', 1000)] });
    expect(invoiceByDueDate(s, card, '2026-12-21', '2026-11-18').total).toBe(4221);
    expect(invoiceByDueDate(s, card, '2026-11-21', '2026-11-18').total).toBe(1000);
  });

  it('o que foi importado antes com a data errada é corrigido', () => {
    const lines = parseSpreadsheet(grid).lines;
    const antiga = {
      id: 'x', kind: 'despesa' as const, amount: 4221, description: '99food', categoryId: null, date: '2026-11-15',
      status: 'realizada' as const, paymentMethod: 'credito' as const, cardId: 'itau', externalId: lines[2].externalId, createdAt: '',
    };
    const rows = buildImportRows(base({ transactions: [antiga] }), parseSpreadsheet(grid), { cardId: 'itau', accountId: null }, '2026-11-18');
    expect(rows[2].suggestion).toEqual({ type: 'ja-importada', fix: antiga });
    expect(rows[2].date).toBe('2026-11-12');
  });
});

describe('mesmo nome e centavos de diferença', () => {
  const card = { id: 'itau', name: 'itaú', closingDay: 14, dueDay: 21, creditLimit: null, createdAt: '' };
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
    settings: { name: '', initialBalance: 0, initialBalanceDate: '2026-10-01', reserve: 0, hideValues: false, onboarded: true },
    categories: [], transactions: [], recurrences: [], budgets: [], goals: [], investments: [], accounts: [], cards: [card],
    ...over,
  });
  const dezembro = (nome: string, valor: string, parcela = 'Parcela 2 de 2') => [
    ['Fatura Aberta - Dezembro/2026'],
    ['Cartão', 'Valor', 'Vencimento'],
    ['Itau', '100', '46377'],
    ['Data', 'Lançamento', 'Parcelamento', 'Valor'],
    ['46335', nome, parcela, valor], // compra de 09/11
  ];
  // novembro: parcela 1 importada com "todas" → parcela 2 prevista para 09/12, a r$ 155,18
  const parcelado = {
    id: 'r1', kind: 'despesa' as const, amount: 15518, description: 'jim.com juliane martins lamericanabr', categoryId: null,
    paymentMethod: 'credito' as const, dayOfMonth: 9, startMonth: '2026-11', occurrences: 2, skippedDates: [], cardId: 'itau', createdAt: '',
  };

  it('parcela prevista com 1 centavo de diferença é confirmada sozinha', () => {
    const rows = buildImportRows(
      snap({ recurrences: [parcelado] }),
      parseSpreadsheet(dezembro('Jim.com Juliane Martins Lamericanabr', '155.17')),
      { cardId: 'itau', accountId: null },
      '2026-11-20',
    );
    expect(rows[0]).toMatchObject({ decision: 'vincular', autoMatched: true, amount: 15517, suggestion: { type: 'previsao' } });
  });

  it('nome diferente continua perguntando', () => {
    const rows = buildImportRows(
      snap({ recurrences: [parcelado] }),
      parseSpreadsheet(dezembro('Loja Totalmente Outra', '155.17', '')),
      { cardId: 'itau', accountId: null },
      '2026-11-20',
    );
    expect(rows[0].decision).toBeNull();
    expect(rows[0].autoMatched).toBeFalsy();
  });

  it('compra já registrada com nome parecido e centavos de diferença é reconhecida', () => {
    const manual = {
      id: 'm1', kind: 'despesa' as const, amount: 4230, description: '99 food', categoryId: null, date: '2026-11-16',
      status: 'realizada' as const, paymentMethod: 'credito' as const, cardId: 'itau', createdAt: '',
    };
    const grid = [
      ['Fatura Aberta - Dezembro/2026'], ['Cartão', 'Valor', 'Vencimento'], ['Itau', '100', '46377'],
      ['Data', 'Lançamento', 'Valor'], ['46342', '99food *99foodsao Paulobr', '42.21'],
    ];
    const rows = buildImportRows(snap({ transactions: [manual] }), parseSpreadsheet(grid), { cardId: 'itau', accountId: null }, '2026-11-20');
    // "99 food" x "99food *99foodsao paulobr": o banco grudou a cidade, mas é o mesmo nome
    expect(rows[0]).toMatchObject({ suggestion: { type: 'parecida' }, decision: 'pular', autoMatched: true });
  });

  it('nome meio parecido com centavos de diferença: pergunta', () => {
    const manual = {
      id: 'm2', kind: 'despesa' as const, amount: 1280, description: 'uber viagem', categoryId: null, date: '2026-11-16',
      status: 'realizada' as const, paymentMethod: 'credito' as const, cardId: 'itau', createdAt: '',
    };
    const grid = [
      ['Fatura Aberta - Dezembro/2026'], ['Cartão', 'Valor', 'Vencimento'], ['Itau', '100', '46377'],
      ['Data', 'Lançamento', 'Valor'], ['46342', 'Uber *Trip Help.uber.comsao Paulobr', '12.74'],
    ];
    const rows = buildImportRows(snap({ transactions: [manual] }), parseSpreadsheet(grid), { cardId: 'itau', accountId: null }, '2026-11-20');
    expect(rows[0]).toMatchObject({ suggestion: { type: 'parecida' }, decision: null });
  });

  it('semelhança de nomes', async () => {
    const { nameSimilarity, centsApart } = await import('../importer');
    expect(nameSimilarity('jim.com juliane martins lamericanabr 01/02', 'Jim.com Juliane Martins Lamericanabr 02/02')).toBe(1);
    expect(nameSimilarity('quiosque da luzamericanabr', 'quiosque da luz americana')).toBeGreaterThan(0.8);
    expect(nameSimilarity('uber trip', 'posto shell')).toBeLessThan(0.3);
    expect(centsApart(15518, 15517)).toBe(true);
    expect(centsApart(15518, 16000)).toBe(false);
  });
});
