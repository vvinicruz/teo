/**
 * lê planilhas .xlsx (excel) sem depender do navegador: o arquivo é um zip com xml dentro.
 * devolve a primeira planilha como uma grade de textos (linha × coluna). números ficam como
 * estão no arquivo ("56.9", "46332"): datas do excel são números de dias.
 */
import { unzipSync, strFromU8 } from 'fflate';

/** .xlsx, .docx e outros arquivos do office começam como um zip ("PK"). */
export function isZip(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function decodeXml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** junta todos os trechos <t> (textos com formatação vêm em vários pedaços). */
function textOf(xml: string): string {
  return decodeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''));
}

/** "B15" → 1 (coluna b). */
function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A';
  let n = 0;
  for (const c of letters) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

/** caminho da primeira planilha da pasta de trabalho. */
function firstSheetPath(files: Record<string, Uint8Array>): string | null {
  const workbook = files['xl/workbook.xml'] ? strFromU8(files['xl/workbook.xml']) : '';
  const rels = files['xl/_rels/workbook.xml.rels'] ? strFromU8(files['xl/_rels/workbook.xml.rels']) : '';
  const rid = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (rid) {
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${rid}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (target) {
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
      if (files[path]) return path;
    }
  }
  return Object.keys(files).find((f) => /^xl\/worksheets\/[^/]+\.xml$/.test(f)) ?? null;
}

/** primeira planilha do arquivo .xlsx, como linhas de células (texto). */
export function readXlsx(bytes: Uint8Array): string[][] {
  const files = unzipSync(bytes, { filter: (f) => f.name.endsWith('.xml') || f.name.endsWith('.rels') });
  const path = firstSheetPath(files);
  if (!path) return [];
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const sheet = strFromU8(files[path]);
  const grid: string[][] = [];
  for (const row of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const index = Number(row[1].match(/\br="(\d+)"/)?.[1] ?? grid.length + 1) - 1;
    const cells: string[] = [];
    for (const cell of (row[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1];
      const body = cell[2] ?? '';
      const ref = attrs.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="(\w+)"/)?.[1];
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let text = '';
      if (type === 's') text = value !== undefined ? (shared[Number(value)] ?? '') : '';
      else if (type === 'inlineStr') text = textOf(body);
      else text = value !== undefined ? decodeXml(value) : '';
      cells[ref ? columnIndex(ref) : cells.length] = text;
    }
    grid[index] = Array.from(cells, (c) => c ?? '');
  }
  return Array.from(grid, (r) => r ?? []);
}
