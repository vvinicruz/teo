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
