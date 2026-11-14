-- teo — motivação para as metas: guardar todo mês, marcos e sequência.
alter table public.recurrences
  add column if not exists investment_id uuid references public.investments (id) on delete set null;

alter table public.goals
  add column if not exists last_milestone int check (last_milestone is null or last_milestone between 0 and 100),
  add column if not exists last_contribution_at timestamptz,
  add column if not exists contribution_months text[] not null default '{}';
