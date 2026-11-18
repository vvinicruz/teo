/**
 * cores de cada banco, para o ícone de cartões e contas (sem usar os logos, que são marcas registradas).
 * bg = fundo, fg = texto, short = nome curto escrito no ícone.
 */
export interface BankStyle {
  bg: string;
  fg: string;
  short: string;
}

export const BANK_STYLES: Record<string, BankStyle> = {
  '30680829': { bg: '#820AD1', fg: '#FFFFFF', short: 'nu' }, // nubank
  '60872504': { bg: '#EC7000', fg: '#FFFFFF', short: 'itaú' }, // itaú
  '60746948': { bg: '#CC092F', fg: '#FFFFFF', short: 'bra' }, // bradesco
  '90400888': { bg: '#EC0000', fg: '#FFFFFF', short: 'san' }, // santander
  '00000000': { bg: '#FCF800', fg: '#0038A8', short: 'bb' }, // banco do brasil
  '00360305': { bg: '#005CA9', fg: '#FFFFFF', short: 'cx' }, // caixa
  '00416968': { bg: '#FF7A00', fg: '#FFFFFF', short: 'inter' }, // inter
  '31872495': { bg: '#1E1E1E', fg: '#FFFFFF', short: 'c6' }, // c6 bank
  '09516419': { bg: '#21C25E', fg: '#FFFFFF', short: 'pp' }, // picpay
  '37679449': { bg: '#00B1EA', fg: '#FFFFFF', short: 'mp' }, // mercado pago
  '11285104': { bg: '#0DB4E9', fg: '#0B1F3A', short: 'neon' }, // neon
  '59285411': { bg: '#009EE3', fg: '#FFFFFF', short: 'pan' }, // banco pan
  '30306294': { bg: '#0B2341', fg: '#FFFFFF', short: 'btg' }, // btg pactual
  '33264668': { bg: '#111111', fg: '#FFD100', short: 'xp' }, // xp
  '01858774': { bg: '#1C3F94', fg: '#FFFFFF', short: 'bv' }, // banco bv
  '02038232': { bg: '#003641', fg: '#C9D200', short: 'sic' }, // sicoob
  '92702067': { bg: '#0055A5', fg: '#FFFFFF', short: 'ban' }, // banrisul
  '27098060': { bg: '#0A1E5E', fg: '#FFFFFF', short: 'dg' }, // digio
  '61186680': { bg: '#FF6B00', fg: '#FFFFFF', short: 'bmg' }, // bmg
  '58160789': { bg: '#13294B', fg: '#C9A84C', short: 'sf' }, // safra
  '04862600': { bg: '#0083CA', fg: '#FFFFFF', short: 'ps' }, // porto seguro
  '08357240': { bg: '#1E5BC6', fg: '#FFFFFF', short: 'crf' }, // carrefour
  '02206577': { bg: '#0086FF', fg: '#FFFFFF', short: 'mgl' }, // magalu
};
