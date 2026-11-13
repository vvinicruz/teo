/**
 * datas são guardadas como texto "aaaa-mm-dd" (dia local, sem fuso),
 * meses como "aaaa-mm". isso evita bugs de fuso horário em valores financeiros.
 */
export type ISODate = string; // aaaa-mm-dd
export type MonthKey = string; // aaaa-mm

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function parseISODate(s: ISODate): { year: number; month: number; day: number } {
  const [year, month, day] = s.split('-').map(Number);
  return { year, month, day };
}

export function makeDate(year: number, month: number, day: number): ISODate {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function parseMonth(m: MonthKey): { year: number; month: number } {
  const [year, month] = m.split('-').map(Number);
  return { year, month };
}

export function daysInMonth(m: MonthKey): number {
  const { year, month } = parseMonth(m);
  return new Date(year, month, 0).getDate();
}

export function addMonths(m: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonth(m);
  const idx = year * 12 + (month - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function addDays(date: ISODate, delta: number): ISODate {
  const { year, month, day } = parseISODate(date);
  return toISODate(new Date(year, month - 1, day + delta));
}

export function firstDay(m: MonthKey): ISODate {
  return `${m}-01`;
}

export function lastDay(m: MonthKey): ISODate {
  return `${m}-${pad(daysInMonth(m))}`;
}

/** todos os dias do mês, em ordem. */
export function monthDays(m: MonthKey): ISODate[] {
  return Array.from({ length: daysInMonth(m) }, (_, i) => `${m}-${pad(i + 1)}`);
}

/** quantidade de dias entre duas datas, incluindo as duas pontas. */
export function daysInclusive(from: ISODate, to: ISODate): number {
  const a = parseISODate(from);
  const b = parseISODate(to);
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000) + 1;
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

export function weekday(date: ISODate, short = false): string {
  const { year, month, day } = parseISODate(date);
  const idx = new Date(year, month - 1, day).getDay();
  return short ? WEEKDAYS_SHORT[idx] : WEEKDAYS[idx];
}

export function weekdayIndex(date: ISODate): number {
  const { year, month, day } = parseISODate(date);
  return new Date(year, month - 1, day).getDay();
}

export function monthName(m: MonthKey, withYear = false): string {
  const { year, month } = parseMonth(m);
  const name = MONTHS[month - 1];
  return withYear ? `${name} de ${year}` : name;
}

export const WEEKDAY_INITIALS = ['d', 's', 't', 'q', 'q', 's', 's'];

/** "hoje", "ontem", "amanhã" ou "12 de março". */
export function friendlyDate(date: ISODate, ref: ISODate = today()): string {
  if (date === ref) return 'hoje';
  if (date === addDays(ref, -1)) return 'ontem';
  if (date === addDays(ref, 1)) return 'amanhã';
  const { year, month, day } = parseISODate(date);
  const base = `${day} de ${MONTHS[month - 1]}`;
  return year === parseISODate(ref).year ? base : `${base} de ${year}`;
}

/** "12 de novembro". */
export function dayAndMonth(date: ISODate): string {
  const { month, day } = parseISODate(date);
  return `${day} de ${MONTHS[month - 1]}`;
}

export function shortDate(date: ISODate): string {
  const { month, day } = parseISODate(date);
  return `${pad(day)}/${pad(month)}`;
}
