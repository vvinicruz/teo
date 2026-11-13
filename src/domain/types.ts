import type { Cents } from './money';
import type { ISODate, MonthKey } from './dates';

export type Kind = 'receita' | 'despesa';

/** realizada = o dinheiro já entrou/saiu. pendente = compromisso futuro ou conta a pagar. */
export type Status = 'realizada' | 'pendente';

export type PaymentMethod =
  | 'pix'
  | 'debito'
  | 'credito'
  | 'dinheiro'
  | 'boleto'
  | 'transferencia';

export const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'pix', label: 'pix' },
  { id: 'debito', label: 'débito' },
  { id: 'credito', label: 'crédito' },
  { id: 'dinheiro', label: 'dinheiro' },
  { id: 'boleto', label: 'boleto' },
  { id: 'transferencia', label: 'transferência' },
];

export interface Category {
  id: string;
  name: string;
  /** chave do ícone (ver components/CategoryIcon). */
  icon: string;
  /** receita, despesa ou ambos. */
  kind: Kind | 'ambos';
  archived?: boolean;
}

export interface Transaction {
  id: string;
  kind: Kind;
  amount: Cents; // sempre positivo
  description: string;
  categoryId: string | null;
  date: ISODate;
  status: Status;
  paymentMethod: PaymentMethod | null;
  /**
   * quando o lançamento corresponde a uma ocorrência de uma recorrência,
   * guardamos a recorrência e a data prevista. assim a previsão é substituída
   * e nunca contada duas vezes.
   */
  recurrenceId?: string | null;
  occurrenceDate?: ISODate | null;
  createdAt: string;
}

export interface Recurrence {
  id: string;
  kind: Kind;
  amount: Cents;
  description: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod | null;
  /** dia do mês (1–31). meses mais curtos usam o último dia. */
  dayOfMonth: number;
  /** primeiro mês com ocorrência. */
  startMonth: MonthKey;
  /** quantidade de ocorrências (parcelas). vazio = sem fim. */
  occurrences?: number | null;
  /** datas de ocorrências que o usuário pulou. */
  skippedDates: ISODate[];
  createdAt: string;
}

/** limite mensal de gastos para uma categoria (vale para todos os meses). */
export interface Budget {
  id: string;
  categoryId: string;
  amount: Cents;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  target: Cents;
  saved: Cents;
  deadline?: ISODate | null;
  createdAt: string;
}

export interface Settings {
  name: string;
  /** saldo que o usuário tinha no dia em que começou a usar o teo. */
  initialBalance: Cents;
  initialBalanceDate: ISODate;
  /** valor que o usuário quer manter guardado; não entra no "dá pra gastar". */
  reserve: Cents;
  hideValues: boolean;
  onboarded: boolean;
}

export interface Snapshot {
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
}
