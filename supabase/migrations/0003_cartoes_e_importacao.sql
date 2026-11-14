-- teo — cartões de crédito e importação de extratos.

create table if not exists public.cards (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  credit_limit bigint check (credit_limit is null or credit_limit >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.cards enable row level security;
drop policy if exists "dono acessa seus dados" on public.cards;
create policy "dono acessa seus dados" on public.cards for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- compras no cartão, pagamentos de fatura e identificador do extrato importado.
alter table public.transactions
  add column if not exists card_id uuid references public.cards (id) on delete set null,
  add column if not exists pays_card_id uuid references public.cards (id) on delete set null,
  add column if not exists invoice_date date,
  add column if not exists external_id text;

-- recorrências cobradas no cartão (assinaturas, parcelas).
alter table public.recurrences
  add column if not exists card_id uuid references public.cards (id) on delete set null;

create index if not exists transactions_user_external on public.transactions (user_id, external_id);
