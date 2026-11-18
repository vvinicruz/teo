import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesktop } from '../hooks/useDesktop';
import { colors, DESKTOP_WIDTH, MAX_WIDTH, space } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

interface Props {
  children: ReactNode;
  title?: string;
  /** mostra a seta de voltar. */
  back?: boolean;
  right?: ReactNode;
  /** conteúdo fixo no rodapé (ex.: botão salvar). */
  footer?: ReactNode;
  scroll?: boolean;
  /** espaço extra no fim para a barra de navegação. */
  tabBarSpace?: boolean;
  scrollProps?: ScrollViewProps;
  /** largura no computador: estreita (formulários), média (listas) ou larga (painéis). */
  width?: keyof typeof DESKTOP_WIDTH;
}

export function Screen({ children, title, back, right, footer, scroll = true, tabBarSpace, scrollProps, width = 'narrow' }: Props) {
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  // no computador não há barra embaixo, e o conteúdo pode ser mais largo
  const maxWidth = desktop ? DESKTOP_WIDTH[width] : MAX_WIDTH;
  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingTop: insets.top + (desktop ? space.xl : space.sm), maxWidth }]}>
        <View style={styles.headerSide}>
          {back ? (
            <IconButton
              icon={ChevronLeft}
              label="voltar"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              background={colors.surface}
            />
          ) : null}
        </View>
        {title ? (
          <Text variant="bodyStrong" center style={{ flex: 1 }} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
    ) : (
      <View style={{ height: insets.top }} />
    );

  const bottomPad = (tabBarSpace && !desktop ? 110 : space.xxxl) + (footer ? 0 : insets.bottom);
  const content = (
    <View style={[styles.inner, { maxWidth }, desktop && { paddingTop: space.md }]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          contentContainerStyle={[{ paddingBottom: bottomPad }, scrollProps?.contentContainerStyle]}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={[styles.footerInner, { maxWidth }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  headerSide: { width: 48 },
  inner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', paddingHorizontal: space.xl, flex: 1 },
  footer: { paddingTop: space.md, paddingHorizontal: space.xl, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.line },
  footerInner: { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
});
