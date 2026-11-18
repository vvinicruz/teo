import { describe, expect, it } from 'vitest';
import { BANKS, bankCodeFor } from '../banks';

const code = (name: string) => BANKS.find((b) => b.name === name)!.code;

describe('banco de cartões e contas', () => {
  it('usa o banco escolhido no cadastro', () => {
    expect(bankCodeFor(code('nubank'), 'cartão roxinho')).toBe(code('nubank'));
  });
  it('adivinha pelo nome quando não foi escolhido', () => {
    expect(bankCodeFor(null, 'itaú 0194')).toBe(code('itaú'));
    expect(bankCodeFor(null, 'Nubank')).toBe(code('nubank'));
    expect(bankCodeFor(null, 'nu')).toBe(code('nubank'));
    expect(bankCodeFor(null, 'conta do bb')).toBe(code('banco do brasil'));
    expect(bankCodeFor(null, 'C6')).toBe(code('c6 bank'));
    expect(bankCodeFor(null, 'mercado pago')).toBe(code('mercado pago'));
    expect(bankCodeFor(null, 'inter black')).toBe(code('inter'));
  });
  it('não inventa banco', () => {
    expect(bankCodeFor(null, 'carteira')).toBeNull();
    expect(bankCodeFor(null, 'numero 2')).toBeNull();
    expect(bankCodeFor(null, 'internacional')).toBeNull();
  });
});
