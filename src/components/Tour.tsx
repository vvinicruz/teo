/**
 * passo a passo interativo: escurece a tela, destaca uma parte (um botão, um card) e explica.
 * a pessoa pode tocar no que está destacado (o passo a passo segue sozinho quando ela chega
 * na tela esperada), ir para o próximo sem tocar, voltar ou pular tudo.
 *
 * para marcar algo que pode ser destacado: <TourTarget id="home-saldo">...</TourTarget>.
 * os roteiros ficam em src/content/tours.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, usePathname, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View, type ViewInstance, type ViewStyle } from 'react-native';
import { TOURS, type Tour } from '../content/tours';
import { colors, radius, shadow, space } from '../theme';
import { Button } from './Button';
import { Pressable } from './Pressable';
import { Text } from './Text';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourApi {
  /** começa um passo a passo (ex.: "primeiros-passos"). */
  start: (id: string, opts?: { delay?: number }) => void;
  stop: () => void;
  active: boolean;
  /** já fez (ou pulou) esse passo a passo? */
  seen: (id: string) => Promise<boolean>;
}

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void; scrollIntoView?: (o: object) => void };

const TourContext = createContext<TourApi | null>(null);
const TargetsContext = createContext<Map<string, Measurable> | null>(null);
const ActiveTargetContext = createContext<string | null>(null);

/** telas abertas por cima (modais): para sair delas, voltamos. */
const MODALS = ['/movimentacao', '/importar', '/recorrencia', '/meta', '/cartao-form', '/conta-form'];
const SEEN_KEY = (id: string) => `teo:tour:${id}`;

export function useTour(): TourApi {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour fora do TourProvider');
  return ctx;
}

/** marca uma parte da tela que o passo a passo pode destacar. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewStyle }) {
  const targets = useContext(TargetsContext);
  const active = useContext(ActiveTargetContext);
  const ref = useRef<ViewInstance>(null);
  useEffect(() => {
    const node = ref.current as unknown as Measurable | null;
    if (!targets || !node) return;
    targets.set(id, node);
    return () => {
      if (targets.get(id) === node) targets.delete(id);
    };
  }, [targets, id]);
  // no navegador, rola a tela até a parte destacada
  useEffect(() => {
    if (active !== id || Platform.OS !== 'web') return;
    const node = ref.current as unknown as Measurable | null;
    node?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [active, id]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

export function TourProvider({ children }: { children: ReactNode }) {
  const targets = useMemo(() => new Map<string, Measurable>(), []);
  const [state, setState] = useState<{ tour: Tour; index: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finish = useCallback((tour: Tour) => {
    AsyncStorage.setItem(SEEN_KEY(tour.id), '1').catch(() => {});
    setState(null);
  }, []);

  const api = useMemo<TourApi>(
    () => ({
      start(id, opts) {
        const tour = TOURS.find((t) => t.id === id);
        if (!tour) return;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState({ tour, index: 0 }), opts?.delay ?? 0);
      },
      stop() {
        if (timer.current) clearTimeout(timer.current);
        setState((s) => {
          if (s) AsyncStorage.setItem(SEEN_KEY(s.tour.id), '1').catch(() => {});
          return null;
        });
      },
      active: !!state,
      seen: async (id) => (await AsyncStorage.getItem(SEEN_KEY(id)).catch(() => null)) === '1',
    }),
    [state],
  );

  const step = state ? state.tour.steps[state.index] : null;

  return (
    <TourContext.Provider value={api}>
      <TargetsContext.Provider value={targets}>
        <ActiveTargetContext.Provider value={step?.target ?? null}>
          {children}
          {state && step ? (
            <TourOverlay
              key={`${state.tour.id}:${state.index}`}
              tour={state.tour}
              index={state.index}
              targets={targets}
              onGo={(index) => (index >= state.tour.steps.length ? finish(state.tour) : setState({ tour: state.tour, index }))}
              onSkip={() => finish(state.tour)}
            />
          ) : null}
        </ActiveTargetContext.Provider>
      </TargetsContext.Provider>
    </TourContext.Provider>
  );
}

function TourOverlay({
  tour,
  index,
  targets,
  onGo,
  onSkip,
}: {
  tour: Tour;
  index: number;
  targets: Map<string, Measurable>;
  onGo: (index: number) => void;
  onSkip: () => void;
}) {
  const step = tour.steps[index];
  const pathname = usePathname();
  const { width, height } = useWindowDimensions();
  const [rect, setRect] = useState<Rect | null>(null);
  const last = index === tour.steps.length - 1;

  // leva a pessoa até a tela do passo
  useEffect(() => {
    if (pathname === step.route) return;
    if (MODALS.includes(pathname) && router.canGoBack()) router.back();
    const t = setTimeout(() => {
      if (step.route === '/movimentacao' || MODALS.includes(step.route)) router.push(step.route as Href);
      else router.navigate(step.route as Href);
    }, MODALS.includes(pathname) ? 300 : 0);
    return () => clearTimeout(t);
    // só quando o passo muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // a pessoa tocou no que estava destacado e chegou na tela esperada: segue sozinho.
  // (só se ela mudou de tela durante este passo; ao voltar um passo, não avança de novo)
  const [startPath] = useState(pathname);
  useEffect(() => {
    if (step.advanceOnRoute && pathname !== startPath && pathname === step.advanceOnRoute) onGo(index + 1);
  }, [pathname, startPath, step, index, onGo]);

  // acompanha a posição da parte destacada (a tela pode rolar ou mudar)
  useEffect(() => {
    if (!step.target) return;
    let alive = true;
    const measure = () => {
      const node = targets.get(step.target!);
      if (!node?.measureInWindow) return setRect(null);
      node.measureInWindow((x, y, w, h) => {
        if (!alive) return;
        setRect((r) => (r && r.x === x && r.y === y && r.width === w && r.height === h ? r : w || h ? { x, y, width: w, height: h } : null));
      });
    };
    measure();
    const t = setInterval(measure, 250);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [step, targets]);

  const pad = 6;
  const hole = step.target && rect ? { x: rect.x - pad, y: rect.y - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null;
  const cardWidth = Math.min(width - space.lg * 2, 380);
  const cardLeft = (width - cardWidth) / 2;
  // cartão abaixo do destaque se couber; senão, acima; sem destaque, no meio
  const below = hole ? hole.y + hole.h + space.md : 0;
  const cardStyle: ViewStyle = hole
    ? below + 220 < height
      ? { top: below }
      : { bottom: Math.max(space.lg, height - hole.y + space.md) }
    : { top: height * 0.28 };
  const fixed = (Platform.OS === 'web' ? 'fixed' : 'absolute') as ViewStyle['position'];
  const shade = colors.scrim;

  return (
    <View style={[StyleSheet.absoluteFill, { position: fixed, zIndex: 9999 }]} pointerEvents="box-none">
      {hole ? (
        <>
          <View style={[styles.shade, { backgroundColor: shade, top: 0, left: 0, right: 0, height: Math.max(0, hole.y) }]} />
          <View style={[styles.shade, { backgroundColor: shade, top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.shade, { backgroundColor: shade, top: hole.y, left: 0, width: Math.max(0, hole.x), height: hole.h }]} />
          <View style={[styles.shade, { backgroundColor: shade, top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
          <View pointerEvents="none" style={[styles.ring, { top: hole.y, left: hole.x, width: hole.w, height: hole.h }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: shade }]} />
      )}

      <View style={[styles.card, { width: cardWidth, left: cardLeft }, cardStyle]} accessibilityRole="alert">
        <Text variant="caption" color={colors.primary}>
          {tour.title} · {index + 1} de {tour.steps.length}
        </Text>
        <Text variant="heading">{step.title}</Text>
        <Text color={colors.textSoft}>{step.text}</Text>
        {step.advanceOnRoute ? (
          <Text variant="small" color={colors.textFaint}>
            experimente tocar no que está destacado, ou siga com &quot;próximo&quot;.
          </Text>
        ) : null}
        <View style={styles.actions}>
          {!last ? (
            <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" accessibilityLabel="pular o passo a passo">
              <Text variant="smallStrong" color={colors.textSoft}>
                pular
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          {index > 0 ? <Button label="voltar" variant="ghost" small onPress={() => onGo(index - 1)} /> : null}
          <Button label={last ? 'concluir' : 'próximo'} small onPress={() => onGo(index + 1)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: { position: 'absolute' },
  ring: { position: 'absolute', borderRadius: radius.lg, borderWidth: 2, borderColor: colors.primary },
  card: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space.lg,
    gap: space.sm,
    ...shadow.float,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
});
