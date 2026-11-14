-- teo — permite que a pessoa apague a própria conta (exigência da lgpd).
-- a função roda com permissão elevada (security definer), mas só apaga a conta
-- de quem está logado: auth.uid(). os dados (perfil, lançamentos, metas etc.)
-- somem junto, por causa do "on delete cascade" nas tabelas.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'não autenticado';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
