import { describe, expect, it } from 'vitest';
import { buildLines, type TextPiece } from '../pdfLayout';

/** monta pedaços colados (sem vão) ou com vão, como um pdf real. largura ≈ 6 por letra. */
function pieces(y: number, parts: (string | number)[]): TextPiece[] {
  const out: TextPiece[] = [];
  let x = 0;
  for (const p of parts) {
    if (typeof p === 'number') {
      x += p; // vão
      continue;
    }
    out.push({ str: p, x, y, w: p.length * 6, size: 10 });
    x += p.length * 6;
  }
  return out;
}

describe('pdf: linhas a partir de pedaços', () => {
  it('junta palavras quebradas em pedaços colados (caso real da fatura do itaú)', () => {
    const lines = buildLines([
      ...pieces(700, ['02/11', 8, 'SEG CA', 'RTA', 'O PROTE', 'GIDO', 20, '10,32']),
      ...pieces(690, ['06/11', 8, 'IOF RE', 'FINANC', 'IAM', 'ENTO DE', 20, '93,55']),
      ...pieces(680, ['16/09', 8, 'ZP *O', 'LX AND', 'ER', 'S 06/1', '0', 20, '51,98']),
    ]);
    expect(lines).toEqual(['02/11 SEG CARTAO PROTEGIDO 10,32', '06/11 IOF REFINANCIAMENTO DE 93,55', '16/09 ZP *OLX ANDERS 06/10 51,98']);
  });
  it('mantém o espaço entre palavras quando há um vão', () => {
    expect(buildLines(pieces(700, ['TIKTOK', 3, 'SHOP']))).toEqual(['TIKTOK SHOP']);
  });
  it('ordena de cima para baixo e da esquerda para a direita', () => {
    const p = [...pieces(600, ['b']), ...pieces(700, ['a'])];
    expect(buildLines(p)).toEqual(['a', 'b']);
  });
});
