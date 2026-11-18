/**
 * importação de extratos (ofx, csv, planilha .xlsx e pdf).
 *
 * tudo acontece no aparelho: o arquivo do banco não é enviado para lugar nenhum.
 * só as movimentações que a pessoa confirmar são salvas, como se tivessem sido digitadas.
 *
 * convenção dos valores lidos: negativo = dinheiro saindo (ou compra no cartão),
 * positivo = dinheiro entrando (ou estorno/pagamento no cartão).
 */
import { addDays, daysInclusive, lastDay, monthOf, type ISODate } from './dates';
import {
  cardInvoices,
  installmentDateIn,
  invoiceDueFor,
  invoicePeriod,
  recurrenceOccurrences,
  upcomingEntries,
  type Entry,
} from './finance';
import { formatMoney, parseMoney, type Cents } from './money';
import { buildCellRows, buildLines, readTable, splitColumns, type TableRow, type TextPiece } from './pdfLayout';
import type { Card, Category, Kind, PaymentMethod, Snapshot, Transaction } from './types';

export interface StatementLine {
  date: ISODate;
  /** negativo = saída/compra; positivo = entrada/estorno. */
  amount: Cents;
  description: string;
  externalId: string | null;
  /** forma de pagamento percebida pela descrição (pix, débito...). */
  method?: PaymentMethod | null;
  /** cartão: fatura (vencimento) em que a compra entrou, quando a data é de antes do período dela. */
  invoiceDate?: ISODate | null;
}

export interface ParsedStatement {
  format: 'ofx' | 'csv' | 'pdf' | 'xlsx';
  lines: StatementLine[];
  /** o arquivo parece ser de cartão de crédito. */
  looksLikeCard: boolean;
  /** fatura em pdf: vencimento encontrado no documento. */
  invoiceDueDate?: ISODate | null;
  /**
   * fatura em pdf: conferência com os totais impressos ("total dos pagamentos", "lançamentos no cartão"...).
   * `expected` = soma dos totais da fatura; `found` = soma do que foi lido (compras positivas). vazio = sem totais.
   */
  invoiceCheck?: { expected: Cents; found: Cents } | null;
}

// ---------- leitura do arquivo ----------

/** decodifica o arquivo: utf-8, ou latin-1 (comum em extratos de bancos brasileiros). */
export function decodeBytes(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
    return out;
  }
}

/** limite de tamanho da descrição (o mesmo do banco de dados). */
export const MAX_DESCRIPTION = 80;

/** corta um texto no limite, sem deixar espaço no fim. */
export function fitDescription(s: string): string {
  const t = s.trim();
  return t.length <= MAX_DESCRIPTION ? t : `${t.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
}

/** prefixos que os bancos colocam e o que eles dizem sobre a forma de pagamento. */
const PREFIXES: [RegExp, PaymentMethod | null][] = [
  [/^transfer[eê]ncia (enviada|recebida)( pelo pix)?/i, 'pix'],
  [/^pix (enviado|recebido)/i, 'pix'],
  [/^(compra (no |com )?|pagamento (via |com |no )?)pix/i, 'pix'],
  [/^compra (no |com )?(cart[aã]o de )?d[eé]bito( via nupay)?/i, 'debito'],
  [/^compra (no |com )?(cart[aã]o de )?cr[eé]dito/i, 'credito'],
  [/^compra cart[aã]o/i, null],
  [/^pagamento de boleto( efetuado)?/i, 'boleto'],
  [/^(ted|doc|transfer[eê]ncia)( enviada| recebida)?/i, 'transferencia'],
];

/** pedaços que só trazem dados do banco (cpf/cnpj mascarados, agência, conta...). */
const BANK_DETAILS = /•|\*\*\*|\d{2,3}\.\d{3}\.\d{3}|\/0001|ag[eê]ncia|conta:|\(\d{3,4}\)|institui[cç][aã]o de pagamento|\bs\.?a\.?$/i;

/** limpa a descrição do extrato e descobre a forma de pagamento, quando dá. */
/** "06/1 0" ou "0 6/10" (número da parcela quebrado pelo pdf) vira "06/10". */
function fixSplitInstallment(text: string): string {
  return text.replace(/(?:^|\s)(\d) ?(\d)? ?\/ ?(\d) ?(\d)?$/, (match, a: string, b = '', c: string, d = '') => {
    const n = Number(a + b);
    const total = Number(c + d);
    if (!(b || d) || total < 2 || total > 48 || n < 1 || n > total) return match;
    return ` ${(a + b).padStart(2, '0')}/${(c + d).padStart(2, '0')}`;
  });
}

export function cleanDescription(raw: string): { description: string; method: PaymentMethod | null } {
  const base = fixSplitInstallment(
    raw
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase(),
  ).trim();
  let rest = base;
  let method: PaymentMethod | null = null;
  for (const [re, m] of PREFIXES) {
    const match = rest.match(re);
    if (match) {
      method = m;
      rest = rest.slice(match[0].length).replace(/^\s*[-–:]\s*/, '');
      break;
    }
  }
  // fica com os pedaços até aparecer o primeiro com dados do banco.
  const parts = rest.split(/\s+[-–]\s+/);
  const kept: string[] = [];
  for (const part of parts) {
    if (BANK_DETAILS.test(part)) break;
    kept.push(part);
  }
  const description = fitDescription(kept.join(' - ').trim() || base);
  return { description, method };
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

function ofxDate(raw: string): ISODate | null {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parseOFX(text: string): ParsedStatement {
  const looksLikeCard = /<CREDITCARDMSGSRSV1>|<CCSTMTRS>/i.test(text);
  const lines: StatementLine[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>|<\/BANKTRANLIST>/i)[0];
    const field = (tag: string) => block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, 'i'))?.[1]?.trim() ?? '';
    const date = ofxDate(field('DTPOSTED'));
    const amount = parseMoney(field('TRNAMT'));
    if (!date || amount === null || amount === 0) continue;
    const { description, method } = cleanDescription(field('MEMO') || field('NAME') || field('PAYEE') || 'movimentação');
    const fitId = field('FITID');
    lines.push({ date, amount, description, method, externalId: fitId ? `ofx:${fitId}` : null });
  }
  return { format: 'ofx', lines, looksLikeCard };
}

/** divide uma linha de csv respeitando aspas. */
function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function csvDate(raw: string): ISODate | null {
  const v = raw.trim();
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

const DATE_COLS = ['date', 'data', 'data lancamento', 'data de lancamento', 'data da compra', 'dt'];
const AMOUNT_COLS = ['amount', 'valor', 'valor (r$)', 'valor r$', 'valor em r$', 'quantia'];
const DESC_COLS = ['title', 'descricao', 'historico', 'lancamento', 'estabelecimento', 'memo', 'description', 'detalhe'];
const ID_COLS = ['identificador', 'id', 'codigo'];

export function parseCSV(text: string): ParsedStatement {
  const rows = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (rows.length < 2) return { format: 'csv', lines: [], looksLikeCard: false };
  const sep = (rows[0].match(/;/g) ?? []).length > (rows[0].match(/,/g) ?? []).length ? ';' : ',';
  const header = splitCsvLine(rows[0], sep).map(normalize);
  const find = (names: string[]) => header.findIndex((h) => names.includes(h));
  const iDate = find(DATE_COLS);
  const iAmount = find(AMOUNT_COLS);
  const iDesc = find(DESC_COLS);
  const iId = find(ID_COLS);
  if (iDate < 0 || iAmount < 0) return { format: 'csv', lines: [], looksLikeCard: false };

  const lines: StatementLine[] = [];
  for (const row of rows.slice(1)) {
    const cols = splitCsvLine(row, sep);
    const date = csvDate(cols[iDate] ?? '');
    const amount = parseMoney(cols[iAmount] ?? '');
    if (!date || amount === null || amount === 0) continue;
    const id = iId >= 0 ? cols[iId] : '';
    const { description, method } = cleanDescription((iDesc >= 0 ? cols[iDesc] : '') || 'movimentação');
    lines.push({ date, amount, description, method, externalId: id ? `csv:${id}` : null });
  }
  // fatura de cartão em csv (ex.: nubank "date,title,amount") lista compras como valores positivos.
  const positives = lines.filter((l) => l.amount > 0).length;
  const looksLikeCard = header.includes('title') && positives > lines.length / 2;
  if (looksLikeCard) for (const l of lines) l.amount = -l.amount;
  return { format: 'csv', lines, looksLikeCard };
}

// ---------- planilha .xlsx (itaú e outros) ----------

/** data de uma célula: número de dias do excel (46332 = 06/11/2026), "06/11/2026" ou "2026-11-06". */
function sheetDate(raw: string): ISODate | null {
  const v = raw.trim();
  if (/^\d{5}(\.\d+)?$/.test(v)) return addDays('1899-12-30', Math.floor(Number(v)));
  return csvDate(v);
}

/** valor de uma célula: número do excel ("56.9", "-1299.65") ou texto ("R$ 56,90"). */
function sheetMoney(raw: string): Cents | null {
  const v = raw.trim();
  if (/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v)) return Math.round(Number(v) * 100);
  return parseMoney(v);
}

const INSTALLMENT_COLS = ['parcelamento', 'parcela', 'parcelas'];
const CREDIT_COLS = ['credito', 'creditos', 'entrada', 'entradas'];
const DEBIT_COLS = ['debito', 'debitos', 'saida', 'saidas'];

/**
 * lê a planilha do banco: procura a linha de cabeçalho (data, lançamento, valor...) e lê as linhas abaixo.
 * fatura de cartão (ex.: itaú "fatura fechada"): compras vêm positivas e pagamentos/estornos negativos.
 * extrato de conta: o valor já vem com o sinal (ou em colunas de entrada e saída).
 */
export function parseSpreadsheet(grid: string[][]): ParsedStatement {
  const norm = grid.map((row) => row.map((c) => normalize(c ?? '').trim()));
  const all = norm.flat().join(' ');
  const looksLikeCard = /fatura|cartao/.test(all);

  const headerAt = norm.findIndex(
    (row) =>
      row.some((c) => DATE_COLS.includes(c)) &&
      row.some((c) => DESC_COLS.includes(c)) &&
      (row.some((c) => AMOUNT_COLS.includes(c)) || row.some((c) => DEBIT_COLS.includes(c))),
  );
  if (headerAt < 0) return { format: 'xlsx', lines: [], looksLikeCard };
  const header = norm[headerAt];
  const col = (names: string[]) => header.findIndex((c) => names.includes(c));
  const iDate = col(DATE_COLS);
  const iDesc = col(DESC_COLS);
  const iAmount = col(AMOUNT_COLS);
  const iCredit = col(CREDIT_COLS);
  const iDebit = col(DEBIT_COLS);
  const iInstallment = col(INSTALLMENT_COLS);

  // vencimento da fatura: célula "vencimento" com a data logo abaixo
  let invoiceDueDate: ISODate | null = null;
  for (let r = 0; r < headerAt && !invoiceDueDate; r++) {
    const c = norm[r].indexOf('vencimento');
    if (c >= 0) invoiceDueDate = sheetDate(grid[r + 1]?.[c] ?? '');
  }

  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  for (const row of grid.slice(headerAt + 1)) {
    const date = sheetDate(row[iDate] ?? '');
    const rawDesc = (row[iDesc] ?? '').trim();
    if (!date || !rawDesc) continue;
    let value: Cents | null;
    if (iAmount >= 0) value = sheetMoney(row[iAmount] ?? '');
    else value = (sheetMoney(row[iCredit] ?? '') ?? 0) - Math.abs(sheetMoney(row[iDebit] ?? '') ?? 0);
    if (!value) continue;
    // na fatura, compra positiva = dinheiro saindo
    const amount = looksLikeCard && iAmount >= 0 ? -value : value;
    // "parcela 2 de 12" vira "02/12" no nome, como nas faturas em pdf
    const parcel = normalize(row[iInstallment] ?? '').match(/(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/);
    const withParcel = parcel ? `${rawDesc} ${parcel[1].padStart(2, '0')}/${parcel[2].padStart(2, '0')}` : rawDesc;
    const { description, method } = cleanDescription(withParcel);
    const base = `xlsx:${date}:${description}:${amount}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    lines.push({ date, amount, description, method, externalId: `${base}:${n}` });
  }
  return { format: 'xlsx', lines, looksLikeCard, invoiceDueDate };
}

// ---------- fatura em pdf (itaú e parecidos) ----------

const PDF_TX = /(\d{2})\/(\d{2})\s+(.+?)\s+(-\s?)?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g;
const PDF_SKIP_COMPACT = /^total|saldo(anterior|emaberto)|^lancamentos|faturaanterior|pagamentominimo|valorminimo|vencimento|creditorotativo|parcelamentodefaturasimula/;
/** linhas de total da fatura (compras, pagamentos, produtos e serviços), sem as das próximas faturas. */
const INVOICE_TOTAL = /^(totaldospagamentos|lancamentosnocartao|lancamentosprodutoseservicos|totaldoslancamentos|totaldascompras|lancamentosnacional|totaldelancamentos)/;
const PDF_SKIP = /total|saldo (anterior|em aberto)|lan[cç]amentos|limite|fatura anterior|pagamento m[ií]nimo|valor m[ií]nimo|vencimento|cr[eé]dito rotativo|parcelamento de fatura - simula/i;

// categorias que o itaú escreve embaixo de cada compra ("outros são paulo"): não fazem parte do nome.
const CARD_CATEGORY_LINE = /^(outros|servi[cç]os|viagem|transporte|supermercado|alimenta[cç][aã]o|restaurante|sa[uú]de|educa[cç][aã]o|vestu[aá]rio|hobby|diversos|lazer|eletr[oô]nicos|casa|ve[ií]culos|turismo|entretenimento|farm[aá]cia|combust[ií]vel|moradia)\b/i;
const CARD_CATEGORY_COMPACT = /^(outros|servicos|viagem|transporte|supermercado|alimentacao|restaurante|saude|educacao|vestuario|hobby|diversos|lazer|eletronicos|veiculos|turismo|entretenimento|farmacia|combustivel|moradia)/;
const NOT_WRAP = /^(data|valor|total|r\$|lan[cç]amentos|compras|pagamentos|principal|juros|encargos|pr[oó]xima|limite|vencimento)/i;

/** o nome da compra quebrou em duas linhas na coluna estreita? ("seg cartao" + "protegido") */
function isWrappedName(next: string, description: string): boolean {
  const t = next.trim();
  if (!t || t.length > 30 || t.split(/\s+/).length > 3) return false;
  if (/\d{2}\/\d{2}|\d,\d{2}|[()|]/.test(t) || NOT_WRAP.test(t) || CARD_CATEGORY_LINE.test(t)) return false;
  if (CARD_CATEGORY_COMPACT.test(compactKey(t))) return false;
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (!letters) return false;
  // nome em maiúsculas continua em maiúsculas
  if (letters === letters.toUpperCase()) return description === description.toUpperCase();
  // nome escrito normal ("Pagamento débito") continua em minúsculas ("mínimo")
  const rest = description.slice(1);
  return letters === letters.toLowerCase() && rest === rest.toLowerCase();
}

/** junta ao nome da compra o pedaço que caiu na linha de baixo. */
function joinWrappedLines(textLines: string[]): string[] {
  const out: string[] = [];
  for (const line of textLines) {
    const prev = out[out.length - 1];
    const found = prev !== undefined && !prev.includes(' | ') ? [...prev.matchAll(PDF_TX)] : [];
    const tx = found.length === 1 ? found[0] : null;
    const endsWithValue = tx && tx.index + tx[0].length >= prev.trimEnd().length;
    if (tx && endsWithValue && isWrappedName(line, tx[3])) {
      const cut = tx.index + tx[0].indexOf(tx[3]) + tx[3].length;
      out[out.length - 1] = `${prev.slice(0, cut)} ${line.trim()}${prev.slice(cut)}`;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * lê as linhas de texto de uma fatura de cartão em pdf. cada compra aparece como
 * "dd/mm descrição valor" (às vezes duas colunas na mesma linha). o ano vem do vencimento.
 */
export function parseCardPdf(textLines: string[]): ParsedStatement {
  // sem espaços: alguns pdfs (itaú) desenham o texto em pedaços ("ven ci men to: 2 1/10/2026")
  const all = textLines.join(' ').replace(/\s+/g, '');
  const due = all.match(/vencimento\D{0,30}?(\d{2})\/(\d{2})\/(\d{4})/i);
  const invoiceDueDate = due ? `${due[3]}-${due[2]}-${due[1]}` : null;
  const dueYear = due ? Number(due[3]) : new Date().getFullYear();
  const dueMonth = due ? Number(due[2]) : 12;

  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  // a seção "compras parceladas - próximas faturas" lista parcelas futuras: não entram agora.
  let skipping = false;
  let expected: Cents = 0;
  let totals = 0;
  for (const textLine of joinWrappedLines(textLines)) {
    const key = compactKey(textLine);
    if (/proximasfaturas/.test(key)) {
      skipping = true;
      continue;
    }
    if (/^(lancamentos|pagamentosefetuados|encargos)/.test(key)) skipping = false;
    if (skipping) continue;
    // totais impressos na fatura, para conferir se lemos tudo
    const total = INVOICE_TOTAL.test(key) ? textLine.match(/(-)?\s?(\d{1,3}(?:\.\d{3})*,\d{2})$/) : null;
    if (total) {
      expected += (total[1] ? -1 : 1) * (parseMoney(total[2]) ?? 0);
      totals++;
      continue;
    }
    for (const segment of textLine.split(' | ')) {
      for (const m of segment.matchAll(PDF_TX)) {
        const [, dd, mm, rawDesc, minus, value] = m;
        if (PDF_SKIP.test(rawDesc) || PDF_SKIP_COMPACT.test(compactKey(rawDesc))) continue;
        const day = Number(dd);
        const month = Number(mm);
        if (day < 1 || day > 31 || month < 1 || month > 12) continue;
        const year = month > dueMonth ? dueYear - 1 : dueYear;
        const cents = parseMoney(value);
        if (!cents) continue;
        const date = `${year}-${mm}-${dd}`;
        const { description, method } = cleanDescription(rawDesc.replace(/\s+R\$$/, ''));
        // na fatura, compras vêm positivas e créditos (estornos, pagamentos) com "-".
        const amount = minus ? cents : -cents;
        const base = `pdf:${date}:${description}:${amount}`;
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        lines.push({ date, amount, description, method, externalId: `${base}:${n}` });
      }
    }
  }
  const found = lines.reduce((sum, l) => sum - l.amount, 0);
  const invoiceCheck = totals ? { expected, found } : null;
  return { format: 'pdf', lines, looksLikeCard: true, invoiceDueDate, invoiceCheck };
}

/** texto sem acentos, espaços nem pontuação: "La nça me nt os" vira "lancamentos". */
function compactKey(text: string): string {
  return normalize(text).replace(/[^a-z0-9]/g, '');
}

/** cartão: transforma as células de uma linha (data | nome | valor) em "dd/mm nome valor". */
export function cardRowText(cells: string[]): string {
  const last = cells[cells.length - 1] ?? '';
  const amount = last.replace(/\s+/g, '').match(/^(-)?(?:R\$)?(\d{1,3}(?:\.\d{3})*,\d{2})$/i);
  if (cells.length >= 2 && amount) {
    const value = `${amount[1] ?? ''}${amount[2]}`;
    // data no começo, mesmo quebrada pelo pdf ("1 1/1 0")
    const date = cells[0].match(/^(\d)\s?(\d)\s?\/\s?(\d)\s?(\d)(?:\s+(.*))?$/);
    if (date) {
      const desc = [date[5] ?? '', ...cells.slice(1, -1)].join(' ').trim();
      if (desc) return `${date[1]}${date[2]}/${date[3]}${date[4]} ${desc} ${value}`;
    }
    return [...cells.slice(0, -1), value].join(' ');
  }
  return cells.join(' ');
}

// ---------- extrato de conta em pdf (itaú, nubank, bradesco, bb...) ----------

const MONTHS_PT: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};
const MONEY = /(-\s?|\+\s?)?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(\s?[-DC](?![a-z]))?(?![\d,])/gi;
const ACCOUNT_SKIP = /saldo|^total|resumo|lan[cç]amentos futuros|per[ií]odo|ag[eê]ncia|^conta\b|extrato|limite/i;
const OUT_WORDS = /enviad|pagamento|compra|saque|d[eé]bito|tarifa|pix env|transf(er[eê]ncia)? env|boleto|aplica[cç][aã]o/i;
const IN_WORDS = /recebid|dep[oó]sito|sal[aá]rio|cr[eé]dito|estorno|rendimento|resgate|devolu/i;

/** encontra uma data no começo da linha e devolve a data e o resto do texto. */
function leadingDate(line: string, fallbackYear: number): { date: ISODate; rest: string } | null {
  let m = line.match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s*(.*)$/);
  if (m) {
    const year = m[3].length === 2 ? `20${m[3]}` : m[3];
    return { date: `${year}-${m[2]}-${m[1]}`, rest: m[4] };
  }
  m = line.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\.?\s*(\d{4})?\s*(.*)$/i);
  if (m) {
    const month = MONTHS_PT[m[2].toLowerCase()];
    const year = m[3] ? Number(m[3]) : fallbackYear;
    return { date: `${year}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`, rest: m[4] };
  }
  m = line.match(/^(\d{2})\/(\d{2})\s+(.*)$/);
  if (m) return { date: `${fallbackYear}-${m[2]}-${m[1]}`, rest: m[3] };
  return null;
}

/**
 * lê um extrato de conta em pdf. aceita linhas com data ("12/03/2026 pix enviado ... -50,00 1.200,00")
 * e datas que agrupam várias linhas ("01 nov 2026" e, abaixo, os lançamentos do dia).
 * quando há duas quantias na linha, a primeira é o valor e a segunda, o saldo.
 */
export function parseAccountPdf(textLines: string[], todayDate: ISODate): ParsedStatement {
  const years = textLines.join(' ').match(/\b20\d{2}\b/g) ?? [];
  const counts = new Map<number, number>();
  for (const y of years) counts.set(Number(y), (counts.get(Number(y)) ?? 0) + 1);
  const fallbackYear = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? Number(todayDate.slice(0, 4));

  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  let currentDate: ISODate | null = null;
  let section: 1 | -1 | 0 = 0; // +1 entradas, -1 saídas (extratos que separam por seção)

  for (const raw of textLines) {
    let text = raw.trim();
    const dated = leadingDate(text, fallbackYear);
    if (dated) {
      currentDate = dated.date;
      text = dated.rest.trim();
    }
    const lower = normalize(text);
    if (/total de entradas|entradas\b|cr[eé]ditos\b/.test(lower) && !/sa[ií]das/.test(lower)) section = 1;
    if (/total de sa[ií]das|sa[ií]das\b|d[eé]bitos\b/.test(lower)) section = -1;
    if (!currentDate || !text) continue;

    const money = [...text.matchAll(MONEY)];
    if (!money.length) continue;
    const first = money[0];
    const description = text.slice(0, first.index).replace(/[\s|]+$/, '').trim();
    if (!description || ACCOUNT_SKIP.test(description)) continue;

    const cents = parseMoney(first[2]);
    if (!cents) continue;
    const prefix = (first[1] ?? '').trim();
    const suffix = (first[3] ?? '').trim().toUpperCase();
    let sign: 1 | -1;
    if (prefix === '-' || suffix === '-' || suffix === 'D') sign = -1;
    else if (prefix === '+' || suffix === 'C') sign = 1;
    else if (section !== 0) sign = section;
    else if (IN_WORDS.test(normalize(description)) && !OUT_WORDS.test(normalize(description))) sign = 1;
    else sign = -1;

    const { description: clean, method } = cleanDescription(description);
    const amount = sign * cents;
    const base = `pdfc:${currentDate}:${clean}:${amount}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    lines.push({ date: currentDate, amount, description: clean, method, externalId: `${base}:${n}` });
  }
  return { format: 'pdf', lines, looksLikeCard: false };
}

/** transforma as linhas de uma tabela (data | descrição | valor) em lançamentos. */
function tableToStatement(rows: TableRow[]): ParsedStatement {
  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  for (const r of rows) {
    const m = r.date.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (!m) continue;
    const date = `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2]}-${m[1]}`;
    if (ACCOUNT_SKIP.test(r.description) && /saldo/i.test(r.description)) continue;
    const money = [...r.amount.matchAll(MONEY)][0];
    const cents = money ? parseMoney(money[2]) : null;
    if (!money || !cents) continue;
    const prefix = (money[1] ?? '').trim();
    const suffix = (money[3] ?? '').trim().toUpperCase();
    const sign = prefix === '-' || suffix === '-' || suffix === 'D' ? -1 : 1;
    const { description, method } = cleanDescription(r.description);
    const amount = sign * cents;
    const base = `pdft:${date}:${description}:${amount}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    lines.push({ date, amount, description, method, externalId: `${base}:${n}` });
  }
  return { format: 'pdf', lines, looksLikeCard: false };
}

/**
 * lê um pdf a partir dos pedaços de texto de cada página: extrato em tabela (itaú...),
 * extrato em linhas (nubank...) ou fatura de cartão (com uma ou duas colunas).
 */
export function parsePdfPages(pages: TextPiece[][], todayDate: ISODate, preferCard: boolean): ParsedStatement {
  const allLines = pages.flatMap((p) => buildLines(p));
  const text = compactKey(allLines.join(' '));
  const looksCard = /fatura|cartaodecredito|pagamentominimo|limitedecredito|limitedisponivel|vencimento/.test(text);
  const card = () =>
    parseCardPdf(pages.flatMap((p) => splitColumns(p).flatMap((col) => buildCellRows(col).map(cardRowText))));
  const account = () => {
    const table = readTable(pages);
    if (table && table.length) return tableToStatement(table);
    return parseAccountPdf(allLines, todayDate);
  };
  // a pessoa escolheu um cartão: só a leitura de fatura vale (evita trazer totais e resumos).
  if (preferCard) return card();
  if (looksCard) {
    const c = card();
    return c.lines.length ? c : account();
  }
  const a = account();
  return a.lines.length ? a : card();
}

/** decide se o pdf é fatura de cartão ou extrato de conta, e lê do jeito certo. */
export function parsePdfStatement(textLines: string[], todayDate: ISODate, preferCard: boolean): ParsedStatement {
  const text = compactKey(textLines.join(' '));
  const looksCard = /fatura|cartaodecredito|pagamentominimo|limitedecredito|limitedisponivel|vencimento/.test(text);
  const card = parseCardPdf(textLines);
  const account = parseAccountPdf(textLines, todayDate);
  if (preferCard || looksCard) return card.lines.length ? card : account;
  return account.lines.length ? account : card;
}

export function parseStatement(text: string): ParsedStatement {
  return /<OFX>|OFXHEADER/i.test(text) ? parseOFX(text) : parseCSV(text);
}

// ---------- categorias sugeridas ----------

const RULES: [string, RegExp][] = [
  ['assinaturas', /netflix|spotify|disney|hbo|\bmax\b|prime video|amazon prime|youtube|apple\.com|icloud|google one|deezer|globoplay|paramount|crunchyroll/],
  ['alimentacao', /mercado|supermerc|atacad|assai|carrefour|pao de acucar|padaria|hortifruti|ifood|rappi|restaur|lanchonete|burger|mc ?donald|pizza|cafe|acougue|sacolao/],
  ['transporte', /uber|\b99\b|99app|99 pop|taxi|cabify|metro|onibus|bilhete|posto|combust|shell|ipiranga|petrobras|estacion|sem parar|veloe|conectcar|pedagio/],
  ['saude', /farmacia|drogaria|droga raia|drogasil|pague menos|hospital|clinica|laborat|unimed|amil|hapvida|dentist|smart ?fit|academia/],
  ['moradia', /aluguel|condominio|enel|cpfl|light|cemig|copel|sabesp|energia|\bagua\b|\bluz\b|\bgas\b|internet|vivo|claro|\btim\b|oi fibra/],
  ['compras', /amazon|mercado ?livre|mercadolivre|shopee|magalu|magazine|americanas|shein|renner|riachuelo|c&a|zara|aliexpress/],
  ['educacao', /escola|faculdade|universidade|curso|udemy|alura|livraria|mensalidade/],
  ['lazer', /cinema|ingresso|sympla|show|steam|playstation|xbox|nintendo|hotel|airbnb|booking|bar\b/],
  ['salario', /salario|folha de pag|pagto salario|remuneracao|vencimentos/],
  ['renda-extra', /rendimento|juros|cashback|reembolso/],
];

/** sugere uma categoria do usuário pela descrição. */
export function guessCategory(description: string, kind: Kind, categories: Category[]): string | null {
  const d = normalize(description);
  for (const [icon, re] of RULES) {
    if (!re.test(d)) continue;
    const cat = categories.find(
      (c) => !c.archived && c.icon === icon && (c.kind === kind || c.kind === 'ambos'),
    );
    if (cat) return cat.id;
  }
  return null;
}

// ---------- o que já existe ----------

/** o que o teo quer perguntar ou avisar sobre uma linha. */
export type Suggestion =
  /** essa linha já foi importada antes (mesmo identificador do banco). */
  | { type: 'ja-importada'; fix?: Transaction }
  /** parece com um lançamento que já existe. */
  | { type: 'parecida'; transaction: Transaction; sameDay: boolean }
  /** parece com algo previsto (conta fixa, parcela, conta pendente). */
  | { type: 'previsao'; entry: Entry }
  /** no extrato da conta: parece o pagamento de uma fatura. */
  | { type: 'fatura'; card: Card; invoiceDate: ISODate; invoiceTotal: Cents }
  /** no extrato do cartão: é o pagamento da fatura, que já aparece na conta. */
  | { type: 'pagamento-no-cartao' }
  /** pix/transferência que parece ser para outra conta da própria pessoa (nome dela, ou já marcado antes). */
  | { type: 'minha-conta'; reason: 'nome' | 'antes'; existing?: Transaction };

/** transferencia = dinheiro entre contas da própria pessoa: não é gasto nem receita. */
export type Decision = 'importar' | 'pular' | 'vincular' | 'transferencia';

/** transferência para uma conta que não está cadastrada no teo. */
export const OUTSIDE_TEO = 'fora';

export interface ImportRow {
  key: string;
  line: StatementLine;
  kind: Kind;
  amount: Cents;
  date: ISODate;
  description: string;
  /** observação opcional escrita pela pessoa na prévia. */
  note: string;
  categoryId: string | null;
  suggestion: Suggestion | null;
  /** null = a pessoa ainda precisa responder a pergunta. */
  decision: Decision | null;
  /** compra parcelada percebida pela descrição (ex.: "loja 06/10"). */
  installment: { n: number; total: number; base: string } | null;
  /** lançar também as outras parcelas? */
  installmentChoice: InstallmentChoice;
  /** cartão: fatura (vencimento) em que a compra entrou, se for diferente da que a data indica. */
  invoiceDate: ISODate | null;
  /** o teo teve certeza (mesmo nome e diferença de centavos) e já respondeu a pergunta sozinho. */
  autoMatched?: boolean;
  /** transferência entre contas: a outra conta (id, null = conta principal, OUTSIDE_TEO = fora do teo). */
  transferTo?: string | null;
}

const TRANSFER_RE = /\bpix\b|transf|\bted\b|\bdoc\b|\btef\b/;

/** o nome da pessoa aparece na descrição? ("pix transf viniciu11 10" com o nome "vini") */
export function mentionsOwnName(description: string, ownName: string): boolean {
  const names = normalize(ownName).split(/[^a-z]+/).filter((n) => n.length >= 3);
  const words = normalize(description).split(/[^a-z]+/).filter((w) => w.length >= 3);
  return names.some((n) =>
    words.some((w) => w === n || (Math.min(n.length, w.length) >= 4 && (w.startsWith(n) || n.startsWith(w)))),
  );
}

/** descrição sem números (datas e códigos mudam a cada pix: "viniciu11 10" e "viniciu16 10"). */
const withoutDigits = (text: string) => text.replace(/\d+/g, ' ');

export type InstallmentChoice = 'so-esta' | 'proximas' | 'todas';

/** "loja x 06/10", "loja parc 6/10", "loja 6 de 10" → parcela 6 de 10. */
export function detectInstallment(description: string): { n: number; total: number; base: string } | null {
  const m = description.match(/^(.*?)[\s-]*(?:parc(?:ela)?\.?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i);
  if (!m) return null;
  const n = Number(m[2]);
  const total = Number(m[3]);
  if (total < 2 || total > 48 || n < 1 || n > total) return null;
  const base = m[1].trim();
  return base ? { n, total, base } : null;
}

const INVOICE_PAYMENT_RE = /fatura|pagamento (de )?cart|pgto cart|pag cart|cartao de credito|pagto cartao|pgto min|pgto fat|pagamento minimo/;
const CARD_PAYMENT_RE = /pagamento (recebido|efetuado)|pgto recebido|pagamento de fatura|pagamento fatura|credito de pagamento|pagamento debito|pagamento minimo/;
// os mesmos, sem espaços (pdfs que desenham o texto em pedaços: "pa gam ento d ebi to")
const INVOICE_PAYMENT_COMPACT = /fatura|pagamentod?e?cart|pgtocart|pagcart|cartaodecredito|pagtocartao|pgtomin|pgtofat|pagamentominimo/;
const CARD_PAYMENT_COMPACT = /pagamento(recebido|efetuado)|pgtorecebido|pagamento(de)?fatura|creditodepagamento|pagamentodebito|pagamentominimo/;

const near = (a: ISODate, b: ISODate, days: number) => {
  const [x, y] = a <= b ? [a, b] : [b, a];
  return daysInclusive(x, y) - 1 <= days;
};

/** nomes parecidos: têm alguma palavra (de 4+ letras) em comum. */
function similarText(a: string, b: string): boolean {
  const words = (x: string) => new Set(normalize(x).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  const wa = words(a);
  for (const w of words(b)) if (wa.has(w)) return true;
  return false;
}

/** valores "parecidos": iguais, ou até 15% de diferença (conta de luz que variou). */
const similarAmount = (a: Cents, b: Cents) => a === b || Math.abs(a - b) <= Math.max(a, b) * 0.15;

/** diferença de centavos (arredondamento de parcelas): até 10 centavos ou 0,5% do valor. */
export const centsApart = (a: Cents, b: Cents) => Math.abs(a - b) <= Math.max(10, Math.round(Math.max(a, b) * 0.005));

/**
 * quão parecidos são dois nomes, de 0 a 1. ignora maiúsculas, acentos, espaços, pontuação e o número
 * da parcela ("jim.com juliane 01/02" e "Jim.com Juliane 02/02" = 1).
 */
export function nameSimilarity(a: string, b: string): number {
  const clean = (x: string) => compactKey(detectInstallment(x)?.base ?? x);
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // o banco costuma grudar a cidade no nome ("99food" → "99food99foodsaopaulobr")
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 5 && long.startsWith(short)) return 0.9;
  const pairs = (t: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < t.length - 1; i++) m.set(t.slice(i, i + 2), (m.get(t.slice(i, i + 2)) ?? 0) + 1);
    return m;
  };
  const px = pairs(x);
  const py = pairs(y);
  let common = 0;
  for (const [k, n] of px) common += Math.min(n, py.get(k) ?? 0);
  return (2 * common) / (x.length - 1 + y.length - 1);
}

/** a partir daqui, os nomes são "praticamente o mesmo". */
const SAME_NAME = 0.8;

/**
 * monta as linhas da prévia, com categoria sugerida e as perguntas sobre duplicidade.
 * `cardId` = destino do extrato (null = conta).
 */
export function buildImportRows(
  s: Snapshot,
  statement: ParsedStatement,
  dest: { cardId: string | null; accountId: string | null },
  todayDate: ISODate,
): ImportRow[] {
  const { cardId } = dest;
  // fatura (pdf ou planilha): a data é a da compra. compras feitas antes do período da fatura
  // (o banco fecha alguns dias antes, ou é parcela de compra antiga) precisam cair na fatura certa:
  // - parcelas: vão para o mesmo dia, dentro do mês da fatura (parcela de 06/10 → 06/12);
  // - o resto mantém a data real e fica preso à fatura.
  const card = cardId ? s.cards.find((c) => c.id === cardId) : undefined;
  let period: { start: ISODate; end: ISODate } | null = null;
  if (card && statement.invoiceDueDate) {
    const due = invoiceDueFor(card, statement.invoiceDueDate);
    const { start, closingDate } = invoicePeriod(card, due);
    period = { start, end: statement.invoiceDueDate };
    statement = {
      ...statement,
      lines: statement.lines.map((l) => {
        if (l.date >= start && l.date <= closingDate) return l;
        if (l.amount < 0 && detectInstallment(l.description)) return { ...l, date: installmentDateIn(card, due, l.date) };
        return { ...l, invoiceDate: due };
      }),
    };
  }
  const used = new Set<string>(); // lançamentos/previsões já "casados" com uma linha
  const importedIds = new Set(s.transactions.map((t) => t.externalId).filter(Boolean));
  // compara com o mesmo cartão e também com o que foi lançado nas contas: a pessoa pode ter
  // registrado a compra sem escolher o cartão (ou a conta) certo. outros cartões ficam de fora.
  // transferências entre contas: só o lado desta conta (para reconhecer uma já registrada no teo).
  const sameDestination = s.transactions.filter(
    (t) =>
      (!t.cardId || t.cardId === cardId) &&
      !t.paysCardId &&
      !t.investmentId &&
      (!t.transferId || (!cardId && (t.accountId ?? null) === (dest.accountId ?? null))),
  );
  // transferências que a pessoa já marcou como "entre minhas contas" em importações anteriores
  const ownTransfers = s.transactions.filter((t) => t.transferId && t.externalId);
  const ownTransfer = (line: StatementLine, kind: Kind): { reason: 'nome' | 'antes'; transferTo: string | null } | null => {
    if (!TRANSFER_RE.test(normalize(line.description))) return null;
    const before = ownTransfers.find(
      (t) => t.kind === kind && nameSimilarity(withoutDigits(t.description), withoutDigits(line.description)) >= SAME_NAME,
    );
    if (!before && !mentionsOwnName(line.description, s.settings.name)) return null;
    const other = before ? s.transactions.find((t) => t.transferId === before.transferId && t.id !== before.id) : undefined;
    return { reason: before ? 'antes' : 'nome', transferTo: other ? (other.accountId ?? null) : OUTSIDE_TEO };
  };

  const lastDate = statement.lines.reduce((m, l) => (l.date > m ? l.date : m), todayDate);
  const horizonEnd = lastDay(monthOf(addDays(lastDate, 31)));
  // no cartão, vale o previsto no próprio cartão e também o que foi registrado na conta
  // (ex.: um parcelamento lançado como conta fixa, que na verdade vem na fatura).
  const accountPredictions = upcomingEntries(s, todayDate, horizonEnd).filter((e) => !e.invoiceDate && !e.investmentId);
  const predictions: Entry[] = cardId ? [...cardPredictions(s, cardId, horizonEnd), ...accountPredictions] : accountPredictions;

  // 1ª passada: pares exatos (mesmo valor e mesma data). eles têm prioridade, para que um
  // registro não seja "gasto" com uma linha parecida de outro dia.
  const exact = new Map<number, Transaction>();
  statement.lines.forEach((line, i) => {
    if (line.externalId && importedIds.has(line.externalId)) return;
    const kind: Kind = line.amount < 0 ? 'despesa' : 'receita';
    const amount = Math.abs(line.amount);
    const t = sameDestination.find((x) => !used.has(x.id) && x.kind === kind && x.amount === amount && x.date === line.date);
    if (t) {
      used.add(t.id);
      exact.set(i, t);
    }
  });

  return statement.lines.map((line, i) => {
    const kind: Kind = line.amount < 0 ? 'despesa' : 'receita';
    const amount = Math.abs(line.amount);
    const row: ImportRow = {
      key: `${i}:${line.externalId ?? ''}`,
      line,
      kind,
      amount,
      date: line.date,
      description: line.description,
      note: '',
      categoryId: guessCategory(line.description, kind, s.categories),
      suggestion: null,
      decision: 'importar',
      installment: kind === 'despesa' ? detectInstallment(line.description) : null,
      installmentChoice: 'so-esta',
      invoiceDate: cardId ? (line.invoiceDate ?? null) : null,
    };
    const d = normalize(line.description);

    if (line.externalId && importedIds.has(line.externalId)) {
      const before = s.transactions.find((t) => t.externalId === line.externalId);
      // importada antes como gasto, mas parece pix para a própria pessoa: oferece transformar em transferência.
      const own = !cardId && before && !before.transferId ? ownTransfer(line, kind) : null;
      if (own && before) {
        return {
          ...row,
          categoryId: null,
          suggestion: { type: 'minha-conta', reason: own.reason, existing: before },
          decision: null,
          transferTo: own.transferTo,
        };
      }
      // importada antes com outra data (versão antiga do teo): aproveitamos para corrigir.
      const wrong = !!before && !!cardId && before.cardId === cardId &&
        (before.date !== row.date || (before.invoiceDate ?? null) !== row.invoiceDate);
      return { ...row, suggestion: { type: 'ja-importada', fix: wrong ? before : undefined }, decision: 'pular' };
    }

    const key = compactKey(line.description);
    if (cardId && kind === 'receita' && (CARD_PAYMENT_RE.test(d) || CARD_PAYMENT_COMPACT.test(key))) {
      return { ...row, categoryId: null, suggestion: { type: 'pagamento-no-cartao' }, decision: 'pular' };
    }

    if (!cardId && kind === 'despesa' && (INVOICE_PAYMENT_RE.test(d) || INVOICE_PAYMENT_COMPACT.test(key))) {
      const invoice = s.cards
        .flatMap((card) => cardInvoices(s, card, horizonEnd, todayDate).map((inv) => ({ card, inv })))
        .filter(({ inv }) => !inv.payment && inv.total > 0 && near(inv.dueDate, line.date, 12))
        .filter(({ card, inv }) => !used.has(`f:${card.id}:${inv.dueDate}`))
        .sort((a, b) => Math.abs(a.inv.total - amount) - Math.abs(b.inv.total - amount))[0];
      if (invoice) {
        used.add(`f:${invoice.card.id}:${invoice.inv.dueDate}`);
        return {
          ...row,
          categoryId: null,
          suggestion: { type: 'fatura', card: invoice.card, invoiceDate: invoice.inv.dueDate, invoiceTotal: invoice.inv.total },
          decision: null,
        };
      }
    }

    // mesmo nome (ou quase) e diferença de centavos: o teo responde sozinho, sem perguntar.
    const sure = (description: string, value: Cents) =>
      centsApart(value, amount) && nameSimilarity(description, line.description) >= SAME_NAME;

    const exactTwin = exact.get(i);
    if (exactTwin) {
      const auto = sure(exactTwin.description, exactTwin.amount);
      return {
        ...row,
        suggestion: { type: 'parecida', transaction: exactTwin, sameDay: true },
        decision: auto ? 'pular' : null,
        autoMatched: auto,
      };
    }
    // 2ª chance: mesmo valor registrado em outro dia (1 dia de diferença, ou 2 se o nome for parecido),
    // ou o mesmo nome com diferença de centavos.
    const twin = sameDestination.find(
      (t) =>
        !used.has(t.id) &&
        t.kind === kind &&
        ((t.amount === amount &&
          (near(t.date, line.date, 1) || (near(t.date, line.date, 2) && similarText(t.description, line.description)))) ||
          // centavos de diferença e nome ao menos meio parecido: pergunta (ou decide, se for o mesmo nome)
          (near(t.date, line.date, 2) &&
            centsApart(t.amount, amount) &&
            (similarText(t.description, line.description) || nameSimilarity(t.description, line.description) >= 0.5))),
    );
    if (twin) {
      used.add(twin.id);
      const auto = sure(twin.description, twin.amount);
      return {
        ...row,
        suggestion: { type: 'parecida', transaction: twin, sameDay: twin.date === line.date },
        decision: auto ? 'pular' : null,
        autoMatched: auto,
      };
    }

    // pix/transferência para a própria pessoa (outra conta dela): pergunta, ou já marca se ela marcou um igual antes.
    const own = cardId ? null : ownTransfer(line, kind);
    if (own) {
      return {
        ...row,
        categoryId: null,
        suggestion: { type: 'minha-conta', reason: own.reason },
        decision: own.reason === 'antes' ? 'transferencia' : null,
        autoMatched: own.reason === 'antes',
        transferTo: own.transferTo,
      };
    }

    const predicted = predictions
      .filter((e) => !used.has(e.key) && e.kind === kind)
      .filter(
        (e) =>
          (near(e.originalDate, line.date, 7) && similarAmount(e.amount, amount)) ||
          // fatura: parcela prevista para qualquer dia do período dessa fatura, com o mesmo valor
          // (ou centavos de diferença e o mesmo nome).
          (!!period &&
            (e.amount === amount || sure(e.description, e.amount)) &&
            e.originalDate >= period.start &&
            e.originalDate <= period.end),
      )
      .sort(
        (a, b) =>
          Number(sure(b.description, b.amount)) - Number(sure(a.description, a.amount)) ||
          Math.abs(a.amount - amount) - Math.abs(b.amount - amount),
      )[0];
    if (predicted) {
      used.add(predicted.key);
      const auto = sure(predicted.description, predicted.amount);
      return {
        ...row,
        categoryId: predicted.categoryId ?? row.categoryId,
        suggestion: { type: 'previsao', entry: predicted },
        decision: auto ? 'vincular' : null,
        autoMatched: auto,
      };
    }

    return row;
  });
}

/** recorrências e compras pendentes previstas num cartão (para casar com o extrato do cartão). */
function cardPredictions(s: Snapshot, cardId: string, to: ISODate): Entry[] {
  const card = s.cards.find((c) => c.id === cardId);
  if (!card) return [];
  const covered = new Set(
    s.transactions.filter((t) => t.recurrenceId && t.occurrenceDate).map((t) => `${t.recurrenceId}|${t.occurrenceDate}`),
  );
  const out: Entry[] = [];
  for (const rec of s.recurrences.filter((r) => r.cardId === cardId)) {
    for (const occ of recurrenceOccurrences(rec, s.settings.initialBalanceDate, to)) {
      if (covered.has(`${rec.id}|${occ.date}`)) continue;
      out.push({
        key: `r:${rec.id}:${occ.date}`,
        kind: rec.kind,
        amount: rec.amount,
        description: rec.description,
        categoryId: rec.categoryId,
        date: occ.date,
        originalDate: occ.date,
        source: 'prevista',
        overdue: false,
        recurrenceId: rec.id,
        cardId,
      });
    }
  }
  for (const t of s.transactions.filter((x) => x.cardId === cardId && x.status === 'pendente')) {
    out.push({
      key: `t:${t.id}`,
      kind: t.kind,
      amount: t.amount,
      description: t.description,
      categoryId: t.categoryId,
      date: t.date,
      originalDate: t.date,
      source: 'pendente',
      overdue: false,
      transactionId: t.id,
      cardId,
    });
  }
  return out;
}

/** frase amigável para a pergunta de cada linha. */
export function suggestionText(sug: Suggestion, shortDate: (d: ISODate) => string): string {
  switch (sug.type) {
    case 'minha-conta':
      if (sug.existing) return 'já foi importada como gasto, mas parece um pix para você mesmo. foi entre suas contas?';
      return sug.reason === 'antes'
        ? 'você já marcou uma parecida como transferência entre suas contas.'
        : 'parece um pix para você mesmo, numa outra conta sua. foi entre suas contas?';
    case 'ja-importada':
      return sug.fix
        ? 'essa já foi importada antes, mas com a data errada. vamos só corrigir a data.'
        : 'essa já foi importada antes, então vamos pular.';
    case 'pagamento-no-cartao':
      return 'é o pagamento da fatura. ele já aparece no extrato da conta, então vamos pular.';
    case 'parecida':
      return sug.sameDay
        ? `você já registrou "${sug.transaction.description}" de ${formatMoney(sug.transaction.amount)} nesse mesmo dia. é a mesma?`
        : `parece com "${sug.transaction.description}" de ${formatMoney(sug.transaction.amount)}, que você registrou no dia ${shortDate(sug.transaction.date)}. foi a mesma, só que em outro dia?`;
    case 'previsao':
      return `parece ser "${sug.entry.description}", previsto para o dia ${shortDate(sug.entry.originalDate)}${
        sug.entry.amount !== 0 ? ` (${formatMoney(sug.entry.amount)})` : ''
      }. é isso?`;
    case 'fatura':
      return `parece ser o pagamento da fatura do ${sug.card.name} que vence dia ${shortDate(sug.invoiceDate)} (${formatMoney(sug.invoiceTotal)}). é isso?`;
  }
}
