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
