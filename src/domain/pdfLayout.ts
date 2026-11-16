/**
 * monta linhas de texto a partir dos pedaços que o pdf.js devolve.
 * alguns pdfs (como a fatura do itaú) quebram as palavras em vários pedaços colados.
 * só colocamos espaço quando há um vão de verdade entre um pedaço e o próximo.
 */
export interface TextPiece {
  str: string;
  /** posição horizontal. */
  x: number;
  /** posição vertical (linha). */
  y: number;
  /** largura do pedaço. */
  w: number;
  /** tamanho da fonte. */
  size: number;
}

/** vão mínimo (proporcional à fonte) para considerar que há um espaço entre palavras. */
const SPACE_GAP = 0.18;
/**
 * quando o pdf escreve os espaços de verdade dentro do texto ("seg ca" "rta"), vãos menores
 * que isso entre dois pedaços são só o jeito do gerador desenhar: a palavra continua.
 */
const GLUE_GAP = 1.0;
/** pedaço com espaço de verdade entre duas letras/números ("seg ca", "s 06/1"). */
const INNER_SPACE = /\S \S/;
/** data, valor ou "r$": sempre separados do texto ao lado. */
const TOKEN_END = /(^|\s)(\d{2}\/\d{2}(\/\d{2,4})?|[-+]?\s?(R\$\s?)?\d{1,3}(\.\d{3})*,\d{2}|R\$)$/i;
const TOKEN_START = /^([-+]?\s?(R\$\s?)?\d{1,3}(\.\d{3})*,\d{2}|\d{2}\/\d{2}(\/\d{2,4})?(\s|$)|R\$)/i;

/** o gerador deste pdf escreve os espaços dentro do texto? */
function writesSpaces(pieces: TextPiece[]): boolean {
  const words = pieces.filter((p) => /\p{L}.*\p{L}/u.test(p.str));
  return words.length > 0 && words.filter((p) => INNER_SPACE.test(p.str.trim())).length / words.length >= 0.3;
}

export function buildLines(pieces: TextPiece[]): string[] {
  const rows = new Map<number, TextPiece[]>();
  for (const p of pieces) {
    // pedaços feitos só de espaço são "espaços falsos" inseridos pelo leitor de pdf:
    // ignoramos e decidimos os espaços pela distância real entre os pedaços.
    if (!p.str.trim()) continue;
    const y = Math.round(p.y);
    const list = rows.get(y) ?? [];
    list.push(p);
    rows.set(y, list);
  }
  const pageWritesSpaces = writesSpaces(pieces.filter((p) => p.str.trim()));
  const out: string[] = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    const row = rows.get(y)!.sort((a, b) => a.x - b.x);
    const explicit = row.some((p) => INNER_SPACE.test(p.str.trim())) || pageWritesSpaces;
    let line = '';
    let end = -Infinity;
    for (const part of row) {
      const gap = part.x - end;
      if (line && !line.endsWith(' ') && !part.str.startsWith(' ')) {
        const token = TOKEN_END.test(line) || TOKEN_START.test(part.str.trim());
        const limit = explicit && !token ? GLUE_GAP : SPACE_GAP;
        if (gap > part.size * limit) line += ' ';
      }
      line += part.str;
      end = part.x + part.w;
    }
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean) out.push(clean);
  }
  return out;
}

const DATE_FULL = /^\d{2}\/\d{2}\/(\d{2}|\d{4})$/;
const AMOUNT_ONLY = /^[-+]?\s?(R\$\s?)?\d{1,3}(\.\d{3})*,\d{2}\s?[-DC]?$/i;

export interface TableRow {
  /** data como aparece (dd/mm/aaaa). */
  date: string;
  /** descrição (todas as colunas de texto juntas, inclusive linhas quebradas). */
  description: string;
  /** valor como aparece (ex.: "-1.883,90", "39,90 D"). */
  amount: string;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * lê extratos em formato de tabela (data | descrição | valor | saldo), como o do itaú.
 * cada lançamento começa na linha da data e vai até a próxima data; a descrição pode ocupar
 * várias linhas. o valor é separado do saldo pela posição das colunas no cabeçalho.
 * devolve null quando o pdf não tem um cabeçalho com "valor" e "saldo".
 */
export function readTable(pages: TextPiece[][]): TableRow[] | null {
  let columns: { valorRight: number; saldoRight: number } | null = null;
  const rows: TableRow[] = [];
  for (const pieces of pages) {
    const lines = buildLineGroups(pieces);
    // cabeçalho: uma linha com "valor" e "saldo".
    let headerY = Infinity;
    for (const group of lines) {
      const text = norm(group.map((p) => p.str).join(''));
      if (text.includes('valor') && text.includes('saldo')) {
        const valor = mergedWord(group, 'valor');
        const saldo = mergedWord(group, 'saldo');
        if (valor && saldo) {
          columns = { valorRight: valor.x + valor.w, saldoRight: saldo.x + saldo.w };
          headerY = group[0].y;
          break;
        }
      }
    }
    if (!columns) continue;
    const body = pieces.filter((p) => p.str.trim() && p.y < headerY - 3);
    const dates = body.filter((p) => DATE_FULL.test(p.str.trim())).sort((a, b) => b.y - a.y);
    const boundary = (columns.valorRight + columns.saldoRight) / 2;
    dates.forEach((d, i) => {
      const nextY = i + 1 < dates.length ? dates[i + 1].y : -Infinity;
      const record = body.filter((p) => p !== d && p.y <= d.y + 4 && p.y > nextY + 4);
      const amounts = record.filter((p) => AMOUNT_ONLY.test(p.str.trim()));
      const value = amounts.find((p) => p.x + p.w <= boundary);
      const text = record.filter((p) => !AMOUNT_ONLY.test(p.str.trim()) && p.x > d.x + d.w);
      const description = buildLines(text).join(' ').trim();
      if (!value || !description) return; // linha só com saldo do dia
      rows.push({ date: d.str.trim(), description, amount: value.str.trim() });
    });
  }
  return columns ? rows : null;
}

/** agrupa pedaços por linha (mesma altura). */
function buildLineGroups(pieces: TextPiece[]): TextPiece[][] {
  const rows = new Map<number, TextPiece[]>();
  for (const p of pieces) {
    if (!p.str.trim()) continue;
    const y = Math.round(p.y);
    rows.set(y, [...(rows.get(y) ?? []), p]);
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, g]) => g.sort((a, b) => a.x - b.x));
}

/** encontra uma palavra do cabeçalho, mesmo quebrada em pedaços ("descriç"+"ã"+"o"). */
function mergedWord(group: TextPiece[], word: string): TextPiece | null {
  for (let i = 0; i < group.length; i++) {
    let str = '';
    let end = group[i].x;
    for (let j = i; j < group.length; j++) {
      str += group[j].str;
      end = group[j].x + group[j].w;
      if (norm(str).startsWith(word)) return { ...group[i], str, w: end - group[i].x };
      if (!word.startsWith(norm(str).trim())) break;
    }
  }
  return null;
}

/**
 * separa as colunas de uma fatura de cartão (ex.: itaú, com compras à esquerda e
 * produtos/parcelas à direita) para que cada coluna seja lida de cima para baixo.
 */
export function splitColumns(pieces: TextPiece[]): TextPiece[][] {
  // a data pode vir sozinha ("06/10") ou grudada no nome ("06/10 uber"), conforme o gerador do pdf
  const dateStarts = pieces.filter((p) => /^\d{2}\/\d{2}(?!\/|\d)/.test(p.str.trim()));
  if (dateStarts.length < 4) return [pieces];
  const xs = [...new Set(dateStarts.map((p) => Math.round(p.x / 10) * 10))].sort((a, b) => a - b);
  if (xs.length < 2) return [pieces];
  // maior salto entre as posições das datas = divisão entre colunas
  let cut = 0;
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] > best) {
      best = xs[i] - xs[i - 1];
      cut = xs[i] - 5;
    }
  }
  if (best < 100) return [pieces];
  return [pieces.filter((p) => p.x < cut), pieces.filter((p) => p.x >= cut)];
}

/**
 * detalhes técnicos da leitura, sem dados pessoais: letras viram "x"/"X" e números viram "9".
 * fica só a posição e o tamanho de cada pedaço, para entender como o banco monta o pdf.
 */
export function maskedLayout(pages: TextPiece[][], maxPieces = 400): string {
  const mask = (s: string) => s.replace(/\p{L}/gu, (c) => (c === c.toLowerCase() ? 'x' : 'X')).replace(/\d/g, '9');
  const r = (n: number) => Math.round(n * 10) / 10;
  return pages
    .slice(0, 2)
    .map((pieces, i) =>
      [`p${i + 1}`, ...pieces.slice(0, maxPieces).map((p) => `${r(p.x)} ${r(p.y)} ${r(p.w)} ${r(p.size)} [${mask(p.str)}]`)].join('\n'),
    )
    .join('\n');
}
