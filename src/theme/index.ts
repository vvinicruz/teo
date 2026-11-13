/**
 * sistema visual do teo.
 * laranja é destaque, nunca fundo de tela inteira. fundos claros e cremosos,
 * bastante respiro, cantos arredondados e sombras quase imperceptíveis.
 */
export const colors = {
  primary: '#FF5C00',
  primaryPressed: '#E65300',
  cream: '#FFF3EA', // creme da marca
  creamDeep: '#FFE6D5',
  background: '#FFFAF6', // off-white quente
  surface: '#FFFFFF',
  muted: '#F2F2F2',
  line: '#F1E8E1',
  text: '#1A1A1A',
  textSoft: '#6E6660',
  textFaint: '#A8A09A',
  income: '#1F9D6B',
  incomeSoft: '#E8F6EF',
  attention: '#C77700',
  attentionSoft: '#FFF4E0',
  danger: '#D93A2B',
  dangerSoft: '#FDECEA',
  overlay: 'rgba(26, 26, 26, 0.35)',
  white: '#FFFFFF',
} as const;

/** montserrat é a alternativa gratuita mais próxima da gotham. troque aqui quando houver licença. */
export const fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const type = {
  display: { fontFamily: fonts.semibold, fontSize: 34, lineHeight: 42, letterSpacing: -0.6 },
  title: { fontFamily: fonts.semibold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, letterSpacing: -0.1 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, letterSpacing: 0.2 },
} as const;

export type TypeVariant = keyof typeof type;

export const shadow = {
  // sombra bem leve, só para descolar o card do fundo.
  card: {
    shadowColor: '#7A4A2A',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  float: {
    shadowColor: '#FF5C00',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

/** largura máxima do conteúdo em telas grandes (web/tablet). */
export const MAX_WIDTH = 560;
