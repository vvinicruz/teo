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

export function buildLines(pieces: TextPiece[]): string[] {
  const rows = new Map<number, TextPiece[]>();
  for (const p of pieces) {
    if (!p.str) continue;
    const y = Math.round(p.y);
    const list = rows.get(y) ?? [];
    list.push(p);
    rows.set(y, list);
  }
  const out: string[] = [];
  for (const y of [...rows.keys()].sort((a, b) => b - a)) {
    let line = '';
    let end = -Infinity;
    for (const part of rows.get(y)!.sort((a, b) => a.x - b.x)) {
      const gap = part.x - end;
      if (line && gap > part.size * SPACE_GAP && !line.endsWith(' ') && !part.str.startsWith(' ')) line += ' ';
      line += part.str;
      end = part.x + part.w;
    }
    const clean = line.replace(/\s+/g, ' ').trim();
    if (clean) out.push(clean);
  }
  return out;
}
