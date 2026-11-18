/**
 * gerador de pdf simples, sem bibliotecas: texto (helvetica), retângulos e linhas.
 * usado para os relatórios do teo. coordenadas a partir do canto de cima, à esquerda, em pontos (a4 = 595 × 842).
 */

export const A4 = { width: 595, height: 842 };

// larguras da helvetica e da helvetica-bold (1/1000 do tamanho da fonte), caracteres 32 a 126.
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];
/** caracteres fora do latin-1 que existem na codificação winansi do pdf. */
const WIN_ANSI: Record<string, [number, number]> = { '…': [0x85, 1000], '–': [0x96, 556], '—': [0x97, 1000], '•': [0x95, 350] };

function charWidth(c: string, bold: boolean): number {
  if (WIN_ANSI[c]) return WIN_ANSI[c][1];
  const table = bold ? BOLD : REGULAR;
  const code = c.charCodeAt(0);
  if (code >= 32 && code <= 126) return table[code - 32];
  const base = c.normalize('NFD')[0]; // á → a
  const b = base.charCodeAt(0);
  if (b >= 32 && b <= 126) return table[b - 32];
  return c === '·' ? 278 : 556;
}

export interface TextStyle {
  size?: number;
  bold?: boolean;
  color?: string;
  align?: 'left' | 'right' | 'center';
}

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

function rgb(hex: string): string {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => n2(parseInt(v.slice(i, i + 2), 16) / 255)).join(' ');
}

function encode(text: string): string {
  let out = '';
  for (const c of text) {
    let code = WIN_ANSI[c]?.[0] ?? c.charCodeAt(0);
    if (code > 255) code = 63; // "?"
    const ch = String.fromCharCode(code);
    out += ch === '(' || ch === ')' || ch === '\\' ? `\\${ch}` : code < 32 || code > 126 ? `\\${code.toString(8).padStart(3, '0')}` : ch;
  }
  return out;
}

export class PdfDoc {
  private pages: string[][] = [];
  private current = 0;

  constructor() {
    this.addPage();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  addPage(): void {
    this.pages.push([]);
    this.current = this.pages.length - 1;
  }

  /** volta a desenhar numa página já criada (ex.: rodapé com "página 1 de 3"). */
  goToPage(index: number): void {
    this.current = index;
  }

  private get ops(): string[] {
    return this.pages[this.current];
  }

  textWidth(text: string, size = 10, bold = false): number {
    let w = 0;
    for (const c of text) w += charWidth(c, bold);
    return (w / 1000) * size;
  }

  /** corta o texto com "…" para caber na largura. */
  fit(text: string, maxWidth: number, size = 10, bold = false): string {
    if (this.textWidth(text, size, bold) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && this.textWidth(`${t}…`, size, bold) > maxWidth) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  text(x: number, y: number, text: string, style: TextStyle = {}): void {
    const { size = 10, bold = false, color = '#1A1A1A', align = 'left' } = style;
    const w = this.textWidth(text, size, bold);
    const left = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    this.ops.push(
      `BT ${rgb(color)} rg /${bold ? 'F2' : 'F1'} ${n2(size)} Tf ${n2(left)} ${n2(A4.height - y)} Td (${encode(text)}) Tj ET`,
    );
  }

  /** retângulo preenchido, com cantos arredondados opcionais. */
  rect(x: number, y: number, w: number, h: number, color: string, radius = 0): void {
    if (w <= 0 || h <= 0) return;
    const r = Math.min(radius, w / 2, h / 2);
    const top = A4.height - y;
    const bottom = top - h;
    if (!r) {
      this.ops.push(`${rgb(color)} rg ${n2(x)} ${n2(bottom)} ${n2(w)} ${n2(h)} re f`);
      return;
    }
    const k = r * 0.5523;
    const right = x + w;
    this.ops.push(
      [
        `${rgb(color)} rg`,
        `${n2(x + r)} ${n2(top)} m`,
        `${n2(right - r)} ${n2(top)} l`,
        `${n2(right - r + k)} ${n2(top)} ${n2(right)} ${n2(top - r + k)} ${n2(right)} ${n2(top - r)} c`,
        `${n2(right)} ${n2(bottom + r)} l`,
        `${n2(right)} ${n2(bottom + r - k)} ${n2(right - r + k)} ${n2(bottom)} ${n2(right - r)} ${n2(bottom)} c`,
        `${n2(x + r)} ${n2(bottom)} l`,
        `${n2(x + r - k)} ${n2(bottom)} ${n2(x)} ${n2(bottom + r - k)} ${n2(x)} ${n2(bottom + r)} c`,
        `${n2(x)} ${n2(top - r)} l`,
        `${n2(x)} ${n2(top - r + k)} ${n2(x + r - k)} ${n2(top)} ${n2(x + r)} ${n2(top)} c`,
        'f',
      ].join(' '),
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, color: string, width = 0.75): void {
    this.ops.push(`${rgb(color)} RG ${n2(width)} w ${n2(x1)} ${n2(A4.height - y1)} m ${n2(x2)} ${n2(A4.height - y2)} l S`);
  }

  /** o arquivo pdf pronto. */
  toBytes(title = 'teo'): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => objects.push(body) && objects.length;
    const catalog = add(''); // preenchido depois
    const pagesId = add('');
    const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const bold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const info = add(`<< /Title (${encode(title)}) /Producer (teo) >>`);
    const kids: number[] = [];
    for (const ops of this.pages) {
      const content = ops.join('\n');
      const contentId = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      kids.push(
        add(
          `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Contents ${contentId} 0 R ` +
            `/Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> >>`,
        ),
      );
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

    // o conteúdo só tem caracteres de 1 byte (acentos viram \ooo), então tamanho = length
    let pdf = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i);
    return bytes;
  }
}
