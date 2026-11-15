/**
 * imposto de renda da pessoa física: "preciso declarar?", lista de documentos e calendário.
 *
 * as regras mudam todo ano. cada ciclo tem a fonte oficial e diz se os valores já são
 * oficiais ou se ainda são uma referência do ano anterior (até a receita publicar).
 * o teo ajuda a organizar — não substitui a receita federal nem um contador.
 */
import { daysInclusive, type ISODate } from './dates';
import type { Cents } from './money';

export interface IrpfCycle {
  /** ano da entrega (ex.: 2027). */
  year: number;
  /** ano a que os valores se referem (ex.: 2026). */
  baseYear: number;
  /** true quando valores e datas já foram publicados pela receita. */
  official: boolean;
  opens: ISODate;
  closes: ISODate;
  limits: {
    /** rendimentos tributáveis no ano (salário, aposentadoria, aluguel...). */
    taxableIncome: Cents;
    /** rendimentos isentos, não tributáveis ou tributados só na fonte. */
    exemptIncome: Cents;
    /** bens e direitos em 31/12. */
    assets: Cents;
    /** receita bruta de atividade rural. */
    ruralRevenue: Cents;
    /** vendas na bolsa no ano. */
    stockSales: Cents;
  };
  /** multa mínima por atraso. */
  minFine: Cents;
  source: string;
}

const LIMITS_2026 = {
  taxableIncome: 3558400,
  exemptIncome: 20000000,
  assets: 80000000,
  ruralRevenue: 17792000,
  stockSales: 4000000,
};

export const IRPF_CYCLES: IrpfCycle[] = [
  {
    year: 2026,
    baseYear: 2025,
    official: true,
    opens: '2026-03-23',
    closes: '2026-05-29',
    limits: LIMITS_2026,
    minFine: 16574,
    source: 'receita federal, instrução normativa rfb nº 2.312/2026',
  },
  {
    // ainda não publicada: usamos os valores de 2026 e datas previstas (meados de março ao
    // último dia útil de maio). atualizar assim que a receita publicar as regras de 2027.
    year: 2027,
    baseYear: 2026,
    official: false,
    opens: '2027-03-15',
    closes: '2027-05-31',
    limits: LIMITS_2026,
    minFine: 16574,
    source: 'referência: regras de 2026 (as de 2027 ainda não foram publicadas)',
  },
];

/** o ciclo que importa agora: o próximo prazo que ainda não acabou. */
export function currentCycle(todayDate: ISODate): IrpfCycle {
  return IRPF_CYCLES.find((c) => c.closes >= todayDate) ?? IRPF_CYCLES[IRPF_CYCLES.length - 1];
}

// ---------- calendário e avisos ----------

export type IrpfPhase =
  | 'preparar' // ainda no ano-base: dá pra ir organizando
  | 'documentos' // jan–fev: chegam os informes de rendimentos
  | 'abre-em-breve' // março, antes de abrir
  | 'aberta' // prazo correndo
  | 'reta-final' // últimos 15 dias
  | 'ultimos-dias' // últimos 5 dias
  | 'encerrada';

export interface IrpfStatus {
  cycle: IrpfCycle;
  phase: IrpfPhase;
  /** dias até o fim do prazo (contando hoje). */
  daysLeft: number;
  /** dias até abrir. */
  daysToOpen: number;
  title: string;
  message: string;
}

export function irpfStatus(todayDate: ISODate): IrpfStatus {
  const cycle = currentCycle(todayDate);
  const daysLeft = todayDate <= cycle.closes ? daysInclusive(todayDate, cycle.closes) : 0;
  const daysToOpen = todayDate < cycle.opens ? daysInclusive(todayDate, cycle.opens) - 1 : 0;
  const yearStart = `${cycle.year}-01-01`;
  const marchStart = `${cycle.year}-03-01`;
  const when = cycle.official ? '' : ' (previsão)';

  let phase: IrpfPhase;
  if (todayDate > cycle.closes) phase = 'encerrada';
  else if (todayDate < yearStart) phase = 'preparar';
  else if (todayDate < marchStart) phase = 'documentos';
  else if (todayDate < cycle.opens) phase = 'abre-em-breve';
  else if (daysLeft <= 5) phase = 'ultimos-dias';
  else if (daysLeft <= 15) phase = 'reta-final';
  else phase = 'aberta';

  const texts: Record<IrpfPhase, { title: string; message: string }> = {
    preparar: {
      title: `imposto de renda ${cycle.year}`,
      message: `a declaração sobre ${cycle.baseYear} abre em março${when}. dá pra ir se organizando com calma.`,
    },
    documentos: {
      title: 'hora de juntar os documentos',
      message: `os informes de rendimentos (do trabalho e dos bancos) costumam chegar até o fim de fevereiro. a declaração abre em março${when}.`,
    },
    'abre-em-breve': {
      title: `a declaração abre em ${daysToOpen} ${daysToOpen === 1 ? 'dia' : 'dias'}`,
      message: `confere se a sua lista de documentos está completa. assim, é só preencher quando abrir${when}.`,
    },
    aberta: {
      title: 'a declaração está aberta',
      message: `você tem até ${formatDay(cycle.closes)}${when}. faltam ${daysLeft} dias, sem pressa e sem deixar pra última hora.`,
    },
    'reta-final': {
      title: `faltam ${daysLeft} dias para o fim do prazo`,
      message: `o prazo acaba em ${formatDay(cycle.closes)}${when}. se ainda não enviou, que tal separar um tempinho esta semana?`,
    },
    'ultimos-dias': {
      title: daysLeft === 1 ? 'hoje é o último dia!' : `últimos ${daysLeft} dias!`,
      message: `o prazo acaba em ${formatDay(cycle.closes)}${when}. depois disso, a multa mínima é de R$ ${(cycle.minFine / 100).toFixed(2).replace('.', ',')}.`,
    },
    encerrada: {
      title: 'prazo encerrado',
      message: 'se você precisava declarar e não enviou, ainda dá: a declaração atrasada pode ser enviada, com multa.',
    },
  };

  return { cycle, phase, daysLeft, daysToOpen, ...texts[phase] };
}

/** os avisos aparecem na tela inicial só nas fases em que a pessoa precisa agir. */
export function shouldRemind(status: IrpfStatus): boolean {
  return status.phase !== 'preparar' && status.phase !== 'encerrada';
}

/** chave da fase, para a pessoa poder dispensar o aviso até a fase mudar. */
export function reminderKey(status: IrpfStatus): string {
  return `${status.cycle.year}:${status.phase}`;
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function formatDay(date: ISODate): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]}`;
}

// ---------- preciso declarar? ----------

export interface IrpfAnswers {
  /** soma dos rendimentos tributáveis no ano (salário, aposentadoria, aluguel, freela...). */
  taxableIncome: Cents | null;
  exemptOver: boolean | null;
  assetsOver: boolean | null;
  capitalGain: boolean | null;
  stockMarket: boolean | null;
  rural: boolean | null;
  newResident: boolean | null;
  abroad: boolean | null;
}

export const EMPTY_ANSWERS: IrpfAnswers = {
  taxableIncome: null,
  exemptOver: null,
  assetsOver: null,
  capitalGain: null,
  stockMarket: null,
  rural: null,
  newResident: null,
  abroad: null,
};

export interface IrpfResult {
  mustDeclare: boolean;
  /** motivos, em linguagem simples. */
  reasons: string[];
  /** algumas respostas ficaram em branco. */
  incomplete: boolean;
}

export function evaluate(answers: IrpfAnswers, cycle: IrpfCycle): IrpfResult {
  const fmt = (c: Cents) => `R$ ${(c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;
  const reasons: string[] = [];
  if (answers.taxableIncome != null && answers.taxableIncome > cycle.limits.taxableIncome)
    reasons.push(`você recebeu mais de ${fmt(cycle.limits.taxableIncome)} em rendimentos tributáveis no ano.`);
  if (answers.exemptOver) reasons.push(`recebeu mais de ${fmt(cycle.limits.exemptIncome)} em rendimentos isentos ou tributados na fonte.`);
  if (answers.assetsOver) reasons.push(`tinha mais de ${fmt(cycle.limits.assets)} em bens e direitos em 31 de dezembro.`);
  if (answers.capitalGain) reasons.push('vendeu algo com lucro (ganho de capital).');
  if (answers.stockMarket) reasons.push(`vendeu mais de ${fmt(cycle.limits.stockSales)} na bolsa ou teve lucro tributável lá.`);
  if (answers.rural) reasons.push(`teve receita de atividade rural acima de ${fmt(cycle.limits.ruralRevenue)}.`);
  if (answers.newResident) reasons.push('passou a morar no brasil durante o ano.');
  if (answers.abroad) reasons.push('teve rendimentos, aplicações ou bens no exterior.');
  const incomplete = Object.values(answers).some((v) => v === null);
  return { mustDeclare: reasons.length > 0, reasons, incomplete };
}

// ---------- lista de documentos ----------

export type Situation =
  | 'clt'
  | 'autonomo'
  | 'aposentado'
  | 'aluguel'
  | 'investimentos'
  | 'saude'
  | 'educacao'
  | 'dependentes'
  | 'imovel-carro'
  | 'financiamento'
  | 'pensao'
  | 'previdencia';

export const SITUATIONS: { id: Situation; label: string }[] = [
  { id: 'clt', label: 'trabalho com carteira assinada' },
  { id: 'autonomo', label: 'trabalho por conta (freela, autônomo)' },
  { id: 'aposentado', label: 'recebo aposentadoria ou pensão do inss' },
  { id: 'aluguel', label: 'recebo aluguel' },
  { id: 'investimentos', label: 'tenho conta, poupança ou investimentos' },
  { id: 'saude', label: 'tive gastos com médico, dentista ou plano de saúde' },
  { id: 'educacao', label: 'paguei escola ou faculdade' },
  { id: 'dependentes', label: 'tenho filhos ou outros dependentes' },
  { id: 'imovel-carro', label: 'tenho ou comprei casa, apartamento ou carro' },
  { id: 'financiamento', label: 'tenho financiamento ou empréstimo' },
  { id: 'pensao', label: 'pago pensão alimentícia' },
  { id: 'previdencia', label: 'tenho previdência privada' },
];

export interface ChecklistItem {
  id: string;
  title: string;
  detail: string;
}

const BASE_ITEMS: ChecklistItem[] = [
  { id: 'govbr', title: 'conta gov.br prata ou ouro', detail: 'com ela você usa a declaração pré-preenchida, que já vem com boa parte dos dados.' },
  { id: 'anterior', title: 'declaração do ano passado', detail: 'se você declarou, guarde o número do recibo. ele é pedido na nova declaração.' },
  { id: 'banco', title: 'dados da sua conta bancária', detail: 'para receber a restituição, se tiver.' },
];

const ITEMS: Record<Situation, ChecklistItem[]> = {
  clt: [{ id: 'informe-empresa', title: 'informe de rendimentos da empresa', detail: 'a empresa entrega até o fim de fevereiro. traz salário, 13º e imposto já descontado.' }],
  autonomo: [
    { id: 'recibos-autonomo', title: 'quanto recebeu de pessoas físicas, mês a mês', detail: 'recibos, notas e o carnê-leão, se você pagou.' },
    { id: 'informes-pj', title: 'informes de empresas que te pagaram', detail: 'se alguma empresa reteve imposto, ela te manda um informe.' },
  ],
  aposentado: [{ id: 'inss', title: 'informe de rendimentos do inss', detail: 'baixe no app ou site meu inss.' }],
  aluguel: [{ id: 'alugueis', title: 'recibos e contrato de aluguel', detail: 'quanto recebeu em cada mês e o cpf ou cnpj de quem pagou.' }],
  investimentos: [
    { id: 'informes-bancos', title: 'informe de rendimentos de cada banco e corretora', detail: 'mostra o saldo em 31/12 e quanto rendeu. fica no app de cada banco.' },
  ],
  saude: [
    { id: 'recibos-saude', title: 'recibos e notas de saúde', detail: 'com nome e cpf ou cnpj de quem atendeu. gastos com saúde não têm limite de dedução.' },
    { id: 'plano-saude', title: 'informe do plano de saúde', detail: 'o plano manda quanto você pagou no ano.' },
  ],
  educacao: [{ id: 'escola', title: 'comprovantes de escola ou faculdade', detail: 'com cnpj da instituição. educação tem limite de dedução por pessoa.' }],
  dependentes: [{ id: 'dependentes', title: 'cpf e rendimentos dos dependentes', detail: 'todo dependente precisa de cpf, inclusive criança.' }],
  'imovel-carro': [
    { id: 'bens', title: 'documentos dos bens', detail: 'data da compra, valor pago e forma de pagamento. carro: renavam. imóvel: matrícula ou contrato.' },
  ],
  financiamento: [{ id: 'dividas', title: 'saldo das dívidas em 31/12', detail: 'o banco informa no extrato ou no informe de rendimentos.' }],
  pensao: [{ id: 'pensao', title: 'decisão judicial e comprovantes da pensão', detail: 'só pensão definida pela justiça ou em escritura pode ser deduzida.' }],
  previdencia: [{ id: 'previdencia', title: 'informe da previdência privada', detail: 'no pgbl, o que você pagou pode reduzir o imposto (até um limite).' }],
};

export function checklist(situations: Situation[]): ChecklistItem[] {
  const out = [...BASE_ITEMS];
  for (const s of SITUATIONS) if (situations.includes(s.id)) out.push(...ITEMS[s.id]);
  return out;
}
