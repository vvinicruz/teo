-- teo — várias contas bancárias e transferências entre elas.
create table if not exists public.accounts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  bank_code text,
  initial_balance bigint not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
drop policy if exists "dono acessa seus dados" on public.accounts;
create policy "dono acessa seus dados" on public.accounts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  add column if not exists transfer_id uuid;

alter table public.recurrences
  add column if not exists account_id uuid references public.accounts (id) on delete set null;
