import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useDesktop } from '../hooks/useDesktop';
import { space } from '../theme';

// 'sticky' só existe no navegador; no celular a coluna nem aparece ao lado.
const STICKY = { position: 'sticky', top: space.lg } as unknown as ViewStyle;

/**
 * duas colunas no computador; no celular, uma embaixo da outra (na mesma ordem).
 * `ratio`: quanto a coluna da esquerda ocupa em relação à da direita.
 */
export function Columns({
  left,
  right,
  ratio = 1,
  stickyLeft = false,
}: {
  left: ReactNode;
  right: ReactNode;
  ratio?: number;
  /** no navegador, a coluna da esquerda acompanha a rolagem (ex.: o resumo do horizonte). */
  stickyLeft?: boolean;
}) {
  const desktop = useDesktop();
  if (!desktop) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.xxl }}>
      <View style={[{ flex: ratio, minWidth: 0 }, stickyLeft && Platform.OS === 'web' ? STICKY : null]}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  );
}
