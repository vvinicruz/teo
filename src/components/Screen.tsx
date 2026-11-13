import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, MAX_WIDTH, space } from '../theme';
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
}

export function Screen({ children, title, back, right, footer, scroll = true, tabBarSpace, scrollProps }: Props) {
  const insets = useSafeAreaInsets();
  const header =
    title || back || right ? (
      <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
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

  const bottomPad = (tabBarSpace ? 110 : space.xxxl) + (footer ? 0 : insets.bottom);
  const content = <View style={styles.inner}>{children}</View>;

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
          <View style={styles.footerInner}>{footer}</View>
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
