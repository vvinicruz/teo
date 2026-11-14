import { useEffect, useState } from 'react';
import { getCardRates, type RateTable } from '../lib/bcbRates';

/** taxas do banco central para cartão. `undefined` = carregando, `null` = indisponível. */
export function useCardRates(enabled = true): RateTable | null | undefined {
  const [table, setTable] = useState<RateTable | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getCardRates().then((t) => alive && setTable(t));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return table;
}
