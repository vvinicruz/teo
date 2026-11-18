/**
 * bancos mais comuns para cartão de crédito, com o código usado pelo banco central
 * (8 primeiros dígitos do cnpj da instituição que aparece nas estatísticas de juros).
 */
export interface Bank {
  code: string;
  name: string;
}

export const BANKS: Bank[] = [
  { code: '30680829', name: 'nubank' },
  { code: '60872504', name: 'itaú' },
  { code: '60746948', name: 'bradesco' },
  { code: '90400888', name: 'santander' },
  { code: '00000000', name: 'banco do brasil' },
  { code: '00360305', name: 'caixa' },
  { code: '00416968', name: 'inter' },
  { code: '31872495', name: 'c6 bank' },
  { code: '09516419', name: 'picpay' },
  { code: '37679449', name: 'mercado pago' },
  { code: '11285104', name: 'neon' },
  { code: '59285411', name: 'banco pan' },
  { code: '30306294', name: 'btg pactual' },
  { code: '33264668', name: 'xp' },
  { code: '01858774', name: 'banco bv' },
  { code: '02038232', name: 'sicoob' },
  { code: '92702067', name: 'banrisul' },
  { code: '27098060', name: 'digio' },
  { code: '61186680', name: 'bmg' },
  { code: '58160789', name: 'safra' },
  { code: '04862600', name: 'porto seguro' },
  { code: '08357240', name: 'carrefour' },
  { code: '02206577', name: 'magalu' },
];

const GUESSES: [RegExp, string][] = [
  [/\bnu\b|nubank|nu ?conta/, '30680829'],
  [/itau|personnalite|uniclass/, '60872504'],
  [/bradesco|next\b/, '60746948'],
  [/santander/, '90400888'],
  [/banco do brasil|\bbb\b|ourocard/, '00000000'],
  [/caixa|\bcef\b/, '00360305'],
  [/\binter\b|banco inter/, '00416968'],
  [/\bc6\b|c6 ?bank/, '31872495'],
  [/picpay/, '09516419'],
  [/mercado ?pago|\bmp\b/, '37679449'],
  [/\bneon\b/, '11285104'],
  [/\bpan\b|banco pan/, '59285411'],
  [/\bbtg\b/, '30306294'],
  [/\bxp\b/, '33264668'],
  [/\bbv\b/, '01858774'],
  [/sicoob/, '02038232'],
  [/banrisul/, '92702067'],
  [/digio/, '27098060'],
  [/\bbmg\b/, '61186680'],
  [/safra/, '58160789'],
  [/porto ?seguro|porto ?bank/, '04862600'],
  [/carrefour|atacadao/, '08357240'],
  [/magalu|magazine ?luiza|luizacred/, '02206577'],
];

/** banco de um cartão ou conta: o escolhido, ou um palpite pelo nome ("itaú 0194" → itaú). */
export function bankCodeFor(bankCode: string | null | undefined, name: string): string | null {
  if (bankCode && BANKS.some((b) => b.code === bankCode)) return bankCode;
  const n = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return GUESSES.find(([re]) => re.test(n))?.[1] ?? null;
}
