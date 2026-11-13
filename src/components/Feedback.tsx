import { nativeDriver } from '../lib/platform';
import { Check, Info } from 'lucide-react-native';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useAnimatedValue } from '../hooks/useAnimatedValue';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface FeedbackValue {
  /** mensagem curta no topo, que some sozinha. */
  toast(message: string, tone?: 'ok' | 'info' | 'erro'): void;
  /** pergunta de confirmação (funciona igual no celular e na web). */
  confirm(opts: ConfirmOptions): Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toastState, setToastState] = useState<{ message: string; tone: 'ok' | 'info' | 'erro' } | null>(null);
  const anim = useAnimatedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const toast = useCallback(
    (message: string, tone: 'ok' | 'info' | 'erro' = 'ok') => {
      if (timer.current) clearTimeout(timer.current);
      setToastState({ message, tone });
      Animated.spring(anim, { toValue: 1, useNativeDriver: nativeDriver, speed: 18, bounciness: 4 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: nativeDriver }).start(() => setToastState(null));
      }, 2600);
    },
    [anim],
  );

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })),
    [],
  );

  const close = (v: boolean) => {
    dialog?.resolve(v);
    setDialog(null);
  };

  const toneColor = toastState?.tone === 'erro' ? colors.danger : toastState?.tone === 'info' ? colors.text : colors.income;

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      {toastState ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toastWrap,
            { top: insets.top + space.md },
            {
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <Icon as={toastState.tone === 'ok' ? Check : Info} size={18} color={toneColor} />
            <Text variant="smallStrong" style={{ flexShrink: 1 }}>
              {toastState.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
      <Sheet visible={!!dialog} onClose={() => close(false)} title={dialog?.title}>
        {dialog?.message ? (
          <Text color={colors.textSoft} style={{ marginBottom: space.xl }}>
            {dialog.message}
          </Text>
        ) : null}
        <View style={{ gap: space.sm }}>
          <Button
            label={dialog?.confirmLabel ?? 'confirmar'}
            variant={dialog?.danger ? 'danger' : 'primary'}
            onPress={() => close(true)}
          />
          <Button label={dialog?.cancelLabel ?? 'cancelar'} variant="ghost" onPress={() => close(false)} />
        </View>
      </Sheet>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback fora do FeedbackProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: 420,
    marginHorizontal: space.xl,
    ...shadow.card,
  },
});
