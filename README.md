# teo — tudo em ordem.

aplicativo de gestão financeira pessoal simplificada. o usuário registra receitas, despesas e
compromissos; o teo organiza tudo e mostra o **horizonte de saldo**: como o dinheiro deve se
comportar dia a dia até o fim do mês.

um código só para **android, iphone e web** (expo + react native + typescript).

---

## como rodar

pré-requisito: node 20 ou mais novo.

```bash
npm install
npm start          # abre o expo; escaneie o qr code com o app expo go no celular
npm run web        # abre no navegador
```

outros comandos:

```bash
npm test           # testes do motor financeiro
npm run typecheck  # checagem de tipos
npx expo lint      # padrões de código
```

## versão web (vercel)

o projeto já vem pronto para a vercel (`vercel.json`): ela roda `npx expo export --platform web`
e publica a pasta `dist`. basta importar o repositório em vercel.com, sem mudar nenhuma configuração.
no iphone, abra o link no safari e use **compartilhar → adicionar à tela de início** para abrir como app.

## modo local × nuvem

- **sem configuração**, o app roda em **modo local**: os dados ficam só no aparelho/navegador.
  a tela inicial avisa isso discretamente.
- **com supabase configurado**, aparece a tela de login (e-mail e senha) e os dados ficam na nuvem,
  sincronizados entre aparelhos.

### ligando a nuvem (supabase)

1. crie uma conta e um projeto em [supabase.com](https://supabase.com) (o plano gratuito serve).
2. no projeto, abra **sql editor**, cole o conteúdo de `supabase/migrations/0001_init.sql` e rode.
   isso cria as tabelas e as regras de segurança (cada pessoa só acessa os próprios dados).
3. em **project settings → api**, copie a *project url* e a chave *anon / publishable*.
4. copie `.env.example` para `.env` e preencha os dois valores.
5. reinicie o `npm start`.

> a chave *anon* é pública por natureza: quem protege os dados são as regras de row level security
> do passo 2. **nunca** coloque a chave *service_role* no app.

## estrutura

```
src/
  app/            telas (expo router: cada arquivo é uma rota)
    (tabs)/       início, horizonte, extrato, metas + barra inferior com o "+"
    movimentacao  adicionar / editar / confirmar previsão
    recorrencia(s) contas fixas, salário, parcelas
    planejamento  limite mensal por categoria
    meta          criar / editar meta
    perfil, categorias, entrar, boas-vindas
  domain/         regras de negócio puras (sem react) — testadas
    finance.ts    saldo, previsões, horizonte, "dá pra gastar por dia", planejamento
    money.ts      centavos e formatação r$
    dates.ts      datas "aaaa-mm-dd" sem fuso horário
  data/           persistência (local ou supabase, mesma interface) + login
  components/     sistema visual reutilizável
  theme/          cores, tipografia, espaçamentos
supabase/         estrutura do banco e regras de segurança
```

## regras financeiras (resumo)

- dinheiro sempre em **centavos inteiros**; datas como texto `aaaa-mm-dd` (sem fuso).
- **saldo atual** = saldo inicial + receitas realizadas − despesas realizadas. previsões nunca entram nele.
- **previsões** = contas pendentes + ocorrências de recorrências (salário, aluguel, parcelas).
- quando uma previsão é confirmada, ela vira um lançamento ligado à ocorrência original
  (`recurrenceId` + `occurrenceDate`). a previsão some — **nada é contado duas vezes**.
- previsão com data passada e não confirmada fica **"a confirmar"** e entra na projeção como se fosse hoje.
- o **planejamento** por categoria vira "gasto planejado" diário no horizonte, descontando o que já foi
  gasto ou está previsto na categoria. gastou 120 com 80 planejados? a diferença já está no saldo e o
  planejado restante vira zero.
- **dá pra gastar por dia** = (saldo atual + o que vai entrar − o que vai sair − reserva) ÷ dias restantes.

todas essas regras têm testes em `src/domain/__tests__/finance.test.ts`.

## identidade

- cor principal `#FF5C00`, creme `#FFF3EA`, fundo off-white, texto `#1A1A1A`.
- tipografia: **montserrat** como substituta da gotham (licença paga). para trocar, adicione os
  arquivos da gotham em `assets/fonts`, carregue-os em `src/app/_layout.tsx` e ajuste `fonts` em
  `src/theme/index.ts`.
- logo oficial em `assets/logo.svg` (usado sem alterações em `src/components/Logo.tsx`).
- toda a comunicação do app em **letras minúsculas**, tom humano e acolhedor.
