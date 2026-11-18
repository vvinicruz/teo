/**
 * roteiros do passo a passo. cada passo diz em que tela acontece (`route`), o que destacar
 * (`target`, marcado na tela com <TourTarget id="...">) e o texto.
 * `advanceOnRoute`: se a pessoa tocar no destaque e chegar nessa tela, o passo a passo segue sozinho.
 *
 * importante: ao criar ou mudar uma funcionalidade, atualize o roteiro da tela correspondente.
 */
export interface TourStep {
  route: string;
  target?: string;
  title: string;
  text: string;
  advanceOnRoute?: string;
}

export interface Tour {
  id: string;
  title: string;
  /** frase curta para a lista da ajuda. */
  summary: string;
  icon: string;
  steps: TourStep[];
}

export const FIRST_TOUR = 'primeiros-passos';

export const TOURS: Tour[] = [
  {
    id: FIRST_TOUR,
    title: 'primeiros passos',
    summary: 'um passeio rápido pelo teo, do saldo ao horizonte.',
    icon: 'lazer',
    steps: [
      {
        route: '/',
        title: 'que bom ter você aqui!',
        text: 'em 1 minutinho eu te mostro como o teo funciona. pode pular quando quiser, ou seguir sem tocar em nada.',
      },
      {
        route: '/',
        target: 'home-saldo',
        title: 'seu saldo de hoje',
        text: 'quanto tem nas suas contas agora, e o que entrou e saiu neste mês.',
      },
      {
        route: '/',
        target: 'home-dia',
        title: 'quanto dá pra gastar hoje',
        text: 'o teo olha o que ainda vai entrar e sair até o fim do mês e sugere um valor por dia. assim o mês fecha no azul.',
      },
      {
        route: '/',
        target: 'tab-add',
        title: 'o botão mais importante',
        text: 'é no + que você registra um gasto ou uma receita. leva segundos.',
        advanceOnRoute: '/movimentacao',
      },
      {
        route: '/movimentacao',
        target: 'mov-valor',
        title: 'comece pelo valor',
        text: 'digite quanto foi. em cima, dá pra trocar entre despesa e receita.',
      },
      {
        route: '/movimentacao',
        target: 'mov-onde',
        title: 'onde foi?',
        text: 'escolha a conta ou o cartão. no cartão, o gasto vai para a fatura e só sai do saldo no vencimento. o + adicionar cadastra um banco novo.',
      },
      {
        route: '/movimentacao',
        target: 'mov-categoria',
        title: 'a categoria',
        text: 'ajuda a ver pra onde o dinheiro vai. dá pra criar as suas, com ícone.',
      },
      {
        route: '/movimentacao',
        target: 'mov-salvar',
        title: 'e salvar',
        text: 'pronto, registrado. dá também para marcar como conta fixa ou parcelada, e o teo prevê os próximos meses.',
      },
      {
        route: '/horizonte',
        target: 'hz-resumo',
        title: 'o horizonte',
        text: 'o coração do teo: seu saldo dia a dia até o fim do mês, com o que vai entrar e sair. você vê antes se vai faltar.',
      },
      {
        route: '/extrato',
        target: 'ext-importar',
        title: 'extrato e importação',
        text: 'aqui fica tudo o que você registrou. sem tempo? importe o arquivo do banco (ofx, csv, planilha ou pdf) e o teo organiza, sem duplicar.',
      },
      {
        route: '/metas',
        target: 'metas-nova',
        title: 'metas e caixinhas',
        text: 'crie um objetivo (viagem, reserva...), guarde aos pouquinhos e o teo comemora cada etapa com você.',
      },
      {
        route: '/',
        target: 'home-gastos',
        title: 'gastos por categoria',
        text: 'veja pra onde vai o dinheiro, compare com o mês passado e, se quiser, defina um limite por categoria.',
      },
      {
        route: '/',
        target: 'home-perfil',
        title: 'seu perfil',
        text: 'contas e cartões, caixinhas, imposto de renda e a ajuda ficam aqui. na ajuda dá pra refazer este passo a passo quando quiser.',
      },
      {
        route: '/',
        title: 'agora é com você!',
        text: 'que tal começar registrando o seu primeiro gasto no +? qualquer dúvida, a ajuda está no seu perfil.',
      },
    ],
  },
  {
    id: 'registrar',
    title: 'registrar um gasto',
    summary: 'despesa ou receita, valor, onde foi e categoria.',
    icon: 'compras',
    steps: [
      { route: '/movimentacao', target: 'mov-tipo', title: 'despesa ou receita?', text: 'escolha se o dinheiro saiu ou entrou.' },
      { route: '/movimentacao', target: 'mov-valor', title: 'o valor', text: 'digite quanto foi. os centavos entram sozinhos.' },
      { route: '/movimentacao', target: 'mov-descricao', title: 'o nome', text: 'um nome curto ajuda a lembrar depois: "mercado", "uber", "salário".' },
      {
        route: '/movimentacao',
        target: 'mov-onde',
        title: 'onde foi?',
        text: 'conta, banco ou cartão. no cartão, vai para a fatura. o + adicionar cadastra um banco ou cartão novo na hora.',
      },
      { route: '/movimentacao', target: 'mov-categoria', title: 'categoria', text: 'escolha uma, ou crie a sua com o ícone que quiser.' },
      {
        route: '/movimentacao',
        target: 'mov-salvar',
        title: 'salvar',
        text: 'e pronto. dá para mudar a data, repetir todo mês ou dividir em parcelas antes de salvar.',
      },
    ],
  },
  {
    id: 'horizonte',
    title: 'o horizonte',
    summary: 'seu saldo dia a dia até o fim do mês.',
    icon: 'investimentos',
    steps: [
      {
        route: '/horizonte',
        target: 'hz-resumo',
        title: 'como o mês vai terminar',
        text: 'o saldo de hoje e quanto deve sobrar no fim do mês, contando o que já está previsto.',
      },
      {
        route: '/horizonte',
        target: 'hz-dias',
        title: 'dia a dia',
        text: 'cada dia com o que entra e sai e o saldo depois. se algum dia ficar no vermelho, você vê antes de acontecer.',
      },
    ],
  },
  {
    id: 'importar',
    title: 'importar o extrato',
    summary: 'traga as movimentações do banco sem digitar.',
    icon: 'contas',
    steps: [
      {
        route: '/importar',
        target: 'imp-destino',
        title: 'de onde é o extrato?',
        text: 'escolha a conta ou o cartão. para a fatura do cartão, escolha o cartão.',
      },
      {
        route: '/importar',
        target: 'imp-arquivo',
        title: 'escolha o arquivo',
        text: 'ofx, csv, planilha .xlsx ou pdf, baixado no app ou site do banco. o arquivo é lido no seu aparelho e não vai para lugar nenhum.',
      },
      {
        route: '/importar',
        title: 'o teo confere com você',
        text: 'o que já estava registrado não duplica. quando parecer igual, ele pergunta. pix para outra conta sua vira transferência, e parcelas perguntam se lançam as próximas.',
      },
    ],
  },
  {
    id: 'cartao',
    title: 'cartões e faturas',
    summary: 'compras no cartão, fatura e vencimento.',
    icon: 'cartao',
    steps: [
      {
        route: '/cartoes',
        target: 'cartoes-novo',
        title: 'cadastre o cartão',
        text: 'com o dia em que a fatura fecha e o dia em que vence. leva menos de um minuto.',
      },
      {
        route: '/cartoes',
        target: 'cartoes-lista',
        title: 'a fatura',
        text: 'compras no cartão não saem do saldo na hora: entram na fatura, que aparece no horizonte no vencimento. toque no cartão para ver a fatura e pagar.',
      },
    ],
  },
  {
    id: 'planejamento',
    title: 'gastos por categoria',
    summary: 'pra onde vai o dinheiro, limites e comparação.',
    icon: 'investimentos',
    steps: [
      {
        route: '/planejamento',
        target: 'gastos-resumo',
        title: 'quanto saiu no mês',
        text: 'o total gasto, na conta e no cartão. use as setas para ver outros meses.',
      },
      {
        route: '/planejamento',
        target: 'gastos-pdf',
        title: 'relatório em pdf',
        text: 'baixe um pdf com os gastos por categoria e cada compra do mês.',
      },
      {
        route: '/planejamento',
        target: 'gastos-lista',
        title: 'cada categoria',
        text: 'toque numa categoria para ver os gastos com as datas, comparar com o mês passado, ver a evolução e definir um limite, se quiser.',
      },
    ],
  },
  {
    id: 'metas',
    title: 'metas e caixinhas',
    summary: 'objetivos, quanto guardar e o progresso.',
    icon: 'reserva',
    steps: [
      {
        route: '/metas',
        target: 'metas-nova',
        title: 'crie uma meta',
        text: 'dê um nome, o valor e, se quiser, uma data. o teo calcula quanto guardar por mês.',
      },
      {
        route: '/metas',
        target: 'metas-guardado',
        title: 'caixinhas e investimentos',
        text: 'onde o dinheiro fica guardado. ligue a meta a uma caixinha e o progresso acompanha o saldo dela.',
      },
    ],
  },
];

/** passo a passo de cada assunto da ajuda (id do assunto → id do passo a passo). */
export const HELP_TOURS: Record<string, string> = {
  comecando: FIRST_TOUR,
  registrar: 'registrar',
  horizonte: 'horizonte',
  importar: 'importar',
  cartao: 'cartao',
  planejamento: 'planejamento',
  metas: 'metas',
  caixinhas: 'metas',
};
