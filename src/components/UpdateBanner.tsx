import { RefreshCw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { colors, radius, space } from '../theme';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Text } from './Text';

/** aviso discreto quando há uma versão nova do teo publicada (no navegador). */
export function UpdateBanner() {
  const { available, reload } = useAppUpdate();
  const insets = useSafeAreaInsets();
  if (!available) return null;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + space.sm }]}>
      <Pressable onPress={reload} style={styles.pill} accessibilityRole="button" accessibilityLabel="atualizar o teo">
        <Icon as={RefreshCw} size={16} color={colors.white} />
        <Text variant="smallStrong" color={colors.white}>
          tem novidade no teo · toque para atualizar
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.text,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
});
