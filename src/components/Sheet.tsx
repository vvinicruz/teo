import { nativeDriver } from '../lib/platform';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useDesktop } from '../hooks/useDesktop';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MAX_WIDTH, radius, space } from '../theme';
import { Text } from './Text';

interface Props {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/** painel que sobe de baixo. usado para escolhas rápidas sem trocar de tela. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const [mounted, setMounted] = useState(visible);
  const anim = useAnimatedValue(0);

  // abre na hora; fecha só depois da animação de saída.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="fechar" />
      </Animated.View>
      <View style={[styles.anchor, desktop && styles.anchorCenter]} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            desktop ? styles.dialog : { paddingBottom: insets.bottom + space.xl },
            {
              transform: [
                // no computador, aparece no meio da tela, subindo só um pouquinho
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [desktop ? 24 : 500, 0] }) },
              ],
            },
            desktop && { opacity: anim },
          ]}
        >
          {desktop ? null : <View style={styles.handle} />}
          {title ? (
            <Text variant="heading" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false} style={{ flexGrow: 0 }}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: colors.overlay },
  anchor: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  anchorCenter: { justifyContent: 'center', padding: space.xl },
  sheet: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.lg },
  title: { marginBottom: space.lg },
  dialog: { maxWidth: 520, borderRadius: radius.xl, paddingTop: space.xl, paddingBottom: space.xl },
});
