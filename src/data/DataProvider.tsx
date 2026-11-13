import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { today } from '../domain/dates';
import { emptySnapshot } from '../domain/defaults';
import type { Entry } from '../domain/finance';
import type {
  Budget,
  Category,
  Goal,
  Recurrence,
  Settings,
  Snapshot,
  Transaction,
} from '../domain/types';
import { isCloudConfigured } from '../lib/config';
import { newId } from '../lib/id';
import { getSupabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { createLocalRepository } from './localRepository';
import type { Collection, CollectionMap, Repository } from './repository';
import { createSupabaseRepository } from './supabaseRepository';

type DataStatus = 'loading' | 'ready' | 'error';

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt'>;
export type NewRecurrence = Omit<Recurrence, 'id' | 'createdAt' | 'skippedDates'>;
export type NewGoal = Omit<Goal, 'id' | 'createdAt'>;

interface DataValue {
  status: DataStatus;
  error: string | null;
  data: Snapshot;
  retry(): void;

  updateSettings(patch: Partial<Settings>): Promise<void>;

  addTransaction(t: NewTransaction): Promise<Transaction>;
  updateTransaction(t: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  /** marca uma previsão (pendente ou ocorrência de recorrência) como realizada. */
  confirmEntry(entry: Entry, opts?: { amount?: number; date?: string }): Promise<void>;

  addRecurrence(r: NewRecurrence): Promise<Recurrence>;
  updateRecurrence(r: Recurrence): Promise<void>;
  deleteRecurrence(id: string): Promise<void>;
  /** remove só uma ocorrência prevista ("este mês não vai ter"). */
  skipOccurrence(recurrenceId: string, date: string): Promise<void>;

  setBudget(categoryId: string, amount: number): Promise<void>;

  addGoal(g: NewGoal): Promise<Goal>;
  updateGoal(g: Goal): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  addCategory(c: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(c: Category): Promise<void>;
  /** apaga a categoria; se já estiver em uso, ela é arquivada para não perder histórico. */
  deleteCategory(id: string): Promise<'removida' | 'arquivada'>;

  wipeAll(): Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);

const nowIso = () => new Date().toISOString();

export function DataProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [data, setData] = useState<Snapshot>(() => emptySnapshot(newId));
  const [attempt, setAttempt] = useState(0);
  // resultado do último carregamento, ligado ao usuário e à tentativa que o gerou.
  const [loaded, setLoaded] = useState<{ key: string; error: string | null } | null>(null);
  const loadKey = `${userId}:${attempt}`;
  const status: DataStatus = loaded?.key !== loadKey ? 'loading' : loaded.error ? 'error' : 'ready';
  const error = loaded?.key === loadKey ? loaded.error : null;
  // cópia sempre atual dos dados, usada pelas ações (que podem rodar em sequência).
  const dataRef = useRef(data);

  const repo = useMemo<Repository | null>(() => {
    if (!userId) return null;
    return isCloudConfigured
      ? createSupabaseRepository(getSupabase(), userId)
      : createLocalRepository();
  }, [userId]);

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    const key = `${userId}:${attempt}`;
    (async () => {
      try {
        let snap = await repo.load();
        if (!snap) {
          snap = emptySnapshot(newId);
          await repo.init(snap);
        }
        if (!alive) return;
        dataRef.current = snap;
        setData(snap);
        setLoaded({ key, error: null });
      } catch (e) {
        if (!alive) return;
        setLoaded({ key, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo, attempt, userId]);

  /**
   * atualização otimista: a tela muda na hora e a gravação acontece em seguida.
   * se a gravação falhar, o estado anterior volta e o erro sobe para quem chamou.
   */
  const commit = useCallback(
    async (next: (s: Snapshot) => Snapshot, persist: (r: Repository) => Promise<void>) => {
      if (!repo) throw new Error('sem sessão');
      const previous = dataRef.current;
      const updated = next(previous);
      dataRef.current = updated;
      setData(updated);
      try {
        await persist(repo);
      } catch (e) {
        dataRef.current = previous;
        setData(previous);
        throw e;
      }
    },
    [repo],
  );

  const upsert = useCallback(
    <K extends Collection>(collection: K, item: CollectionMap[K]) =>
      commit(
        (s) => {
          const list = s[collection] as unknown as { id: string }[];
          const exists = list.some((x) => x.id === item.id);
          return {
            ...s,
            [collection]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item],
          };
        },
        (r) => r.upsert(collection, item),
      ),
    [commit],
  );

  const remove = useCallback(
    (collection: Collection, id: string) =>
      commit(
        (s) => ({
          ...s,
          [collection]: (s[collection] as unknown as { id: string }[]).filter((x) => x.id !== id),
        }),
        (r) => r.remove(collection, id),
      ),
    [commit],
  );

  const value = useMemo<DataValue>(
    () => ({
      status,
      error,
      data,
      retry: () => setAttempt((a) => a + 1),

      async updateSettings(patch) {
        const settings = { ...dataRef.current.settings, ...patch };
        await commit((s) => ({ ...s, settings }), (r) => r.saveSettings(settings));
      },

      async addTransaction(t) {
        const item: Transaction = { ...t, id: newId(), createdAt: nowIso() };
        await upsert('transactions', item);
        return item;
      },
      updateTransaction: (t) => upsert('transactions', t),
      deleteTransaction: (id) => remove('transactions', id),

      async confirmEntry(entry, opts = {}) {
        const date = opts.date ?? (entry.originalDate <= today() ? entry.originalDate : today());
        const amount = opts.amount ?? entry.amount;
        if (entry.transactionId) {
          const t = dataRef.current.transactions.find((x) => x.id === entry.transactionId);
          if (!t) return;
          await upsert('transactions', { ...t, status: 'realizada', date, amount });
          return;
        }
        if (entry.recurrenceId) {
          const rec = dataRef.current.recurrences.find((x) => x.id === entry.recurrenceId);
          await upsert('transactions', {
            id: newId(),
            kind: entry.kind,
            amount,
            description: entry.description,
            categoryId: entry.categoryId,
            date,
            status: 'realizada',
            paymentMethod: rec?.paymentMethod ?? null,
            recurrenceId: entry.recurrenceId,
            occurrenceDate: entry.originalDate,
            createdAt: nowIso(),
          });
        }
      },

      async addRecurrence(r) {
        const item: Recurrence = { ...r, id: newId(), skippedDates: [], createdAt: nowIso() };
        await upsert('recurrences', item);
        return item;
      },
      updateRecurrence: (r) => upsert('recurrences', r),
      deleteRecurrence: (id) => remove('recurrences', id),
      async skipOccurrence(recurrenceId, date) {
        const rec = dataRef.current.recurrences.find((x) => x.id === recurrenceId);
        if (!rec || rec.skippedDates.includes(date)) return;
        await upsert('recurrences', { ...rec, skippedDates: [...rec.skippedDates, date] });
      },

      async setBudget(categoryId, amount) {
        const existing = dataRef.current.budgets.find((b) => b.categoryId === categoryId);
        if (amount <= 0) {
          if (existing) await remove('budgets', existing.id);
          return;
        }
        const item: Budget = { id: existing?.id ?? newId(), categoryId, amount };
        await upsert('budgets', item);
      },

      async addGoal(g) {
        const item: Goal = { ...g, id: newId(), createdAt: nowIso() };
        await upsert('goals', item);
        return item;
      },
      updateGoal: (g) => upsert('goals', g),
      deleteGoal: (id) => remove('goals', id),

      async addCategory(c) {
        const item: Category = { ...c, id: newId() };
        await upsert('categories', item);
        return item;
      },
      updateCategory: (c) => upsert('categories', c),
      async deleteCategory(id) {
        const s = dataRef.current;
        const inUse =
          s.transactions.some((t) => t.categoryId === id) ||
          s.recurrences.some((r) => r.categoryId === id);
        const budget = s.budgets.find((b) => b.categoryId === id);
        if (budget) await remove('budgets', budget.id);
        if (inUse) {
          const cat = s.categories.find((c) => c.id === id);
          if (cat) await upsert('categories', { ...cat, archived: true });
          return 'arquivada';
        }
        await remove('categories', id);
        return 'removida';
      },

      async wipeAll() {
        if (!repo) return;
        await repo.wipe();
        const fresh = emptySnapshot(newId);
        await repo.init(fresh);
        dataRef.current = fresh;
        setData(fresh);
      },
    }),
    [status, error, data, commit, upsert, remove, repo],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData fora do DataProvider');
  return ctx;
}
