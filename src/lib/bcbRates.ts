import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * taxas médias de juros do cartão por banco, publicadas pelo banco central
 * (dados abertos, atualizados toda semana). são médias: a taxa de cada cliente pode
 * ser diferente, por isso o teo sempre fala em "estimativa".
 */
const BASE =
  'https://olinda.bcb.gov.br/olinda/servico/taxaJuros/versao/v2/odata/TaxasJurosDiariaPorInicioPeriodo';
const MODALITIES = {
  rotativo: 'Cartão de crédito - rotativo total - Prefixado',
} as const;
type Modality = keyof typeof MODALITIES;

export interface BankRate {
  code: string;
  name: string;
  monthly: number;
}

export interface RateTable {
  periodStart: string;
  periodEnd: string;
  rotativo: BankRate[];
  fetchedAt: number;
}

const CACHE_KEY = 'teo:bcb-taxas-cartao:v2';
const ONE_DAY = 24 * 60 * 60 * 1000;
let memory: RateTable | null = null;
let inflight: Promise<RateTable | null> | null = null;

async function getJson(params: Record<string, string>): Promise<{ value: Record<string, unknown>[] }> {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}?${query}&%24format=json`, { signal: controller.signal });
    if (!res.ok) throw new Error(`bcb ${res.status}`);
    return (await res.json()) as { value: Record<string, unknown>[] };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTable(): Promise<RateTable> {
  const latest = await getJson({
    $filter: `Modalidade eq '${MODALITIES.rotativo}'`,
    $orderby: 'InicioPeriodo desc',
    $top: '1',
    $select: 'InicioPeriodo,FimPeriodo',
  });
  const periodStart = String(latest.value[0]?.InicioPeriodo ?? '');
  const periodEnd = String(latest.value[0]?.FimPeriodo ?? '');
  if (!periodStart) throw new Error('sem dados');
  const load = async (m: Modality): Promise<BankRate[]> => {
    const r = await getJson({
      $filter: `Modalidade eq '${MODALITIES[m]}' and InicioPeriodo eq '${periodStart}'`,
      $select: 'InstituicaoFinanceira,TaxaJurosAoMes,cnpj8',
    });
    return r.value.map((x) => ({
      code: String(x.cnpj8),
      name: String(x.InstituicaoFinanceira).toLowerCase(),
      monthly: Number(x.TaxaJurosAoMes),
    }));
  };
  const rotativo = await load('rotativo');
  return { periodStart, periodEnd, rotativo, fetchedAt: Date.now() };
}

/** tabela de taxas (do cache de até 1 dia, ou buscada agora). null se não der para buscar. */
export async function getCardRates(): Promise<RateTable | null> {
  if (memory && Date.now() - memory.fetchedAt < ONE_DAY) return memory;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const t = JSON.parse(cached) as RateTable;
        if (Date.now() - t.fetchedAt < ONE_DAY) return (memory = t);
      }
      const fresh = await fetchTable();
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
      return (memory = fresh);
    } catch {
      // sem internet ou serviço fora do ar: usamos o último valor guardado, se houver.
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      return cached ? (memory = JSON.parse(cached) as RateTable) : null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export interface RateLookup {
  monthly: number;
  /** true quando o banco não aparece na lista e usamos a média do mercado. */
  isMarketAverage: boolean;
}

/** taxa do banco, ou a média de todos os bancos se ele não estiver na lista. */
export function rateFor(table: RateTable, code: string | null | undefined, modality: Modality): RateLookup | null {
  const list = table[modality];
  if (!list.length) return null;
  const bank = code ? list.find((r) => r.code === code) : undefined;
  if (bank) return { monthly: bank.monthly, isMarketAverage: false };
  const avg = list.reduce((a, r) => a + r.monthly, 0) / list.length;
  return { monthly: Math.round(avg * 100) / 100, isMarketAverage: true };
}

/** "out/2026" a partir de "2026-10-23". */
export function periodLabel(table: RateTable): string {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [y, m] = table.periodStart.split('-');
  return `${months[Number(m) - 1]}/${y}`;
}
