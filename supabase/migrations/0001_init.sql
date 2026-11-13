-- teo — estrutura inicial do banco (supabase / postgres)
-- valores em centavos (bigint). datas como date. cada linha pertence a um usuário
-- e as políticas de row level security garantem que só o dono acessa seus dados.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  initial_balance bigint not null default 0,
  initial_balance_date date not null default current_date,
  reserve bigint not null default 0 check (reserve >= 0),
  hide_values boolean not null default false,
  onboarded boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'outros',
  kind text not null check (kind in ('receita', 'despesa', 'ambos')),
  archived boolean not null default false
);

create table public.recurrences (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receita', 'despesa')),
  amount bigint not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 80),
  category_id uuid references public.categories (id) on delete set null,
  payment_method text,
  day_of_month int not null check (day_of_month between 1 and 31),
  start_month text not null check (start_month ~ '^\d{4}-\d{2}$'),
  occurrences int check (occurrences is null or occurrences > 0),
  skipped_dates date[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receita', 'despesa')),
  amount bigint not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 80),
  category_id uuid references public.categories (id) on delete set null,
  date date not null,
  status text not null check (status in ('realizada', 'pendente')),
  payment_method text,
  recurrence_id uuid references public.recurrences (id) on delete set null,
  occurrence_date date,
  created_at timestamptz not null default now()
);

create table public.budgets (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount bigint not null check (amount >= 0),
  unique (user_id, category_id)
);

create table public.goals (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  icon text not null default 'meta',
  target bigint not null check (target > 0),
  saved bigint not null default 0 check (saved >= 0),
  deadline date,
  created_at timestamptz not null default now()
);

create index transactions_user_date on public.transactions (user_id, date);
create index recurrences_user on public.recurrences (user_id);

-- segurança: cada pessoa só enxerga e altera o que é dela.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'categories', 'recurrences', 'transactions', 'budgets', 'goals']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono acessa seus dados" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;
