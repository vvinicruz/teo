/**
 * conteúdo da tela de ajuda. linguagem simples, sem termos técnicos.
 * para mudar um texto, edite aqui — a tela monta tudo sozinha.
 */
export interface HelpTopic {
  id: string;
  /** chave de ícone (ver components/CategoryIcon). */
  icon: string;
  title: string;
  /** uma frase que aparece fechada, antes de tocar. */
  summary: string;
  paragraphs: string[];
  action?: { label: string; href: string };
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'comecando',
    icon: 'meta',
    title: 'como o teo funciona',
    summary: 'você registra, o teo organiza e faz as contas.',
    paragraphs: [
      'o teo não se conecta ao seu banco. você conta pra ele o que entra e o que sai, e ele organiza tudo e mostra como seu dinheiro deve ficar nos próximos dias.',
      'quanto mais você registra, mais certinhas ficam as previsões. não precisa ser perfeito: um passo de cada vez.',
    ],
  },
  {
    id: 'registrar',
    icon: 'alimentacao',
    title: 'registrar um gasto ou uma receita',
    summary: 'é só tocar no botão laranja "+".',
    paragraphs: [
      'toque no "+" no meio da barra de baixo, digite o valor e escolha a categoria. a descrição é opcional: se deixar em branco, usamos o nome da categoria.',
      'se a data for no futuro, ela fica como "conta a pagar" (ou "receita prevista") até você confirmar.',
      'pra editar ou apagar, toque na movimentação no extrato.',
    ],
    action: { label: 'registrar agora', href: '/movimentacao' },
  },
  {
    id: 'saldo',
    icon: 'reserva',
    title: 'saldo atual e saldo previsto',
    summary: 'um é o que você tem hoje, o outro é uma previsão.',
    paragraphs: [
      'saldo atual é o que você tem agora: o saldo inicial mais tudo que já entrou, menos tudo que já saiu.',
      'saldo previsto é uma estimativa: soma o que ainda vai entrar, tira as contas e faturas que vão vencer e o que você planejou gastar. ele muda conforme você registra.',
    ],
  },
  {
    id: 'horizonte',
    icon: 'viagem',
    title: 'horizonte de saldo',
    summary: 'a agenda do seu dinheiro, dia a dia.',
    paragraphs: [
      'o horizonte mostra todos os dias do mês, como uma agenda. em cada dia aparece o que entra, o que sai e como fica o saldo no fim do dia.',
      'dias que já passaram mostram o saldo real. de hoje em diante, é previsão. dá pra ver os próximos meses tocando nas setas.',
      'se em algum dia o saldo puder ficar negativo, o teo avisa com carinho pra você se planejar.',
    ],
    action: { label: 'ver meu horizonte', href: '/horizonte' },
  },
  {
    id: 'por-dia',
    icon: 'compras',
    title: 'quanto dá pra gastar por dia',
    summary: 'uma sugestão pra chegar tranquilo ao fim do mês.',
    paragraphs: [
      'o teo pega seu saldo, soma o que ainda vai entrar no mês, tira o que ainda vai sair e a sua reserva, e divide pelos dias que faltam.',
      'é uma sugestão, não uma regra. se um dia você gastar mais, tudo bem: os próximos dias se ajustam.',
    ],
  },
  {
    id: 'fixas',
    icon: 'moradia',
    title: 'contas fixas, salário e parcelas',
    summary: 'cadastre uma vez e o teo prevê todo mês.',
    paragraphs: [
      'salário, aluguel, internet, academia, assinaturas e compras parceladas se repetem. cadastre uma vez e elas aparecem sozinhas no horizonte, todo mês.',
      'quando o valor do mês for diferente (a conta de luz, por exemplo), é só confirmar com o valor certo. e se um mês não tiver, dá pra pular só aquele mês.',
    ],
    action: { label: 'ver contas fixas', href: '/recorrencias' },
  },
  {
    id: 'confirmar',
    icon: 'outros',
    title: 'o que é "a confirmar"',
    summary: 'previsões que já passaram da data.',
    paragraphs: [
      'quando uma conta ou receita prevista passa da data e você ainda não confirmou, ela aparece como "a confirmar" na tela inicial.',
      'se já aconteceu, toque no ✓ pra confirmar. enquanto isso, o teo considera que ela ainda vai acontecer, pra previsão não ficar errada.',
    ],
  },
  {
    id: 'cartao',
    icon: 'cartao',
    title: 'cartão de crédito e fatura',
    summary: 'a compra vai para a fatura, que vence depois.',
    paragraphs: [
      'cadastre seu cartão com o dia em que a fatura fecha e o dia em que vence. os dois aparecem no app do banco.',
      'ao registrar um gasto, escolha o cartão em "onde foi?". a compra não sai do seu saldo na hora: ela entra na fatura, e a fatura aparece no horizonte no dia do vencimento.',
      'quando pagar, abra o cartão e toque em "pagar fatura".',
    ],
    action: { label: 'ver meus cartões', href: '/cartoes' },
  },
  {
    id: 'minimo',
    icon: 'investimentos',
    title: 'pagar só uma parte da fatura',
    summary: 'o que falta vira rotativo, com juros altos.',
    paragraphs: [
      'se você paga menos que o total (o mínimo, por exemplo), o que falta vai para a próxima fatura no crédito rotativo, que tem um dos juros mais altos do mercado.',
      'o teo avisa na hora quanto isso pode custar, usando a taxa da sua fatura ou a média do seu banco no banco central. e já coloca o valor na próxima fatura pra você se planejar.',
    ],
  },
  {
    id: 'importar',
    icon: 'curso',
    title: 'importar o extrato do banco',
    summary: 'pra quando faltar tempo de registrar.',
    paragraphs: [
      'no app ou site do banco, procure "exportar extrato" ou "baixar fatura" e salve o arquivo .ofx ou .csv. no teo, vá em extrato → importar e escolha o arquivo.',
      'o teo sugere as categorias e pergunta quando algo parece repetido ("é a mesma?"). você confere tudo antes de salvar.',
      'o arquivo é lido só no seu aparelho e não é guardado. mas registrar no dia a dia ainda é o melhor jeito de perceber pra onde o dinheiro vai.',
    ],
    action: { label: 'importar extrato', href: '/importar' },
  },
  {
    id: 'planejamento',
    icon: 'lazer',
    title: 'planejamento do mês',
    summary: 'quanto você quer gastar em cada categoria.',
    paragraphs: [
      'defina um valor por categoria (ex.: R$ 600 no mercado). o teo acompanha quanto já foi e mostra se está tranquilo, quase no limite ou se passou.',
      'o valor planejado também entra no horizonte como "gasto planejado", pra previsão ficar mais perto da realidade.',
    ],
    action: { label: 'planejar o mês', href: '/planejamento' },
  },
  {
    id: 'metas',
    icon: 'viagem',
    title: 'metas',
    summary: 'seus sonhos, com começo, meio e fim.',
    paragraphs: [
      'crie uma meta (uma viagem, uma reserva, um celular novo), diga quanto quer juntar e, se quiser, até quando.',
      'toque em "guardar" sempre que separar um dinheiro pra ela. o teo mostra o progresso e quanto guardar por mês pra chegar lá.',
    ],
    action: { label: 'ver metas', href: '/metas' },
  },
  {
    id: 'esconder',
    icon: 'celular',
    title: 'esconder os valores',
    summary: 'pra usar o teo em público com tranquilidade.',
    paragraphs: [
      'toque no olho no topo da tela inicial pra esconder ou mostrar os valores. dá pra deixar escondido sempre que abrir, no perfil.',
    ],
  },
  {
    id: 'privacidade',
    icon: 'presentes',
    title: 'seus dados e sua conta',
    summary: 'seus dados são seus.',
    paragraphs: [
      'só você acessa seus dados. o teo não vende informações e não se conecta ao seu banco.',
      'no perfil, "começar do zero" apaga seus registros e mantém a conta. "apagar minha conta" apaga tudo, pra sempre.',
    ],
    action: { label: 'ler a política de privacidade', href: '/privacidade' },
  },
];
