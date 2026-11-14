/**
 * importação de extratos (ofx e csv).
 *
 * tudo acontece no aparelho: o arquivo do banco não é enviado para lugar nenhum.
 * só as movimentações que a pessoa confirmar são salvas, como se tivessem sido digitadas.
 *
 * convenção dos valores lidos: negativo = dinheiro saindo (ou compra no cartão),
 * positivo = dinheiro entrando (ou estorno/pagamento no cartão).
 */
import { addDays, daysInclusive, lastDay, monthOf, type ISODate } from './dates';
import { cardInvoices, upcomingEntries, recurrenceOccurrences, type Entry } from './finance';
import { formatMoney, parseMoney, type Cents } from './money';
import type { Card, Category, Kind, Snapshot, Transaction } from './types';

export interface StatementLine {
  date: ISODate;
  /** negativo = saída/compra; positivo = entrada/estorno. */
  amount: Cents;
  description: string;
  externalId: string | null;
}

export interface ParsedStatement {
  format: 'ofx' | 'csv';
  lines: StatementLine[];
  /** o arquivo parece ser de cartão de crédito. */
  looksLikeCard: boolean;
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

/** prefixos que os bancos colocam e que não ajudam a entender o gasto. */
const NOISE = /^(compra (no |com )?(cartao de )?(debito|débito|credito|crédito)|compra cartao|compra (no )?pix|pagamento (via |com )?pix|pix (enviado|recebido)|transferencia (enviada|recebida)|transferência (enviada|recebida))\s*[-–:]\s*/i;

const clean = (s: string) => {
  const base = s
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const stripped = base.replace(NOISE, '').trim();
  return stripped || base;
};

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
    const description = clean(field('MEMO') || field('NAME') || field('PAYEE') || 'movimentação');
    const fitId = field('FITID');
    lines.push({ date, amount, description, externalId: fitId ? `ofx:${fitId}` : null });
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
    lines.push({
      date,
      amount,
      description: clean((iDesc >= 0 ? cols[iDesc] : '') || 'movimentação'),
      externalId: id ? `csv:${id}` : null,
    });
  }
  // fatura de cartão em csv (ex.: nubank "date,title,amount") lista compras como valores positivos.
  const positives = lines.filter((l) => l.amount > 0).length;
  const looksLikeCard = header.includes('title') && positives > lines.length / 2;
  if (looksLikeCard) for (const l of lines) l.amount = -l.amount;
  return { format: 'csv', lines, looksLikeCard };
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
  | { type: 'ja-importada' }
  /** parece com um lançamento que já existe. */
  | { type: 'parecida'; transaction: Transaction }
  /** parece com algo previsto (conta fixa, parcela, conta pendente). */
  | { type: 'previsao'; entry: Entry }
  /** no extrato da conta: parece o pagamento de uma fatura. */
  | { type: 'fatura'; card: Card; invoiceDate: ISODate; invoiceTotal: Cents }
  /** no extrato do cartão: é o pagamento da fatura, que já aparece na conta. */
  | { type: 'pagamento-no-cartao' };

export type Decision = 'importar' | 'pular' | 'vincular';

export interface ImportRow {
  key: string;
  line: StatementLine;
  kind: Kind;
  amount: Cents;
  date: ISODate;
  description: string;
  categoryId: string | null;
  suggestion: Suggestion | null;
  /** null = a pessoa ainda precisa responder a pergunta. */
  decision: Decision | null;
}

const INVOICE_PAYMENT_RE = /fatura|pagamento (de )?cart|pgto cart|pag cart|cartao de credito|pagto cartao/;
const CARD_PAYMENT_RE = /pagamento (recebido|efetuado)|pgto recebido|pagamento de fatura|pagamento fatura|credito de pagamento/;

const near = (a: ISODate, b: ISODate, days: number) => {
  const [x, y] = a <= b ? [a, b] : [b, a];
  return daysInclusive(x, y) - 1 <= days;
};

/** valores "parecidos": iguais, ou até 15% de diferença (conta de luz que variou). */
const similarAmount = (a: Cents, b: Cents) => a === b || Math.abs(a - b) <= Math.max(a, b) * 0.15;

/**
 * monta as linhas da prévia, com categoria sugerida e as perguntas sobre duplicidade.
 * `cardId` = destino do extrato (null = conta).
 */
export function buildImportRows(
  s: Snapshot,
  statement: ParsedStatement,
  cardId: string | null,
  todayDate: ISODate,
): ImportRow[] {
  const used = new Set<string>(); // lançamentos/previsões já "casados" com uma linha
  const importedIds = new Set(s.transactions.map((t) => t.externalId).filter(Boolean));
  const sameDestination = s.transactions.filter((t) => (t.cardId ?? null) === cardId && !t.paysCardId);

  const lastDate = statement.lines.reduce((m, l) => (l.date > m ? l.date : m), todayDate);
  const horizonEnd = lastDay(monthOf(addDays(lastDate, 31)));
  const predictions: Entry[] = cardId
    ? cardPredictions(s, cardId, horizonEnd)
    : upcomingEntries(s, todayDate, horizonEnd).filter((e) => !e.invoiceDate);

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
      categoryId: guessCategory(line.description, kind, s.categories),
      suggestion: null,
      decision: 'importar',
    };
    const d = normalize(line.description);

    if (line.externalId && importedIds.has(line.externalId)) {
      return { ...row, suggestion: { type: 'ja-importada' }, decision: 'pular' };
    }

    if (cardId && kind === 'receita' && CARD_PAYMENT_RE.test(d)) {
      return { ...row, categoryId: null, suggestion: { type: 'pagamento-no-cartao' }, decision: 'pular' };
    }

    if (!cardId && kind === 'despesa' && INVOICE_PAYMENT_RE.test(d)) {
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

    const twin = sameDestination.find(
      (t) => !used.has(t.id) && t.kind === kind && t.amount === amount && near(t.date, line.date, 3),
    );
    if (twin) {
      used.add(twin.id);
      return { ...row, suggestion: { type: 'parecida', transaction: twin }, decision: null };
    }

    const predicted = predictions
      .filter((e) => !used.has(e.key) && e.kind === kind && near(e.originalDate, line.date, 7))
      .filter((e) => similarAmount(e.amount, amount))
      .sort((a, b) => Math.abs(a.amount - amount) - Math.abs(b.amount - amount))[0];
    if (predicted) {
      used.add(predicted.key);
      return {
        ...row,
        categoryId: predicted.categoryId ?? row.categoryId,
        suggestion: { type: 'previsao', entry: predicted },
        decision: null,
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
    case 'ja-importada':
      return 'essa já foi importada antes, então vamos pular.';
    case 'pagamento-no-cartao':
      return 'é o pagamento da fatura. ele já aparece no extrato da conta, então vamos pular.';
    case 'parecida':
      return `parece com "${sug.transaction.description}" de ${formatMoney(sug.transaction.amount)} do dia ${shortDate(sug.transaction.date)}, que você já registrou. é a mesma?`;
    case 'previsao':
      return `parece ser "${sug.entry.description}", previsto para o dia ${shortDate(sug.entry.originalDate)}${
        sug.entry.amount !== 0 ? ` (${formatMoney(sug.entry.amount)})` : ''
      }. é isso?`;
    case 'fatura':
      return `parece ser o pagamento da fatura do ${sug.card.name} que vence dia ${shortDate(sug.invoiceDate)} (${formatMoney(sug.invoiceTotal)}). é isso?`;
  }
}
