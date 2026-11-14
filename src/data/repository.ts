import type { Budget, Card, Category, Goal, Recurrence, Settings, Snapshot, Transaction } from '../domain/types';

export interface CollectionMap {
  categories: Category;
  transactions: Transaction;
  recurrences: Recurrence;
  budgets: Budget;
  goals: Goal;
  cards: Card;
}
export type Collection = keyof CollectionMap;

/**
 * contrato de persistência. a interface é a mesma para o modo local e para a nuvem,
 * então as telas e a lógica não sabem (nem precisam saber) onde os dados ficam.
 */
export interface Repository {
  /** carrega tudo do usuário. null quando ainda não existe nada salvo. */
  load(): Promise<Snapshot | null>;
  /** grava um snapshot inteiro (usado na criação inicial). */
  init(snapshot: Snapshot): Promise<void>;
  saveSettings(settings: Settings): Promise<void>;
  upsert<K extends Collection>(collection: K, item: CollectionMap[K]): Promise<void>;
  /** grava vários itens de uma vez (ex.: importação de extrato). */
  upsertMany<K extends Collection>(collection: K, items: CollectionMap[K][]): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  /** apaga todos os dados do usuário. */
  wipe(): Promise<void>;
}
