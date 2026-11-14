-- teo — caixinhas e investimentos de renda fixa, ligação com metas.

create table if not exists public.investments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('caixinha', 'cdb', 'poupanca', 'tesouro', 'outro')),
  cdi_percent numeric(6, 2) check (cdi_percent is null or cdi_percent >= 0),
  balance bigint not null default 0 check (balance >= 0),
  balance_updated_at timestamptz not null default now(),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.investments enable row level security;
drop policy if exists "dono acessa seus dados" on public.investments;
create policy "dono acessa seus dados" on public.investments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- guardar/resgatar: lançamento da conta ligado à caixinha.
alter table public.transactions
  add column if not exists investment_id uuid references public.investments (id) on delete set null;

-- meta guardada numa caixinha.
alter table public.goals
  add column if not exists investment_id uuid references public.investments (id) on delete set null;
