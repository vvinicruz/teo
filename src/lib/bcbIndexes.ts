import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MarketRates } from '../domain/investments';

/**
 * cdi e selic atuais, do sistema de séries do banco central (dados abertos).
 * 4389 = cdi anualizado (base 252); 432 = meta da selic.
 */
const SERIES = { cdi: 4389, selic: 432 } as const;
const CACHE_KEY = 'teo:bcb-indices:v1';
const ONE_DAY = 24 * 60 * 60 * 1000;

export interface IndexRates extends MarketRates {
  /** data do último cdi publicado (dd/mm/aaaa). */
  date: string;
  fetchedAt: number;
}

let memory: IndexRates | null = null;
let inflight: Promise<IndexRates | null> | null = null;

async function latest(serie: number): Promise<{ data: string; valor: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/1?formato=json`, {
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`bcb ${res.status}`);
    const json = (await res.json()) as { data: string; valor: string }[];
    if (!json[0]) throw new Error('sem dados');
    return json[0];
  } finally {
    clearTimeout(timer);
  }
}

/** cdi e selic (do cache de até 1 dia, ou buscados agora). null se não der para buscar. */
export async function getIndexRates(): Promise<IndexRates | null> {
  if (memory && Date.now() - memory.fetchedAt < ONE_DAY) return memory;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const t = JSON.parse(cached) as IndexRates;
        if (Date.now() - t.fetchedAt < ONE_DAY) return (memory = t);
      }
      const [cdi, selic] = await Promise.all([latest(SERIES.cdi), latest(SERIES.selic)]);
      const fresh: IndexRates = {
        cdiAnnual: Number(cdi.valor),
        selicAnnual: Number(selic.valor),
        date: cdi.data,
        fetchedAt: Date.now(),
      };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
      return (memory = fresh);
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      return cached ? (memory = JSON.parse(cached) as IndexRates) : null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
