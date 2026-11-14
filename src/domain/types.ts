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
  /**
   * compra no cartão de crédito: não sai do saldo na hora, entra na fatura do cartão.
   * vazio = movimentação da conta (dinheiro, pix, débito...).
   */
  cardId?: string | null;
  /**
   * pagamento de fatura: lançamento da conta que quita a fatura do cartão
   * `paysCardId` com vencimento em `invoiceDate`. substitui a previsão da fatura.
   */
  paysCardId?: string | null;
  invoiceDate?: ISODate | null;
  /** identificador vindo do extrato importado, para não importar duas vezes. */
  externalId?: string | null;
  /**
   * movimentação entre a conta e uma caixinha/investimento: despesa = guardar,
   * receita = resgatar. não é gasto nem receita: o dinheiro continua sendo seu.
   */
  investmentId?: string | null;
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
  /** cobrada no cartão de crédito (ex.: assinatura, compra parcelada). */
  cardId?: string | null;
  /** "guardar todo mês": cada ocorrência leva dinheiro da conta para esta caixinha. */
  investmentId?: string | null;
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
  /** quando a meta é guardada numa caixinha, o progresso acompanha o saldo dela. */
  investmentId?: string | null;
  /** último marco comemorado (0, 25, 50, 75 ou 100). vazio = ainda não acompanhado. */
  lastMilestone?: number | null;
  /** metas sem caixinha: quando guardou pela última vez e em quais meses guardou. */
  lastContributionAt?: string | null;
  contributionMonths?: MonthKey[];
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

/** cartão de crédito. as compras entram na fatura, que vence em `dueDay`. */
export interface Card {
  id: string;
  name: string;
  /** dia em que a fatura fecha. compras depois desse dia vão para a fatura seguinte. */
  closingDay: number;
  /** dia em que a fatura vence (quando o dinheiro sai da conta). */
  dueDay: number;
  /** limite do cartão (opcional). */
  creditLimit: Cents | null;
  /** banco emissor (código do banco central, 8 dígitos do cnpj), para estimar juros. */
  bankCode?: string | null;
  bankName?: string | null;
  /** juros do rotativo, em % ao mês. */
  revolvingRate?: number | null;
  /** de onde veio a taxa: da fatura (informada pela pessoa) ou média do banco no banco central. */
  revolvingRateSource?: 'fatura' | 'bcb' | null;
  archived?: boolean;
  createdAt: string;
}

export type InvestmentKind = 'caixinha' | 'cdb' | 'poupanca' | 'tesouro' | 'outro';

export const INVESTMENT_KINDS: { id: InvestmentKind; label: string }[] = [
  { id: 'caixinha', label: 'caixinha' },
  { id: 'cdb', label: 'cdb' },
  { id: 'poupanca', label: 'poupança' },
  { id: 'tesouro', label: 'tesouro selic' },
  { id: 'outro', label: 'outro' },
];

/** dinheiro guardado: caixinha, cdb, poupança, tesouro selic... */
export interface Investment {
  id: string;
  name: string;
  kind: InvestmentKind;
  /** rendimento em % do cdi (ex.: 100). vazio = não sabemos. */
  cdiPercent: number | null;
  /** último valor informado pela pessoa. */
  balance: Cents;
  /** quando esse valor foi informado. guardar/resgatar depois disso somam ao valor. */
  balanceUpdatedAt: string;
  archived?: boolean;
  createdAt: string;
}

export interface Snapshot {
  settings: Settings;
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  cards: Card[];
  investments: Investment[];
}
