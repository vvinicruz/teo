/**
 * termos de uso e política de privacidade do teo.
 * versão inicial, escrita como modelo — precisa de revisão jurídica antes do lançamento.
 * para atualizar: mude o texto, a data em LEGAL_UPDATED_AT e avise quem já usa o app.
 */

export const LEGAL_UPDATED_AT = '14 de novembro de 2026';
export const LEGAL_RESPONSIBLE = 'Vinícius Henrique da Cruz';
export const LEGAL_CONTACT = 'contato@appteo.com.br';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export const TERMS: LegalSection[] = [
  {
    title: '1. o que é o teo',
    paragraphs: [
      `o teo é um aplicativo de organização financeira pessoal, disponível em appteo.com.br, mantido por ${LEGAL_RESPONSIBLE} ("nós"). ele ajuda você a registrar receitas, despesas, compromissos e metas, e mostra previsões de como seu saldo deve se comportar nos próximos dias.`,
      'ao criar uma conta ou usar o teo, você concorda com estes termos e com a nossa política de privacidade. se não concordar, por favor não use o aplicativo.',
    ],
  },
  {
    title: '2. o que o teo não é',
    paragraphs: [
      'o teo não é um banco, não movimenta dinheiro, não se conecta à sua conta bancária e não oferece consultoria financeira, de investimentos, contábil ou jurídica.',
      'todas as informações do teo vêm do que você mesmo registra. o saldo previsto, o "dá pra gastar por dia" e as demais projeções são estimativas feitas a partir desses registros, não valores confirmados. as decisões sobre o seu dinheiro continuam sendo suas.',
    ],
  },
  {
    title: '3. sua conta',
    paragraphs: [
      'para usar a versão na nuvem, você cria uma conta com e-mail e senha. você é responsável por manter sua senha em segredo e pelas atividades feitas na sua conta.',
      'o teo é destinado a maiores de 18 anos. menores de idade só podem usar com autorização e acompanhamento de um responsável legal.',
      'você se compromete a informar um e-mail válido e a não usar a conta de outra pessoa.',
    ],
  },
  {
    title: '4. uso adequado',
    paragraphs: [
      'você concorda em não usar o teo para fins ilegais, não tentar acessar dados de outras pessoas, não tentar burlar a segurança do aplicativo e não sobrecarregar de propósito os nossos sistemas.',
      'podemos suspender ou encerrar contas que descumpram estes termos, avisando você sempre que possível.',
    ],
  },
  {
    title: '5. preço',
    paragraphs: [
      'neste momento o teo é gratuito. se um dia houver planos pagos, isso será comunicado com antecedência e nada será cobrado sem a sua concordância expressa.',
    ],
  },
  {
    title: '6. disponibilidade e responsabilidade',
    paragraphs: [
      'trabalhamos para que o teo funcione bem e esteja sempre disponível, mas ele é oferecido "no estado em que se encontra" e pode passar por instabilidades, manutenções ou mudanças.',
      'na medida permitida pela lei, não nos responsabilizamos por perdas decorrentes de decisões tomadas com base nas previsões do aplicativo, de informações registradas de forma incorreta ou de indisponibilidade temporária do serviço.',
    ],
  },
  {
    title: '7. propriedade intelectual',
    paragraphs: [
      'a marca teo, o logotipo, o visual e o código do aplicativo pertencem aos seus titulares. os dados financeiros que você registra são seus.',
    ],
  },
  {
    title: '8. encerramento',
    paragraphs: [
      'você pode parar de usar o teo e apagar sua conta quando quiser, em perfil → apagar minha conta. isso apaga seus dados de forma definitiva, como descrito na política de privacidade.',
    ],
  },
  {
    title: '9. mudanças nestes termos',
    paragraphs: [
      'podemos atualizar estes termos. quando a mudança for importante, avisaremos pelo aplicativo ou por e-mail antes de ela valer. continuar usando o teo depois disso significa que você concorda com a nova versão.',
    ],
  },
  {
    title: '10. lei aplicável e contato',
    paragraphs: [
      'estes termos seguem as leis do brasil, incluindo o código de defesa do consumidor e a lei geral de proteção de dados (lei nº 13.709/2018). fica eleito o foro do domicílio do usuário.',
      `dúvidas? fale com a gente: ${LEGAL_CONTACT}.`,
    ],
  },
];

export const PRIVACY: LegalSection[] = [
  {
    title: '1. quem cuida dos seus dados',
    paragraphs: [
      `o controlador dos dados pessoais tratados no teo é ${LEGAL_RESPONSIBLE}. para qualquer assunto sobre seus dados, inclusive para falar com o encarregado (dpo), escreva para ${LEGAL_CONTACT}.`,
      'esta política explica, de forma simples, quais dados o teo usa, para quê e quais são os seus direitos, conforme a lei geral de proteção de dados (lgpd).',
    ],
  },
  {
    title: '2. quais dados usamos',
    paragraphs: [
      'dados de conta: seu e-mail e sua senha. a senha é guardada de forma criptografada e nem nós conseguimos vê-la.',
      'dados que você informa no app: nome ou apelido, saldo inicial, reserva, movimentações (valor, descrição, categoria, data, forma de pagamento e situação), contas fixas e parcelas, planejamento por categoria e metas.',
      'dados técnicos: registros de acesso (como endereço ip, data e hora), guardados pelos nossos fornecedores de infraestrutura por segurança e por obrigação legal (marco civil da internet).',
      'o teo não pede cpf, não se conecta ao seu banco e não acessa contatos, localização, câmera ou outros dados do seu aparelho.',
    ],
  },
  {
    title: '3. para que usamos',
    paragraphs: [
      'para criar e manter sua conta, guardar seus registros e calcular seu saldo, suas previsões e seu planejamento (execução do contrato com você, art. 7º, v, da lgpd).',
      'para manter o aplicativo seguro, evitar fraudes e cumprir obrigações legais (legítimo interesse e cumprimento de obrigação legal, art. 7º, ii e ix).',
      'não vendemos seus dados, não usamos seus dados financeiros para publicidade e não os compartilhamos com anunciantes.',
    ],
  },
  {
    title: '4. com quem compartilhamos',
    paragraphs: [
      'usamos fornecedores que funcionam como operadores, tratando os dados só para fazer o teo funcionar: supabase (banco de dados e login) e vercel (hospedagem do site). esses serviços podem armazenar dados fora do brasil, com garantias de segurança adequadas.',
      'também podemos compartilhar dados quando a lei exigir ou por ordem de autoridade competente.',
    ],
  },
  {
    title: '5. segurança',
    paragraphs: [
      'a conexão com o teo é criptografada (https). no banco de dados, cada conta só consegue ler e alterar os próprios registros, por regras de segurança aplicadas em todas as tabelas.',
      'nenhum sistema é 100% invulnerável. se acontecer um incidente de segurança relevante, avisaremos você e a autoridade nacional de proteção de dados (anpd), como manda a lei.',
    ],
  },
  {
    title: '6. por quanto tempo guardamos',
    paragraphs: [
      'seus dados ficam guardados enquanto sua conta existir.',
      'quando você apaga a conta (perfil → apagar minha conta), sua conta e todos os seus registros são apagados do nosso banco de dados na hora. cópias de segurança automáticas dos nossos fornecedores podem levar até 30 dias para serem substituídas. registros de acesso podem ser mantidos pelo prazo exigido em lei.',
    ],
  },
  {
    title: '7. seus direitos',
    paragraphs: [
      'pela lgpd, você pode: confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a exclusão, pedir a portabilidade, saber com quem compartilhamos e revogar seu consentimento quando ele for a base do tratamento.',
      `boa parte disso você faz direto no app: editar e apagar registros, corrigir seus dados no perfil e apagar sua conta. para o resto, escreva para ${LEGAL_CONTACT}. respondemos em até 15 dias.`,
      'você também pode reclamar à autoridade nacional de proteção de dados (anpd).',
    ],
  },
  {
    title: '8. armazenamento no aparelho',
    paragraphs: [
      'o teo guarda no seu aparelho ou navegador apenas o necessário para funcionar, como a sessão de login e, no modo local, os seus registros. não usamos cookies de rastreamento nem de publicidade.',
    ],
  },
  {
    title: '9. mudanças nesta política',
    paragraphs: [
      'podemos atualizar esta política. mudanças importantes serão avisadas pelo aplicativo ou por e-mail. a data da última atualização fica sempre no topo desta página.',
    ],
  },
];
