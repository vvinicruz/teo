import type { SupabaseClient } from '@supabase/supabase-js';
import type { Settings, Snapshot } from '../domain/types';
import type { Collection, CollectionMap, Repository } from './repository';

const TABLES: Record<Collection, string> = {
  categories: 'categories',
  transactions: 'transactions',
  recurrences: 'recurrences',
  budgets: 'budgets',
  goals: 'goals',
  cards: 'cards',
  investments: 'investments',
};

const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

function toRow(obj: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[toSnake(k)] = v === undefined ? null : v;
  return out;
}

function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'user_id' || k === 'updated_at') continue;
    out[toCamel(k)] = v;
  }
  return out as T;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/**
 * dados na nuvem (supabase). cada linha tem o user_id do dono e as regras de
 * row level security garantem que ninguém leia ou altere dados de outra pessoa.
 */
export function createSupabaseRepository(sb: SupabaseClient, userId: string): Repository {
  const saveSettings = async (settings: Settings) => {
    check(await sb.from('profiles').upsert({ ...toRow(settings), user_id: userId }));
  };

  return {
    async load() {
      const profile = check(
        await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle(),
      ) as Record<string, unknown> | null;
      if (!profile) return null;
      const [categories, transactions, recurrences, budgets, goals, cards, investments] = await Promise.all(
        (Object.keys(TABLES) as Collection[]).map(async (c) =>
          (check(await sb.from(TABLES[c]).select('*')) as Record<string, unknown>[]).map((r) =>
            fromRow(r),
          ),
        ),
      );
      return {
        settings: fromRow<Settings>(profile),
        categories,
        transactions,
        recurrences,
        budgets,
        goals,
        cards,
        investments,
      } as Snapshot;
    },
    async init(snapshot) {
      await saveSettings(snapshot.settings);
      if (snapshot.categories.length) {
        check(
          await sb
            .from('categories')
            .upsert(snapshot.categories.map((c) => ({ ...toRow(c), user_id: userId }))),
        );
      }
    },
    saveSettings,
    async upsert<K extends Collection>(collection: K, item: CollectionMap[K]) {
      check(await sb.from(TABLES[collection]).upsert({ ...toRow(item), user_id: userId }));
    },
    async upsertMany<K extends Collection>(collection: K, items: CollectionMap[K][]) {
      if (!items.length) return;
      check(await sb.from(TABLES[collection]).upsert(items.map((x) => ({ ...toRow(x), user_id: userId }))));
    },
    async remove(collection, id) {
      check(await sb.from(TABLES[collection]).delete().eq('id', id));
    },
    async wipe() {
      // ordem importa por causa das chaves estrangeiras.
      for (const t of ['transactions', 'budgets', 'recurrences', 'goals', 'categories', 'cards', 'investments', 'profiles']) {
        check(await sb.from(t).delete().eq('user_id', userId));
      }
    },
  };
}
