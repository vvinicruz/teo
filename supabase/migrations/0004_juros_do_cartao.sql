-- teo — banco do cartão e juros do rotativo (aviso de pagamento mínimo).
alter table public.cards
  add column if not exists bank_code text,
  add column if not exists bank_name text,
  add column if not exists revolving_rate numeric(6, 2) check (revolving_rate is null or revolving_rate >= 0),
  add column if not exists revolving_rate_source text check (revolving_rate_source in ('fatura', 'bcb'));
