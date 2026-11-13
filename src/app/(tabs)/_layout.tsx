import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { CalendarDays, House, Plus, ReceiptText, Target, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Pressable, Text } from '../../components';
import { colors, MAX_WIDTH, radius, shadow, space } from '../../theme';

const TABS: Record<string, { label: string; icon: LucideIcon }> = {
  index: { label: 'início', icon: House },
  horizonte: { label: 'horizonte', icon: CalendarDays },
  extrato: { label: 'extrato', icon: ReceiptText },
  metas: { label: 'metas', icon: Target },
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="horizonte" />
      <Tabs.Screen name="extrato" />
      <Tabs.Screen name="metas" />
    </Tabs>
  );
}

/** barra inferior do teo: quatro áreas e o "+" no centro, sempre à mão. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const items = state.routes.map((route, index) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.index === index;
    const color = focused ? colors.primary : colors.textFaint;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={() => {
          if (!focused) navigateToTab(route.key);
        }}
        style={styles.tab}
        scaleTo={0.92}
      >
        <Icon as={tab.icon} size={23} color={color} strokeWidth={focused ? 2.1 : 1.8} />
        <Text variant="caption" color={color}>
          {tab.label}
        </Text>
      </Pressable>
    );
  });

  const add = (
    <View key="add" style={styles.tab}>
      <Pressable
        onPress={() => router.push('/movimentacao')}
        accessibilityRole="button"
        accessibilityLabel="adicionar movimentação"
        style={styles.add}
        scaleTo={0.9}
      >
        <Icon as={Plus} size={28} color={colors.white} strokeWidth={2.4} />
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <View style={styles.row}>
        {items.slice(0, 2)}
        {add}
        {items.slice(2)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    paddingTop: space.sm,
    ...shadow.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 4 },
  add: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
    ...shadow.float,
  },
});
