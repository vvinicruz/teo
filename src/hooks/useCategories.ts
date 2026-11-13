import { useMemo } from 'react';
import { useData } from '../data/DataProvider';
import type { Category, Kind } from '../domain/types';

export function useCategories() {
  const { data } = useData();
  return useMemo(() => {
    const byId = new Map<string, Category>(data.categories.map((c) => [c.id, c]));
    const active = data.categories.filter((c) => !c.archived);
    const forKind = (kind: Kind) => active.filter((c) => c.kind === kind || c.kind === 'ambos');
    return { byId, active, forKind, get: (id?: string | null) => (id ? byId.get(id) : undefined) };
  }, [data.categories]);
}
