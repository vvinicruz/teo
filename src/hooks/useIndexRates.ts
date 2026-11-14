import { useEffect, useState } from 'react';
import { getIndexRates, type IndexRates } from '../lib/bcbIndexes';

/** cdi e selic. `undefined` = carregando, `null` = indisponível. */
export function useIndexRates(enabled = true): IndexRates | null | undefined {
  const [rates, setRates] = useState<IndexRates | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getIndexRates().then((r) => alive && setRates(r));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return rates;
}
