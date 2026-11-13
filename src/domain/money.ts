/**
 * dinheiro é sempre guardado em centavos inteiros para evitar erros de arredondamento.
 */
export type Cents = number;

const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** formata centavos como "R$ 1.234,56" (com espaço comum, não o espaço especial do Intl). */
export function formatMoney(cents: Cents, opts: { sign?: boolean } = {}): string {
  const value = formatter.format(Math.abs(cents) / 100).replace(/ /g, ' ');
  if (cents < 0) return `- ${value}`;
  if (opts.sign && cents > 0) return `+ ${value}`;
  return value;
}

/** converte "1.234,56", "1234,5", "R$ 12" etc. em centavos. retorna null se inválido. */
export function parseMoney(input: string): Cents | null {
  const clean = input.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return null;
  let normalized = clean;
  if (clean.includes(',')) {
    normalized = clean.replace(/\./g, '').replace(',', '.');
  } else if ((clean.match(/\./g) ?? []).length > 1) {
    normalized = clean.replace(/\./g, '');
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

/** usado no campo de valor estilo "caixa registradora": só dígitos, preenchendo da direita. */
export function centsFromDigits(digits: string): Cents {
  const only = digits.replace(/\D/g, '').slice(0, 11);
  return only ? parseInt(only, 10) : 0;
}

export function sum(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}
