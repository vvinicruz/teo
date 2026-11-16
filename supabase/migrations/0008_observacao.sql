-- teo — observação opcional nas movimentações.
alter table public.transactions
  add column if not exists note text check (note is null or char_length(note) <= 500);
