import { router, usePathname, type Href } from 'expo-router';
import {
  CalendarDays,
  ChartPie,
  FileText,
  FileUp,
  House,
  LifeBuoy,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat,
  Target,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useData } from '../data/DataProvider';
import { dailyAllowance } from '../domain/finance';
import { useToday } from '../hooks/useToday';
import { colors, radius, shadow, SIDEBAR_WIDTH, space } from '../theme';
import { Icon } from './Icon';
import { Logo } from './Logo';
import { Money } from './Money';
import { Pressable } from './Pressable';
import { Text } from './Text';
import { TourTarget } from './Tour';

interface Item {
  label: string;
  icon: LucideIcon;
  href: string;
  /** outras rotas que também deixam este item aceso. */
  also?: string[];
}

const MAIN: Item[] = [
  { label: 'início', icon: House, href: '/' },
  { label: 'horizonte', icon: CalendarDays, href: '/horizonte' },
  { label: 'extrato', icon: ReceiptText, href: '/extrato' },
  { label: 'metas', icon: Target, href: '/metas', also: ['/meta', '/objetivo'] },
];
const ORGANIZE: Item[] = [
  { label: 'gastos por categoria', icon: ChartPie, href: '/planejamento', also: ['/gasto-categoria'] },
  { label: 'contas e cartões', icon: Wallet, href: '/contas', also: ['/cartoes', '/cartao', '/conta-form', '/cartao-form'] },
  { label: 'contas fixas', icon: Repeat, href: '/recorrencias', also: ['/recorrencia'] },
  { label: 'caixinhas', icon: PiggyBank, href: '/guardado', also: ['/caixinha', '/caixinha-form'] },
  { label: 'importar extrato', icon: FileUp, href: '/importar' },
  { label: 'imposto de renda', icon: FileText, href: '/imposto', also: ['/imposto-quiz'] },
];

/** barra lateral do computador: as áreas do teo e o "novo lançamento" sempre à mão. */
export function Sidebar() {
  const pathname = usePathname();
  const { data } = useData();
  const todayDate = useToday();
  const allowance = dailyAllowance(data, todayDate);
  const name = data.settings.name;

  const go = (href: string) => router.navigate(href as Href);
  const active = (i: Item) => pathname === i.href || !!i.also?.includes(pathname);

  const row = (i: Item) => {
    const on = active(i);
    return (
      <Pressable
        key={i.href}
        onPress={() => go(i.href)}
        style={[styles.item, on && styles.itemOn]}
        accessibilityRole="link"
        accessibilityState={{ selected: on }}
        accessibilityLabel={i.label}
        scaleTo={0.98}
      >
        <Icon as={i.icon} size={20} color={on ? colors.primary : colors.textSoft} strokeWidth={on ? 2.1 : 1.8} />
        <Text variant={on ? 'smallStrong' : 'small'} color={on ? colors.primary : colors.text}>
          {i.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.bar}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => go('/')} accessibilityRole="link" accessibilityLabel="início" style={styles.logo}>
          <Logo height={46} slogan />
        </Pressable>

        <TourTarget id="tab-add">
          <Pressable
            onPress={() => router.push('/movimentacao')}
            style={styles.add}
            accessibilityRole="button"
            accessibilityLabel="adicionar movimentação"
            scaleTo={0.97}
          >
            <Icon as={Plus} size={20} color={colors.white} strokeWidth={2.4} />
            <Text variant="bodyStrong" color={colors.white}>
              novo lançamento
            </Text>
          </Pressable>
        </TourTarget>

        <View style={styles.group}>{MAIN.map(row)}</View>
        <Text variant="caption" color={colors.textFaint} style={styles.groupTitle}>
          organizar
        </Text>
        <View style={styles.group}>{ORGANIZE.map(row)}</View>

        {/* o número que mais importa, sempre à vista */}
        <Pressable onPress={() => go('/horizonte')} style={styles.allowance} accessibilityRole="link">
          <Text variant="caption" color={colors.textSoft}>
            {allowance.leftToday >= 0 ? 'hoje ainda dá pra gastar' : 'hoje você passou um pouquinho'}
          </Text>
          <Money
            value={Math.abs(allowance.leftToday)}
            variant="heading"
            color={allowance.leftToday >= 0 ? colors.primary : colors.attention}
          />
        </Pressable>
      </ScrollView>

      <View style={styles.bottom}>
        {row({ label: 'ajuda', icon: LifeBuoy, href: '/ajuda' })}
        <Pressable onPress={() => go('/perfil')} style={[styles.item, pathname === '/perfil' && styles.itemOn]} accessibilityRole="link" accessibilityLabel="perfil">
          <View style={styles.avatar}>
            <Text variant="smallStrong" color={colors.primary}>
              {(name[0] ?? 't').toLowerCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="smallStrong" numberOfLines={1}>
              {name || 'seu perfil'}
            </Text>
            <Text variant="caption" color={colors.textFaint}>
              perfil e ajustes
            </Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.line,
  },
  scroll: { padding: space.xl, paddingBottom: space.lg, gap: space.lg },
  logo: { alignSelf: 'flex-start', marginBottom: space.sm },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.float,
  },
  group: { gap: 2 },
  groupTitle: { marginTop: space.sm, marginBottom: -space.sm, paddingHorizontal: space.md, letterSpacing: 0.6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md },
  itemOn: { backgroundColor: colors.cream },
  allowance: { marginTop: space.md, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.cream, gap: 2 },
  bottom: { padding: space.lg, borderTopWidth: 1, borderTopColor: colors.line, gap: 2 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
});
