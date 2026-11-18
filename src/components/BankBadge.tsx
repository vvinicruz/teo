import { CreditCard, Landmark, Wallet } from 'lucide-react-native';
import { View } from 'react-native';
import { bankCodeFor } from '../domain/banks';
import { BANK_STYLES, colors, fonts } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

interface Props {
  /** banco escolhido no cadastro (se houver). */
  bankCode?: string | null;
  /** nome do cartão ou da conta: usado para adivinhar o banco ("itaú 0194"). */
  name: string;
  /** o que é: muda o ícone quando não sabemos o banco. */
  kind: 'cartao' | 'conta' | 'principal';
  size?: number;
}

/** ícone de cartão ou conta com a cor do banco e o nome curto (ex.: "nu" roxo, "itaú" laranja). */
export function BankBadge({ bankCode, name, kind, size = 40 }: Props) {
  const code = kind === 'principal' ? bankCode ?? null : bankCodeFor(bankCode, name);
  const style = code ? BANK_STYLES[code] : undefined;
  const box = { width: size, height: size, borderRadius: size / 2, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (!style) {
    const icon = kind === 'cartao' ? CreditCard : kind === 'conta' ? Landmark : Wallet;
    return (
      <View style={[box, { backgroundColor: colors.cream }]}>
        <Icon as={icon} size={Math.round(size * 0.5)} color={colors.primary} />
      </View>
    );
  }
  const len = style.short.length;
  const fontSize = size * (len <= 2 ? 0.4 : len === 3 ? 0.32 : len === 4 ? 0.27 : 0.23);
  return (
    <View style={[box, { backgroundColor: style.bg }]} accessibilityLabel={name}>
      <Text
        variant="smallStrong"
        color={style.fg}
        style={{ fontFamily: fonts.bold, fontSize, lineHeight: fontSize * 1.15, letterSpacing: -0.3 }}
        numberOfLines={1}
      >
        {style.short}
      </Text>
    </View>
  );
}
