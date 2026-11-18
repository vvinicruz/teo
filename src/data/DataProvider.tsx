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
import { addDays, addMonths, monthOf, parseISODate, today } from '../domain/dates';
import { occurrenceDate, occurrenceIndex, recurrenceOccurrences } from '../domain/finance';
import { MAIN_ACCOUNT_NAME } from '../domain/types';
import { emptySnapshot } from '../domain/defaults';
import type { Entry } from '../domain/finance';
import { fitDescription, type ImportRow } from '../domain/importer';
import type {
  Account,
  Budget,
  Card,
  Category,
  Goal,
  Investment,
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
export type NewCard = Omit<Card, 'id' | 'createdAt'>;
export type NewAccount = Omit<Account, 'id' | 'createdAt'>;
export type NewInvestment = Omit<Investment, 'id' | 'createdAt' | 'balanceUpdatedAt'>;

interface DataValue {
  status: DataStatus;
  error: string | null;
  data: Snapshot;
  retry(): void;

  updateSettings(patch: Partial<Settings>): Promise<void>;

  addTransaction(t: NewTransaction): Promise<Transaction>;
  updateTransaction(t: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  /**
   * apaga um lançamento que faz parte de uma conta fixa ou compra parcelada.
   * só-esta: só este mês; proximas: este e os seguintes (a recorrência termina antes);
   * anteriores: este e os anteriores; todas: tudo, inclusive a recorrência.
   */
  deleteInstallments(txId: string, mode: 'so-esta' | 'proximas' | 'anteriores' | 'todas'): Promise<void>;
  /** marca uma previsão (pendente ou ocorrência de recorrência) como realizada. */
  confirmEntry(entry: Entry, opts?: { amount?: number; date?: string }): Promise<void>;
  /** registra o pagamento de uma fatura (sai da conta e substitui a previsão). */
  payInvoice(card: Card, invoiceDate: string, opts?: { amount?: number; date?: string }): Promise<void>;
  /** grava as linhas confirmadas de um extrato importado. devolve quantas foram salvas. */
  importRows(rows: ImportRow[], dest: { cardId: string | null; accountId: string | null }): Promise<number>;

  addAccount(a: NewAccount): Promise<Account>;
  updateAccount(a: Account): Promise<void>;
  /** apaga a conta; se já tiver movimentações, ela é arquivada. */
  deleteAccount(id: string): Promise<'removida' | 'arquivada'>;
  /** transferência entre contas (null = conta principal). não é gasto nem receita. */
  transfer(from: string | null, to: string | null, amount: number, date: string): Promise<void>;

  addInvestment(i: NewInvestment): Promise<Investment>;
  updateInvestment(i: Investment): Promise<void>;
  /** apaga a caixinha; se já tiver movimentações, ela é arquivada. */
  deleteInvestment(id: string): Promise<'removida' | 'arquivada'>;
  /** guardar (tira da conta) ou resgatar (volta para a conta). */
  moveInvestment(inv: Investment, kind: 'guardar' | 'resgatar', amount: number, date?: string): Promise<void>;
  /** acerta o valor da caixinha com o que aparece no banco (o rendimento entra aqui). */
  setInvestmentBalance(inv: Investment, balance: number): Promise<void>;

  addCard(c: NewCard): Promise<Card>;
  updateCard(c: Card): Promise<void>;
  /** apaga o cartão; se já tiver compras, ele é arquivado para não perder histórico. */
  deleteCard(id: string): Promise<'removido' | 'arquivado'>;

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

  const payInvoice = useCallback(
    async (card: Card, invoiceDate: string, opts: { amount?: number; date?: string } = {}) => {
        const existing = dataRef.current.transactions.find(
          (t) => t.paysCardId === card.id && t.invoiceDate === invoiceDate,
        );
        if (existing) return;
        await upsert('transactions', {
          id: newId(),
          kind: 'despesa',
          amount: opts.amount ?? 0,
          description: `fatura ${card.name}`,
          categoryId: null,
          date: opts.date ?? (invoiceDate <= today() ? invoiceDate : today()),
          status: 'realizada',
          paymentMethod: null,
          paysCardId: card.id,
          invoiceDate,
          createdAt: nowIso(),
        });
      },
    [upsert],
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
        const item: Transaction = { ...t, description: fitDescription(t.description), id: newId(), createdAt: nowIso() };
        await upsert('transactions', item);
        return item;
      },
      updateTransaction: (t) => upsert('transactions', { ...t, description: fitDescription(t.description) }),
      async deleteTransaction(id) {
        // transferência: apaga os dois lados juntos.
        const t = dataRef.current.transactions.find((x) => x.id === id);
        if (t?.transferId) {
          const ids = dataRef.current.transactions.filter((x) => x.transferId === t.transferId).map((x) => x.id);
          for (const other of ids) await remove('transactions', other);
          return;
        }
        await remove('transactions', id);
      },

      async confirmEntry(entry, opts = {}) {
        const date = opts.date ?? (entry.originalDate <= today() ? entry.originalDate : today());
        const amount = opts.amount ?? entry.amount;
        if (entry.invoiceDate && entry.cardId) {
          const card = dataRef.current.cards.find((c) => c.id === entry.cardId);
          if (card) await payInvoice(card, entry.invoiceDate, { amount, date });
          return;
        }
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
            cardId: rec?.cardId ?? null,
            investmentId: rec?.investmentId ?? null,
            createdAt: nowIso(),
          });
        }
      },

      payInvoice,

      async importRows(rows, dest) {
        const { cardId, accountId } = dest;
        const now = nowIso();
        const items: Transaction[] = [];
        const recurrences: Recurrence[] = [];
        for (const row of rows) {
          // importada antes com a data errada: só corrige a data (e a fatura em que entrou).
          if (row.suggestion?.type === 'ja-importada' && row.suggestion.fix) {
            items.push({ ...row.suggestion.fix, date: row.date, invoiceDate: row.invoiceDate });
            continue;
          }
          // "é a mesma": o registro passa a ficar onde o extrato diz (cartão ou conta).
          if (row.decision === 'pular' && row.suggestion?.type === 'parecida') {
            const original = row.suggestion.transaction;
            let t = original;
            // o teo reconheceu sozinho (centavos de diferença): vale o valor do banco.
            if (row.autoMatched && t.amount !== row.amount) t = { ...t, amount: row.amount };
            if (cardId) {
              if (t.cardId !== cardId || row.invoiceDate) {
                t = { ...t, cardId, accountId: null, status: 'realizada', paymentMethod: 'credito', invoiceDate: row.invoiceDate ?? t.invoiceDate ?? null };
              }
            } else if ((t.accountId ?? null) !== accountId) {
              t = { ...t, accountId };
            }
            if (t !== original) items.push(t);
            continue;
          }
          const sug = row.suggestion;
          const fromStatement = {
            amount: row.amount,
            date: row.date,
            externalId: row.line.externalId,
            ...(row.note.trim() ? { note: row.note.trim().slice(0, 500) } : {}),
          };
          if (row.decision === 'importar') {
            const tx: Transaction = {
              id: newId(),
              kind: row.kind,
              description: fitDescription(row.description),
              categoryId: row.categoryId,
              status: 'realizada',
              paymentMethod: cardId ? 'credito' : (row.line.method ?? null),
              cardId,
              accountId: cardId ? null : accountId,
              ...(cardId && row.invoiceDate ? { invoiceDate: row.invoiceDate } : {}),
              createdAt: now,
              ...fromStatement,
            };
            const inst = row.installment;
            if (inst && row.installmentChoice !== 'so-esta') {
              // compra parcelada: vira uma recorrência com o número de parcelas, e esta linha é a parcela n.
              const thisMonth = monthOf(row.date);
              const rec: Recurrence = {
                id: newId(),
                kind: row.kind,
                amount: row.amount,
                description: fitDescription(inst.base || row.description),
                categoryId: row.categoryId,
                paymentMethod: tx.paymentMethod,
                dayOfMonth: parseISODate(row.date).day,
                startMonth: addMonths(thisMonth, -(inst.n - 1)),
                occurrences: inst.total,
                skippedDates: [],
                cardId,
                accountId: cardId ? null : accountId,
                createdAt: now,
              };
              const previous = recurrenceOccurrences(rec, `${rec.startMonth}-01`, addDays(`${thisMonth}-01`, -1));
              if (row.installmentChoice === 'todas') {
                // as anteriores entram no histórico como já pagas.
                for (const occ of previous) {
                  items.push({
                    ...tx,
                    id: newId(),
                    date: occ.date,
                    description: fitDescription(`${rec.description} ${occ.index}/${inst.total}`),
                    externalId: null,
                    note: null,
                    recurrenceId: rec.id,
                    occurrenceDate: occ.date,
                  });
                }
              } else {
                // só as próximas: as anteriores não aparecem como previstas.
                rec.skippedDates = previous.map((o) => o.date);
              }
              recurrences.push(rec);
              items.push({ ...tx, recurrenceId: rec.id, occurrenceDate: occurrenceDate(rec, thisMonth) });
            } else {
              items.push(tx);
            }
          } else if (row.decision === 'vincular' && sug?.type === 'previsao') {
            const e = sug.entry;
            const existing = e.transactionId
              ? dataRef.current.transactions.find((t) => t.id === e.transactionId)
              : undefined;
            if (existing) {
              items.push({ ...existing, status: 'realizada', ...(cardId ? {} : { accountId }), ...fromStatement });
            } else if (e.recurrenceId) {
              const rec = dataRef.current.recurrences.find((r) => r.id === e.recurrenceId);
              items.push({
                id: newId(),
                kind: e.kind,
                description: e.description,
                categoryId: row.categoryId ?? e.categoryId,
                status: 'realizada',
                paymentMethod: rec?.paymentMethod ?? (cardId ? 'credito' : null),
                recurrenceId: e.recurrenceId,
                occurrenceDate: e.originalDate,
                cardId,
                accountId: cardId ? null : accountId,
                createdAt: now,
                ...fromStatement,
              });
            }
          } else if (row.decision === 'vincular' && sug?.type === 'fatura') {
            items.push({
              id: newId(),
              kind: 'despesa',
              description: `fatura ${sug.card.name}`,
              categoryId: null,
              status: 'realizada',
              paymentMethod: null,
              paysCardId: sug.card.id,
              invoiceDate: sug.invoiceDate,
              accountId,
              createdAt: now,
              ...fromStatement,
            });
          }
        }
        if (!items.length) return 0;
        await commit(
          (s) => {
            const byId = new Map(s.transactions.map((t) => [t.id, t]));
            for (const t of items) byId.set(t.id, t);
            return { ...s, recurrences: [...s.recurrences, ...recurrences], transactions: [...byId.values()] };
          },
          async (r) => {
            // as recorrências primeiro: os lançamentos apontam para elas.
            if (recurrences.length) await r.upsertMany('recurrences', recurrences);
            await r.upsertMany('transactions', items);
          },
        );
        return items.length;
      },

      async addAccount(a) {
        const item: Account = { ...a, id: newId(), createdAt: nowIso() };
        await upsert('accounts', item);
        return item;
      },
      updateAccount: (a) => upsert('accounts', a),
      async deleteAccount(id) {
        const s = dataRef.current;
        const inUse = s.transactions.some((t) => t.accountId === id) || s.recurrences.some((r) => r.accountId === id);
        if (inUse) {
          const acc = s.accounts.find((x) => x.id === id);
          if (acc) await upsert('accounts', { ...acc, archived: true });
          return 'arquivada';
        }
        await remove('accounts', id);
        return 'removida';
      },
      async transfer(from, to, amount, date) {
        const s = dataRef.current;
        const name = (id: string | null) => (id ? (s.accounts.find((a) => a.id === id)?.name ?? 'conta') : MAIN_ACCOUNT_NAME);
        const transferId = newId();
        const now = nowIso();
        const base = { amount, categoryId: null, date, status: 'realizada' as const, paymentMethod: 'transferencia' as const, transferId, createdAt: now };
        const items: Transaction[] = [
          { ...base, id: newId(), kind: 'despesa', description: `transferência para ${name(to)}`, accountId: from },
          { ...base, id: newId(), kind: 'receita', description: `transferência de ${name(from)}`, accountId: to },
        ];
        await commit(
          (st) => ({ ...st, transactions: [...st.transactions, ...items] }),
          (r) => r.upsertMany('transactions', items),
        );
      },

      async addInvestment(i) {
        const now = nowIso();
        const item: Investment = { ...i, id: newId(), balanceUpdatedAt: now, createdAt: now };
        await upsert('investments', item);
        return item;
      },
      updateInvestment: (i) => upsert('investments', i),
      async deleteInvestment(id) {
        const s = dataRef.current;
        const inUse = s.transactions.some((t) => t.investmentId === id) || s.goals.some((g) => g.investmentId === id);
        if (inUse) {
          const inv = s.investments.find((x) => x.id === id);
          if (inv) await upsert('investments', { ...inv, archived: true });
          return 'arquivada';
        }
        await remove('investments', id);
        return 'removida';
      },
      async moveInvestment(inv, kind, amount, date) {
        await upsert('transactions', {
          id: newId(),
          kind: kind === 'guardar' ? 'despesa' : 'receita',
          amount,
          description: kind === 'guardar' ? `guardado em ${inv.name}` : `resgatado de ${inv.name}`,
          categoryId: null,
          date: date ?? today(),
          status: 'realizada',
          paymentMethod: null,
          investmentId: inv.id,
          createdAt: nowIso(),
        });
      },
      async setInvestmentBalance(inv, balance) {
        await upsert('investments', { ...inv, balance, balanceUpdatedAt: nowIso() });
      },

      async addCard(c) {
        const item: Card = { ...c, id: newId(), createdAt: nowIso() };
        await upsert('cards', item);
        return item;
      },
      updateCard: (c) => upsert('cards', c),
      async deleteCard(id) {
        const s = dataRef.current;
        const inUse =
          s.transactions.some((t) => t.cardId === id || t.paysCardId === id) ||
          s.recurrences.some((r) => r.cardId === id);
        if (inUse) {
          const card = s.cards.find((c) => c.id === id);
          if (card) await upsert('cards', { ...card, archived: true });
          return 'arquivado';
        }
        await remove('cards', id);
        return 'removido';
      },

      async deleteInstallments(txId, mode) {
        const s = dataRef.current;
        const tx = s.transactions.find((t) => t.id === txId);
        const rec = tx?.recurrenceId ? s.recurrences.find((r) => r.id === tx.recurrenceId) : undefined;
        if (!tx || !rec) {
          await remove('transactions', txId);
          return;
        }
        const pivot = tx.occurrenceDate ?? tx.date;
        const linked = s.transactions.filter((t) => t.recurrenceId === rec.id);
        const occ = (t: Transaction) => t.occurrenceDate ?? t.date;
        const toDelete =
          mode === 'so-esta'
            ? [tx]
            : mode === 'proximas'
              ? linked.filter((t) => occ(t) >= pivot)
              : mode === 'anteriores'
                ? linked.filter((t) => occ(t) <= pivot)
                : linked;
        for (const t of toDelete) await remove('transactions', t.id);

        if (mode === 'todas') {
          await remove('recurrences', rec.id);
          return;
        }
        if (mode === 'proximas') {
          // termina a recorrência no mês anterior a este.
          const index = occurrenceIndex(rec, monthOf(pivot));
          if (index <= 1) await remove('recurrences', rec.id);
          else await upsert('recurrences', { ...rec, occurrences: index - 1 });
          return;
        }
        // só esta / anteriores: as datas apagadas não voltam como previsão.
        const dates =
          mode === 'so-esta'
            ? [pivot]
            : recurrenceOccurrences(rec, `${rec.startMonth}-01`, pivot).map((o) => o.date);
        await upsert('recurrences', { ...rec, skippedDates: [...new Set([...rec.skippedDates, ...dates])] });
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
    [status, error, data, commit, upsert, remove, repo, payInvoice],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData fora do DataProvider');
  return ctx;
}
