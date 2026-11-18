/**
 * relatório de gastos do mês em pdf: resumo, gastos por categoria (com e sem limite)
 * e cada gasto, agrupado por categoria.
 */
import { monthName, shortDate, type ISODate } from '../domain/dates';
import { formatMoney } from '../domain/money';
import type { CategorySpending, SpendingReport } from '../domain/spending';
import type { Transaction } from '../domain/types';
import { colors } from '../theme';
import { STATUS_COLOR, STATUS_LABEL } from './limitStatus';
import { A4, PdfDoc } from './pdfWriter';

export interface SpendingPdfOptions {
  name?: string;
  generatedOn: ISODate;
  categoryName: (id: string | null) => string;
  /** de onde saiu: nome do cartão ou da conta. */
  origin: (t: Transaction) => string;
}

const M = 40;
const W = A4.width - M * 2;
const BOTTOM = A4.height - 64;

const pct = (v: number) => `${Math.round(v * 100)}%`;
const brDate = (d: ISODate) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function spendingPdf(report: SpendingReport, opts: SpendingPdfOptions): Uint8Array {
  const doc = new PdfDoc();
  const month = monthName(report.month, true);
  let y = 0;

  const continuation = () => {
    doc.text(M, 44, 'teo', { size: 14, bold: true, color: colors.primary });
    doc.text(A4.width - M, 44, `gastos de ${month}`, { size: 9, color: colors.textSoft, align: 'right' });
    y = 70;
  };
  const ensure = (h: number) => {
    if (y + h <= BOTTOM) return;
    doc.addPage();
    continuation();
  };
  const paragraph = (text: string, size: number, color: string, width = W) => {
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (doc.textWidth(next, size) > width && line) {
        ensure(size + 4);
        doc.text(M, y, line, { size, color });
        y += size + 4;
        line = word;
      } else line = next;
    }
    if (line) {
      ensure(size + 4);
      doc.text(M, y, line, { size, color });
      y += size + 4;
    }
  };

  // ---------- cabeçalho ----------
  doc.text(M, 56, 'teo', { size: 28, bold: true, color: colors.primary });
  doc.text(A4.width - M, 46, 'relatório de gastos', { size: 9, color: colors.textSoft, align: 'right' });
  doc.text(A4.width - M, 59, 'tudo em ordem', { size: 9, color: colors.textFaint, align: 'right' });
  doc.text(M, 98, `gastos de ${month}`, { size: 20, bold: true });
  doc.text(M, 116, `${opts.name ? `${opts.name} · ` : ''}gerado em ${brDate(opts.generatedOn)}`, { size: 9, color: colors.textSoft });

  // ---------- resumo ----------
  const boxes: { label: string; value: string; note: string; color?: string }[] = [
    { label: 'total gasto no mês', value: formatMoney(report.total), note: 'na conta e no cartão', color: colors.primary },
  ];
  if (report.planned > 0) {
    boxes.push({
      label: 'nas categorias com limite',
      value: formatMoney(report.spentPlanned),
      note: `de ${formatMoney(report.planned)} planejados (${pct(report.spentPlanned / report.planned)})`,
    });
  }
  if (report.committed > 0) {
    boxes.push({ label: 'ainda previsto no mês', value: formatMoney(report.committed), note: 'contas fixas, parcelas...' });
  }
  const gap = 10;
  const bw = (W - gap * (boxes.length - 1)) / boxes.length;
  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap);
    doc.rect(x, 134, bw, 64, colors.cream, 10);
    doc.text(x + 12, 152, b.label, { size: 8.5, color: colors.textSoft });
    doc.text(x + 12, 175, b.value, { size: 16, bold: true, color: b.color ?? colors.text });
    doc.text(x + 12, 189, doc.fit(b.note, bw - 24, 7.5), { size: 7.5, color: colors.textFaint });
  });
  y = 232;

  // ---------- por categoria ----------
  const rows = [...report.withLimit, ...report.withoutLimit.filter((r) => r.spent > 0)];
  const empty = report.withoutLimit.filter((r) => r.spent === 0);
  const col = { bar: M + 150, barW: 120, share: M + 325, spent: M + 415, status: M + 427 };

  doc.text(M, y, 'para onde foi o dinheiro', { size: 13, bold: true });
  y += 20;
  if (!rows.length) {
    paragraph('nenhum gasto registrado neste mês.', 10, colors.textSoft);
  } else {
    doc.text(M, y, 'categoria', { size: 8, color: colors.textFaint });
    doc.text(col.share, y, '% do total', { size: 8, color: colors.textFaint, align: 'right' });
    doc.text(col.spent, y, 'gasto', { size: 8, color: colors.textFaint, align: 'right' });
    doc.text(col.status, y, 'limite do mês', { size: 8, color: colors.textFaint });
    y += 8;
    doc.line(M, y, M + W, y, colors.line);
    for (const r of rows) {
      ensure(34);
      categoryRow(doc, r, y, col, opts.categoryName(r.categoryId));
      y += 34;
      doc.line(M, y, M + W, y, colors.line);
    }
    ensure(26);
    y += 18;
    doc.text(M, y, 'total', { size: 10, bold: true });
    doc.text(col.share, y, '100%', { size: 9, color: colors.textSoft, align: 'right' });
    doc.text(col.spent, y, formatMoney(report.total), { size: 10, bold: true, align: 'right' });
    y += 22;
  }
  if (empty.length) {
    y += 4;
    paragraph(`sem gastos este mês: ${empty.map((r) => opts.categoryName(r.categoryId)).join(', ')}.`, 8.5, colors.textSoft);
  }

  // ---------- cada gasto ----------
  const detailed = rows.filter((r) => r.transactions.length);
  if (detailed.length) {
    y += 18;
    ensure(80);
    doc.text(M, y, 'cada gasto, por categoria', { size: 13, bold: true });
    y += 14;
    for (const r of detailed) {
      ensure(48);
      y += 8;
      doc.rect(M, y, W, 22, colors.cream, 6);
      doc.text(M + 10, y + 14.5, opts.categoryName(r.categoryId), { size: 10, bold: true });
      const count = r.transactions.length;
      doc.text(M + W - 10, y + 14.5, `${formatMoney(r.spent)} · ${count} ${count === 1 ? 'gasto' : 'gastos'}`, {
        size: 9,
        bold: true,
        align: 'right',
      });
      y += 26;
      for (const t of r.transactions) {
        ensure(16);
        y += 12;
        doc.text(M + 10, y, shortDate(t.date), { size: 8.5, color: colors.textSoft });
        doc.text(M + 50, y, doc.fit(t.description, 270, 9), { size: 9 });
        doc.text(M + 330, y, doc.fit(opts.origin(t), 100, 8), { size: 8, color: colors.textFaint });
        doc.text(M + W - 10, y, formatMoney(t.amount), { size: 9, align: 'right' });
        y += 4;
      }
    }
  }

  // ---------- rodapé ----------
  const total = doc.pageCount;
  for (let i = 0; i < total; i++) {
    doc.goToPage(i);
    doc.line(M, A4.height - 40, M + W, A4.height - 40, colors.line);
    doc.text(M, A4.height - 26, 'teo · tudo em ordem · appteo.com.br', { size: 8, color: colors.textFaint });
    doc.text(M + W, A4.height - 26, `página ${i + 1} de ${total}`, { size: 8, color: colors.textFaint, align: 'right' });
  }
  return doc.toBytes(`teo · gastos de ${month}`);
}

function categoryRow(
  doc: PdfDoc,
  r: CategorySpending,
  y: number,
  col: { bar: number; barW: number; share: number; spent: number; status: number },
  name: string,
) {
  doc.text(M, y + 15, doc.fit(name, 140, 10, true), { size: 10, bold: true });
  if (r.limit) doc.text(M, y + 27, `limite ${formatMoney(r.limit)}`, { size: 8, color: colors.textSoft });
  // barra: com limite, quanto do limite foi usado; sem limite, a parte do total
  const color = r.status ? STATUS_COLOR[r.status] : colors.primary;
  const fill = r.limit ? Math.min(1, r.ratio) : r.share;
  doc.rect(col.bar, y + 11, col.barW, 6, colors.muted, 3);
  doc.rect(col.bar, y + 11, Math.max(fill > 0 ? 6 : 0, col.barW * fill), 6, color, 3);
  if (r.limit) doc.text(col.bar, y + 27, `${pct(r.ratio)} do limite usado`, { size: 7.5, color: colors.textSoft });
  doc.text(col.share, y + 15, pct(r.share), { size: 9, color: colors.textSoft, align: 'right' });
  doc.text(col.spent, y + 15, formatMoney(r.spent), { size: 10, bold: true, align: 'right' });
  if (r.status) {
    doc.text(col.status, y + 15, STATUS_LABEL[r.status], { size: 8.5, bold: true, color: STATUS_COLOR[r.status] });
    const note = r.status === 'passou' ? `passou ${formatMoney(r.over)}` : `sobram ${formatMoney(r.available ?? 0)}`;
    doc.text(col.status, y + 27, note, { size: 8, color: colors.textSoft });
  } else {
    doc.text(col.status, y + 15, 'sem limite', { size: 8.5, color: colors.textFaint });
  }
}
