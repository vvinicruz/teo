import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { EMPTY_ANSWERS, type IrpfAnswers, type Situation } from '../domain/irpf';

/**
 * respostas do "preciso declarar?", situações, itens já separados e avisos dispensados.
 * ficam guardados neste aparelho (não vão para a nuvem).
 */
interface IrpfState {
  answers: Record<number, IrpfAnswers>; // por ano de entrega
  situations: Situation[];
  checked: Record<number, string[]>; // por ano de entrega
  dismissed: string[]; // chaves de fase dispensadas
}

const KEY = 'teo:imposto-de-renda:v1';
const EMPTY: IrpfState = { answers: {}, situations: [], checked: {}, dismissed: [] };

let cache: IrpfState | null = null;
const listeners = new Set<(s: IrpfState) => void>();

function publish(next: IrpfState) {
  cache = next;
  listeners.forEach((l) => l(next));
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export function useIrpf() {
  const [state, setState] = useState<IrpfState>(cache ?? EMPTY);
  const [loaded, setLoaded] = useState(cache !== null);

  useEffect(() => {
    listeners.add(setState);
    if (!cache) {
      AsyncStorage.getItem(KEY)
        .then((raw) => {
          cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as IrpfState) } : EMPTY;
          setState(cache);
        })
        .catch(() => {})
        .finally(() => setLoaded(true));
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  const update = useCallback((fn: (s: IrpfState) => IrpfState) => publish(fn(cache ?? EMPTY)), []);

  return {
    loaded,
    answersFor: (year: number) => state.answers[year] ?? null,
    saveAnswers: (year: number, a: IrpfAnswers) => update((s) => ({ ...s, answers: { ...s.answers, [year]: a } })),
    situations: state.situations,
    toggleSituation: (id: Situation) =>
      update((s) => ({
        ...s,
        situations: s.situations.includes(id) ? s.situations.filter((x) => x !== id) : [...s.situations, id],
      })),
    checkedFor: (year: number) => new Set(state.checked[year] ?? []),
    toggleChecked: (year: number, id: string) =>
      update((s) => {
        const list = s.checked[year] ?? [];
        return { ...s, checked: { ...s.checked, [year]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } };
      }),
    isDismissed: (key: string) => state.dismissed.includes(key),
    dismiss: (key: string) => update((s) => ({ ...s, dismissed: [...s.dismissed, key] })),
    emptyAnswers: EMPTY_ANSWERS,
  };
}
