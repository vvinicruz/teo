import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Snapshot } from '../domain/types';
import type { Collection, CollectionMap, Repository } from './repository';

const KEY = 'teo:snapshot:v1';

/** guarda tudo neste aparelho. usado quando a nuvem não está configurada. */
export function createLocalRepository(): Repository {
  let cache: Snapshot | null = null;
  // as gravações são enfileiradas para nunca sobrescrever uma mais nova com uma mais antiga.
  let queue: Promise<void> = Promise.resolve();

  const persist = () => {
    const data = JSON.stringify(cache);
    queue = queue.then(() => AsyncStorage.setItem(KEY, data));
    return queue;
  };

  return {
    async load() {
      const raw = await AsyncStorage.getItem(KEY);
      // dados salvos por versões antigas do app podem não ter coleções novas.
      const parsed = raw ? (JSON.parse(raw) as Partial<Snapshot>) : null;
      cache = parsed
        ? ({ ...parsed, cards: parsed.cards ?? [], investments: parsed.investments ?? [] } as Snapshot)
        : null;
      return cache;
    },
    async init(snapshot) {
      cache = snapshot;
      await persist();
    },
    async saveSettings(settings) {
      if (!cache) throw new Error('dados não carregados');
      cache = { ...cache, settings };
      await persist();
    },
    async upsert<K extends Collection>(collection: K, item: CollectionMap[K]) {
      if (!cache) throw new Error('dados não carregados');
      const list = cache[collection] as unknown as { id: string }[];
      const exists = list.some((x) => x.id === item.id);
      const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
      cache = { ...cache, [collection]: next };
      await persist();
    },
    async upsertMany<K extends Collection>(collection: K, items: CollectionMap[K][]) {
      if (!cache) throw new Error('dados não carregados');
      const byId = new Map((cache[collection] as unknown as { id: string }[]).map((x) => [x.id, x]));
      for (const item of items) byId.set(item.id, item);
      cache = { ...cache, [collection]: [...byId.values()] };
      await persist();
    },
    async remove(collection, id) {
      if (!cache) throw new Error('dados não carregados');
      const list = cache[collection] as unknown as { id: string }[];
      cache = { ...cache, [collection]: list.filter((x) => x.id !== id) };
      await persist();
    },
    async wipe() {
      cache = null;
      await AsyncStorage.removeItem(KEY);
    },
  };
}
