import { describe, expect, it } from 'vitest';
import { buildImportRows, decodeBytes, guessCategory, parseCSV, parseOFX, parseStatement } from '../importer';
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
    categories: cats, transactions: [], recurrences: [], budgets: [], goals: [], cards: [nubank], ...over,
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
    expect(st.lines).toEqual([
      { date: '2026-11-12', amount: -12000, description: 'supermercado bom preco', externalId: 'ofx:A1' },
      { date: '2026-11-05', amount: 560000, description: 'pagto salario empresa x', externalId: 'ofx:A2' },
      { date: '2026-11-13', amount: -150000, description: 'pix enviado aluguel apto', externalId: 'ofx:A3' },
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
    expect(st.lines[0]).toEqual({ date: '2026-11-12', amount: -12000, description: 'padaria', externalId: 'csv:abc-1' });
  });
  it('csv com ponto e vírgula', () => {
    const st = parseCSV('Data;Histórico;Valor\n01/11/2026;Farmácia;-35,90');
    expect(st.lines[0]).toMatchObject({ date: '2026-11-01', amount: -3590, description: 'farmácia' });
  });
  it('tira prefixos do banco mas mantém o resto', () => {
    const st = parseCSV('Data,Valor,Descrição\n01/11/2026,-10,Transferência recebida - João\n01/11/2026,-5,PIX ENVIADO');
    expect(st.lines.map((l) => l.description)).toEqual(['joão', 'pix enviado']);
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
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), null, TODAY);
    expect(rows[0].suggestion?.type).toBe('parecida');
    expect(rows[0].decision).toBeNull(); // a pessoa precisa responder
  });
  it('não pergunta duas vezes sobre o mesmo lançamento', () => {
    const s = base({ transactions: [tx({ amount: 12000, date: '2026-11-12' })] });
    const st = { format: 'csv' as const, looksLikeCard: false, lines: [
      { date: '2026-11-12', amount: -12000, description: 'a', externalId: null },
      { date: '2026-11-12', amount: -12000, description: 'b', externalId: null },
    ] };
    const rows = buildImportRows(s, st, null, TODAY);
    expect(rows.map((r) => r.suggestion?.type ?? null)).toEqual(['parecida', null]);
  });
  it('linha já importada é pulada sem perguntar', () => {
    const s = base({ transactions: [tx({ externalId: 'ofx:A1', amount: 12000, date: '2026-11-12' })] });
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), null, TODAY);
    expect(rows[0]).toMatchObject({ suggestion: { type: 'ja-importada' }, decision: 'pular' });
  });
  it('conta fixa prevista vira pergunta "é isso?", mesmo com valor um pouco diferente', () => {
    const s = base({
      recurrences: [{ id: 'r1', kind: 'despesa', amount: 145000, description: 'aluguel', categoryId: 'c-mor', paymentMethod: null,
        dayOfMonth: 15, startMonth: '2026-11', occurrences: null, skippedDates: [], createdAt: '' }],
    });
    const rows = buildImportRows(s, parseOFX(OFX_CONTA), null, TODAY);
    expect(rows[2].suggestion).toMatchObject({ type: 'previsao', entry: { recurrenceId: 'r1', originalDate: '2026-11-15' } });
    expect(rows[2].categoryId).toBe('c-mor');
  });
  it('pagamento de fatura no extrato da conta é reconhecido', () => {
    const s = base({ transactions: [tx({ amount: 30000, cardId: 'nu', date: '2026-11-02' })] }); // fatura vence 10/11
    const st = { format: 'csv' as const, looksLikeCard: false, lines: [
      { date: '2026-11-10', amount: -30000, description: 'pagamento de fatura nubank', externalId: null },
    ] };
    const rows = buildImportRows(s, st, null, TODAY);
    expect(rows[0].suggestion).toMatchObject({ type: 'fatura', invoiceDate: '2026-11-10', invoiceTotal: 30000 });
  });
  it('no extrato do cartão, "pagamento recebido" é pulado', () => {
    const rows = buildImportRows(base(), parseOFX(OFX_CARTAO), 'nu', TODAY);
    expect(rows[1]).toMatchObject({ suggestion: { type: 'pagamento-no-cartao' }, decision: 'pular' });
    expect(rows[0].categoryId).toBe('c-ass');
  });
  it('compra parecida em outro destino não é considerada duplicada', () => {
    const s = base({ transactions: [tx({ amount: 5590, date: '2026-11-10', cardId: null })] });
    const rows = buildImportRows(s, parseOFX(OFX_CARTAO), 'nu', TODAY);
    expect(rows[0].suggestion).toBeNull();
  });
});
