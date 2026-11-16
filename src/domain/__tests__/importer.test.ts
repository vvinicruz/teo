import { describe, expect, it } from 'vitest';
import { buildImportRows, cleanDescription, decodeBytes, guessCategory, parseCardPdf, parseCSV, parseOFX, parseStatement } from '../importer';
import type { Card, Category, Snapshot, Transaction } from '../types';

const TODAY = '2026-11-14';

const OFX_CONTA = `OFXHEADER:100
DATA:OFXSGML
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261112120000[-3:BRT]
<TRNAMT>-120.00
<FITID>A1
<MEMO>Compra no debito - SUPERMERCADO BOM PRECO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105
<TRNAMT>5600,00
<FITID>A2
<MEMO>PAGTO SALARIO EMPRESA X
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261113
<TRNAMT>-1500.00
<FITID>A3
<NAME>PIX ENVIADO ALUGUEL APTO
</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`;

const OFX_CARTAO = `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED><TRNAMT>-55.90</TRNAMT><FITID>C1</FITID><MEMO>NETFLIX.COM</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261110</DTPOSTED><TRNAMT>800.00</TRNAMT><FITID>C2</FITID><MEMO>Pagamento recebido</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

const CSV_NUBANK_CARTAO = `date,title,amount
2026-11-10,Uber *Trip,23.45
2026-11-11,Ifood *Restaurante,"48,90"
2026-11-12,Pagamento recebido,-800.00`;

const CSV_NUBANK_CONTA = `Data,Valor,Identificador,Descrição
12/11/2026,-120.00,abc-1,Compra no débito - Padaria
13/11/2026,250.00,abc-2,Transferência recebida`;

const cats: Category[] = [
  { id: 'c-ali', name: 'alimentação', icon: 'alimentacao', kind: 'despesa' },
  { id: 'c-mor', name: 'moradia', icon: 'moradia', kind: 'despesa' },
  { id: 'c-tra', name: 'transporte', icon: 'transporte', kind: 'despesa' },
  { id: 'c-ass', name: 'assinaturas', icon: 'assinaturas', kind: 'despesa' },
  { id: 'c-sal', name: 'salário', icon: 'salario', kind: 'receita' },
];
const nubank: Card = { id: 'nu', name: 'nubank', closingDay: 3, dueDay: 10, creditLimit: null, createdAt: '' };

function base(over: Partial<Snapshot> = {}): Snapshot {
  return {
    settings: { name: 'v', initialBalance: 0, initialBalanceDate: '2026-11-01', reserve: 0, hideValues: false, onboarded: true },
    categories: cats, transactions: [], recurrences: [], budgets: [], goals: [], cards: [nubank], investments: [], accounts: [], ...over,
  };
}
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, kind: 'despesa', amount: 1000, description: 'x', categoryId: null, date: TODAY,
  status: 'realizada', paymentMethod: null, createdAt: '', ...p,
});

describe('leitura de extratos', () => {
  it('ofx de conta (sgml, vírgula e ponto, memo e name)', () => {
    const st = parseOFX(OFX_CONTA);
    expect(st.looksLikeCard).toBe(false);
    expect(st.lines).toMatchObject([
      { date: '2026-11-12', amount: -12000, description: 'supermercado bom preco', externalId: 'ofx:A1', method: 'debito' },
      { date: '2026-11-05', amount: 560000, description: 'pagto salario empresa x', externalId: 'ofx:A2' },
      { date: '2026-11-13', amount: -150000, description: 'aluguel apto', externalId: 'ofx:A3', method: 'pix' },
    ]);
  });
  it('ofx de cartão (xml)', () => {
    const st = parseStatement(OFX_CARTAO);
    expect(st.looksLikeCard).toBe(true);
    expect(st.lines.map((l) => l.amount)).toEqual([-5590, 80000]);
  });
  it('csv da fatura nubank: compras positivas viram saídas', () => {
    const st = parseCSV(CSV_NUBANK_CARTAO);
    expect(st.looksLikeCard).toBe(true);
    expect(st.lines.map((l) => l.amount)).toEqual([-2345, -4890, 80000]);
  });
  it('csv da conta nubank (data brasileira, identificador)', () => {
    const st = parseCSV(CSV_NUBANK_CONTA);
    expect(st.looksLikeCard).toBe(false);
    expect(st.lines[0]).toMatchObject({ date: '2026-11-12', amount: -12000, description: 'padaria', externalId: 'csv:abc-1', method: 'debito' });
  });
  it('csv com ponto e vírgula', () => {
    const st = parseCSV('Data;Histórico;Valor\n01/11/2026;Farmácia;-35,90');
    expect(st.lines[0]).toMatchObject({ date: '2026-11-01', amount: -3590, description: 'farmácia' });
  });
  it('tira prefixos do banco mas mantém o resto', () => {
    const st = parseCSV('Data,Valor,Descrição\n01/11/2026,-10,Transferência recebida - João\n01/11/2026,-5,PIX ENVIADO');
    expect(st.lines.map((l) => l.description)).toEqual(['joão', 'pix enviado']);
  });
  it('extrato do nubank: tira cpf, banco, agência e conta, e respeita o limite de 80 caracteres', () => {
    const memo =
      'Transferência enviada pelo Pix - JULIANE MARTINS LOBATO DA SILVA - •••.123.456-•• - NU PAGAMENTOS S.A. - INSTITUIÇÃO DE PAGAMENTO (0260) Agência: 1 Conta: 12345678-9';
    expect(cleanDescription(memo)).toEqual({ description: 'juliane martins lobato da silva', method: 'pix' });
    expect(cleanDescription('Transferência enviada pelo Pix - UBER DO BRASIL TECNOLOGIA LTDA. - 17.895.646/0001-87 - BCO DO BRASIL S.A. (0001) Agência: 1 Conta: 2-3').description).toBe('uber do brasil tecnologia ltda.');
    expect(cleanDescription('Transferência Recebida - FULANO DE TAL - •••.222.333-•• - BCO X (0001)')).toEqual({ description: 'fulano de tal', method: 'pix' });
    expect(cleanDescription('Pagamento de boleto efetuado - CONDOMINIO EDIFICIO SOL').description).toBe('condominio edificio sol');
    const longo = cleanDescription('x'.repeat(200)).description;
    expect(longo.length).toBeLessThanOrEqual(80);
  });
  it('arquivo em latin-1 não quebra os acentos', () => {
    const bytes = Uint8Array.from([0x63, 0x61, 0x66, 0xe9]); // "café" em latin-1
    expect(decodeBytes(bytes)).toBe('café');
  });
});

describe('categorias sugeridas', () => {
  it('reconhece estabelecimentos comuns', () => {
    expect(guessCategory('uber *trip', 'despesa', cats)).toBe('c-tra');
    expect(guessCategory('ifood *restaurante', 'despesa', cats)).toBe('c-ali');
    expect(guessCategory('netflix.com', 'despesa', cats)).toBe('c-ass');
    expect(guessCategory('pagto salario empresa x', 'receita', cats)).toBe('c-sal');
    expect(guessCategory('loja qualquer', 'despesa', cats)).toBeNull();
  });
});

describe('perguntas sobre duplicidade', () => {
  it('lançamento igual já registrado vira pergunta "é a mesma?"', () => {
    const s = base({ transactions: [tx({ amount: 12000, date: '2026-11-11', description: 'mercado' })] });
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), { cardId: null, accountId: null }, TODAY);
    expect(rows[0].suggestion?.type).toBe('parecida');
    expect(rows[0].decision).toBeNull(); // a pessoa precisa responder
  });
  it('mesmo valor 3 dias depois, com nomes diferentes, não é considerado igual (caso real: dspay x abastecimento)', () => {
    const s = base({ transactions: [tx({ amount: 2200, date: '2026-11-09', description: 'abastecimento' })] });
    const st = { format: 'ofx' as const, looksLikeCard: false, lines: [{ date: '2026-11-06', amount: -2200, description: 'dspay', externalId: null }] };
    expect(buildImportRows(s, st, { cardId: null, accountId: null }, TODAY)[0].suggestion).toBeNull();
  });
  it('mesmo valor e mesma data tem prioridade sobre um parecido de outro dia', () => {
    const s = base({ transactions: [tx({ amount: 2200, date: '2026-11-09', description: 'abastecimento' })] });
    const st = { format: 'ofx' as const, looksLikeCard: false, lines: [
      { date: '2026-11-08', amount: -2200, description: 'outra coisa', externalId: null },
      { date: '2026-11-09', amount: -2200, description: 'posto sao vito', externalId: null },
    ] };
    const rows = buildImportRows(s, st, { cardId: null, accountId: null }, TODAY);
    expect(rows[0].suggestion).toBeNull();
    expect(rows[1].suggestion).toMatchObject({ type: 'parecida', sameDay: true });
  });
  it('segunda chance: 1 dia de diferença, ou 2 com nome parecido', () => {
    const s = base({ transactions: [tx({ amount: 5000, date: '2026-11-09', description: 'posto são vito' })] });
    const linha = (date: string, description: string) => ({ format: 'ofx' as const, looksLikeCard: false, lines: [{ date, amount: -5000, description, externalId: null }] });
    expect(buildImportRows(s, linha('2026-11-10', 'qualquer'), { cardId: null, accountId: null }, TODAY)[0].suggestion).toMatchObject({ sameDay: false });
    expect(buildImportRows(s, linha('2026-11-11', 'posto sao vito ltda'), { cardId: null, accountId: null }, TODAY)[0].suggestion).toMatchObject({ sameDay: false });
    expect(buildImportRows(s, linha('2026-11-11', 'qualquer'), { cardId: null, accountId: null }, TODAY)[0].suggestion).toBeNull();
  });
  it('não pergunta duas vezes sobre o mesmo lançamento', () => {
    const s = base({ transactions: [tx({ amount: 12000, date: '2026-11-12' })] });
    const st = { format: 'csv' as const, looksLikeCard: false, lines: [
      { date: '2026-11-12', amount: -12000, description: 'a', externalId: null },
      { date: '2026-11-12', amount: -12000, description: 'b', externalId: null },
    ] };
    const rows = buildImportRows(s, st, { cardId: null, accountId: null }, TODAY);
    expect(rows.map((r) => r.suggestion?.type ?? null)).toEqual(['parecida', null]);
  });
  it('linha já importada é pulada sem perguntar', () => {
    const s = base({ transactions: [tx({ externalId: 'ofx:A1', amount: 12000, date: '2026-11-12' })] });
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), { cardId: null, accountId: null }, TODAY);
    expect(rows[0]).toMatchObject({ suggestion: { type: 'ja-importada' }, decision: 'pular' });
  });
  it('conta fixa prevista vira pergunta "é isso?", mesmo com valor um pouco diferente', () => {
    const s = base({
      recurrences: [{ id: 'r1', kind: 'despesa', amount: 145000, description: 'aluguel', categoryId: 'c-mor', paymentMethod: null,
        dayOfMonth: 15, startMonth: '2026-11', occurrences: null, skippedDates: [], createdAt: '' }],
    });
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), { cardId: null, accountId: null }, TODAY);
    expect(rows[2].suggestion).toMatchObject({ type: 'previsao', entry: { recurrenceId: 'r1', originalDate: '2026-11-15' } });
    expect(rows[2].categoryId).toBe('c-mor');
  });
  it('pagamento de fatura no extrato da conta é reconhecido', () => {
    const s = base({ transactions: [tx({ amount: 30000, cardId: 'nu', date: '2026-11-02' })] }); // fatura vence 10/11
    const st = { format: 'csv' as const, looksLikeCard: false, lines: [
      { date: '2026-11-10', amount: -30000, description: 'pagamento de fatura nubank', externalId: null },
    ] };
    const rows = buildImportRows(s, st, { cardId: null, accountId: null }, TODAY);
    expect(rows[0].suggestion).toMatchObject({ type: 'fatura', invoiceDate: '2026-11-10', invoiceTotal: 30000 });
  });
  it('no extrato do cartão, "pagamento recebido" é pulado', () => {
    const rows = buildImportRows(base(), parseOFX(OFX_CARTAO), { cardId: 'nu', accountId: null }, TODAY);
    expect(rows[1]).toMatchObject({ suggestion: { type: 'pagamento-no-cartao' }, decision: 'pular' });
    expect(rows[0].categoryId).toBe('c-ass');
  });
  it('compra parecida em outro destino não é considerada duplicada', () => {
    const s = base({ transactions: [tx({ amount: 5590, date: '2026-11-10', cardId: null })] });
    const rows = buildImportRows(s, parseOFX(OFX_CARTAO), { cardId: 'nu', accountId: null }, TODAY);
    expect(rows[0].suggestion).toBeNull();
  });
});

describe('fatura em pdf', () => {
  const linhas = [
    'Resumo da fatura | Vencimento: 10/12/2026',
    'Total desta fatura 1.234,56',
    'Lançamentos: compras e saques',
    '05/11 MERCADO EXTRA 120,50 | 08/11 UBER *TRIP 23,90',
    '15/08 LOJA DE MOVEIS 03/10 200,00',
    '12/11 PAGAMENTO EFETUADO - 800,00',
    '20/11 NETFLIX.COM 55,90',
  ];
  it('lê compras em duas colunas, parcelas e o vencimento', () => {
    const st = parseCardPdf(linhas);
    expect(st.invoiceDueDate).toBe('2026-12-10');
    expect(st.lines.map((l) => [l.date, l.description, l.amount])).toEqual([
      ['2026-11-05', 'mercado extra', -12050],
      ['2026-11-08', 'uber *trip', -2390],
      ['2026-08-15', 'loja de moveis 03/10', -20000],
      ['2026-11-12', 'pagamento efetuado', 80000],
      ['2026-11-20', 'netflix.com', -5590],
    ]);
  });
  it('parcelamento registrado na conta é reconhecido na fatura (caso real: iof refinanciamento)', () => {
    const card = { ...nubank, closingDay: 3, dueDay: 10 };
    const parcelamento = { id: 'r9', kind: 'despesa' as const, amount: 9355, description: 'parcelamento fatura', categoryId: null,
      paymentMethod: null, dayOfMonth: 25, startMonth: '2026-10', occurrences: 6, skippedDates: [], createdAt: '' };
    const st = parseCardPdf(['Vencimento: 10/12/2026', '06/11 IOF REFINANCIAMENTO DE 93,55']);
    const rows = buildImportRows(base({ cards: [card], recurrences: [parcelamento] }), st, { cardId: 'nu', accountId: null }, '2026-12-01');
    expect(rows[0].suggestion).toMatchObject({ type: 'previsao', entry: { recurrenceId: 'r9', originalDate: '2026-11-25' } });
    expect(rows[0].decision).toBeNull();
  });
  it('parcelas antigas caem no período da fatura; pagamento é pulado', () => {
    const card = { ...nubank, closingDay: 3, dueDay: 10 };
    const rows = buildImportRows(base({ cards: [card] }), parseCardPdf(linhas), { cardId: 'nu', accountId: null }, '2026-12-01');
    const parcela = rows.find((r) => r.description.startsWith('loja'));
    expect(parcela?.date).toBe('2026-11-04');
    expect(rows.find((r) => r.description === 'pagamento efetuado')?.decision).toBe('pular');
  });
});
