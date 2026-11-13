import {
  Baby,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coins,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Music,
  PawPrint,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Target,
  Tv,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { Icon } from './Icon';

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  alimentacao: ShoppingCart,
  restaurante: Utensils,
  moradia: House,
  transporte: Bus,
  carro: Car,
  combustivel: Fuel,
  saude: HeartPulse,
  academia: Dumbbell,
  lazer: Sparkles,
  jogos: Gamepad2,
  musica: Music,
  compras: ShoppingBag,
  roupas: Shirt,
  educacao: BookOpen,
  curso: GraduationCap,
  assinaturas: Tv,
  internet: Wifi,
  energia: Zap,
  celular: Smartphone,
  pets: PawPrint,
  filhos: Baby,
  presentes: Gift,
  viagem: Plane,
  salario: Briefcase,
  'renda-extra': Coins,
  investimentos: Landmark,
  reserva: PiggyBank,
  meta: Target,
  outros: Ellipsis,
};

export const iconFor = (key?: string | null): LucideIcon =>
  (key && CATEGORY_ICONS[key]) || Ellipsis;

interface Props {
  icon?: string | null;
  size?: number;
  tone?: 'cream' | 'income' | 'muted' | 'primary';
}

const tones = {
  cream: { bg: colors.cream, fg: colors.primary },
  income: { bg: colors.incomeSoft, fg: colors.income },
  muted: { bg: colors.muted, fg: colors.textSoft },
  primary: { bg: colors.primary, fg: colors.white },
};

/** ícone de categoria dentro de uma bolinha suave. */
export function CategoryIcon({ icon, size = 44, tone = 'cream' }: Props) {
  const t = tones[tone];
  return (
    <View style={[styles.bubble, { width: size, height: size, backgroundColor: t.bg }]}>
      <Icon as={iconFor(icon)} size={size * 0.46} color={t.fg} />
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
