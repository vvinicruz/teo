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
import { cardInvoices, invoicePeriod, upcomingEntries, recurrenceOccurrences, type Entry } from './finance';
import { formatMoney, parseMoney, type Cents } from './money';
import type { Card, Category, Kind, PaymentMethod, Snapshot, Transaction } from './types';

export interface StatementLine {
  date: ISODate;
  /** negativo = saída/compra; positivo = entrada/estorno. */
  amount: Cents;
  description: string;
  externalId: string | null;
  /** forma de pagamento percebida pela descrição (pix, débito...). */
  method?: PaymentMethod | null;
}

export interface ParsedStatement {
  format: 'ofx' | 'csv' | 'pdf';
  lines: StatementLine[];
  /** o arquivo parece ser de cartão de crédito. */
  looksLikeCard: boolean;
  /** fatura em pdf: vencimento encontrado no documento. */
  invoiceDueDate?: ISODate | null;
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
export function cleanDescription(raw: string): { description: string; method: PaymentMethod | null } {
  const base = raw
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
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

// ---------- fatura em pdf (itaú e parecidos) ----------

const PDF_TX = /(\d{2})\/(\d{2})\s+(.+?)\s+(-\s?)?(?:R\$\s?)?(\d{1,3}(?:\.\d{3})*,\d{2})(?=\s|$)/g;
const PDF_SKIP = /total|saldo (anterior|em aberto)|lan[cç]amentos|limite|fatura anterior|pagamento m[ií]nimo|valor m[ií]nimo|vencimento|cr[eé]dito rotativo|parcelamento de fatura - simula/i;

/**
 * lê as linhas de texto de uma fatura de cartão em pdf. cada compra aparece como
 * "dd/mm descrição valor" (às vezes duas colunas na mesma linha). o ano vem do vencimento.
 */
export function parseCardPdf(textLines: string[]): ParsedStatement {
  const all = textLines.join('\n');
  const due = all.match(/vencimento\D{0,30}(\d{2})\/(\d{2})\/(\d{4})/i);
  const invoiceDueDate = due ? `${due[3]}-${due[2]}-${due[1]}` : null;
  const dueYear = due ? Number(due[3]) : new Date().getFullYear();
  const dueMonth = due ? Number(due[2]) : 12;

  const lines: StatementLine[] = [];
  const seen = new Map<string, number>();
  for (const textLine of textLines) {
    for (const segment of textLine.split(' | ')) {
      for (const m of segment.matchAll(PDF_TX)) {
        const [, dd, mm, rawDesc, minus, value] = m;
        if (PDF_SKIP.test(rawDesc)) continue;
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
  return { format: 'pdf', lines, looksLikeCard: true, invoiceDueDate };
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
  | { type: 'parecida'; transaction: Transaction; sameDay: boolean }
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
  /** observação opcional escrita pela pessoa na prévia. */
  note: string;
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

/** nomes parecidos: têm alguma palavra (de 4+ letras) em comum. */
function similarText(a: string, b: string): boolean {
  const words = (x: string) => new Set(normalize(x).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
  const wa = words(a);
  for (const w of words(b)) if (wa.has(w)) return true;
  return false;
}

/** valores "parecidos": iguais, ou até 15% de diferença (conta de luz que variou). */
const similarAmount = (a: Cents, b: Cents) => a === b || Math.abs(a - b) <= Math.max(a, b) * 0.15;

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
  // fatura em pdf: compras parceladas vêm com a data da compra original. para caírem na fatura
  // certa, usamos o começo do período dessa fatura.
  const card = cardId ? s.cards.find((c) => c.id === cardId) : undefined;
  let period: { start: ISODate; end: ISODate } | null = null;
  if (card && statement.invoiceDueDate) {
    const { start } = invoicePeriod(card, statement.invoiceDueDate);
    period = { start, end: statement.invoiceDueDate };
    statement = { ...statement, lines: statement.lines.map((l) => (l.date < start ? { ...l, date: start } : l)) };
  }
  const used = new Set<string>(); // lançamentos/previsões já "casados" com uma linha
  const importedIds = new Set(s.transactions.map((t) => t.externalId).filter(Boolean));
  // no cartão, compara só com o mesmo cartão. nas contas, compara com qualquer conta: a pessoa
  // pode ter registrado sem escolher a conta certa.
  const sameDestination = s.transactions.filter(
    (t) => (t.cardId ?? null) === cardId && !t.paysCardId && !t.transferId && !t.investmentId,
  );

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

    const exactTwin = exact.get(i);
    if (exactTwin) {
      return { ...row, suggestion: { type: 'parecida', transaction: exactTwin, sameDay: true }, decision: null };
    }
    // 2ª chance: mesmo valor registrado em outro dia (1 dia de diferença, ou 2 se o nome for parecido).
    const twin = sameDestination.find(
      (t) =>
        !used.has(t.id) &&
        t.kind === kind &&
        t.amount === amount &&
        (near(t.date, line.date, 1) || (near(t.date, line.date, 2) && similarText(t.description, line.description))),
    );
    if (twin) {
      used.add(twin.id);
      return { ...row, suggestion: { type: 'parecida', transaction: twin, sameDay: false }, decision: null };
    }

    const predicted = predictions
      .filter((e) => !used.has(e.key) && e.kind === kind)
      .filter(
        (e) =>
          (near(e.originalDate, line.date, 7) && similarAmount(e.amount, amount)) ||
          // fatura: parcela prevista para qualquer dia do período dessa fatura, com o mesmo valor.
          (!!period && e.amount === amount && e.originalDate >= period.start && e.originalDate <= period.end),
      )
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
