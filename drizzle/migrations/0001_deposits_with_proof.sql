create table public.deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  nickname text not null,
  amount numeric not null,
  image_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.deposits to authenticated;
grant all on public.deposits to service_role;
alter table public.deposits enable row level security;
create policy "own or admin deposits" on public.deposits for select to authenticated using (user_id = auth.uid() or public.is_admin());

create or replace function public.request_deposit(_amount numeric, _path text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then raise exception 'Não autenticado'; end if;
  if _amount < 5 or _amount > 10000 then raise exception 'Depósito mínimo de R$ 5,00'; end if;
  if _path not like auth.uid()::text || '/%' then raise exception 'Arquivo inválido'; end if;
  insert into deposits(user_id, email, nickname, amount, image_path) values (p.id, p.email, p.nickname, _amount, _path);
end $$;

create or replace function public.admin_resolve_deposit(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
declare d deposits;
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  select * into d from deposits where id = _id for update;
  if d.id is null or d.status <> 'pending' then raise exception 'Depósito já resolvido'; end if;
  if _approve then
    update deposits set status = 'approved' where id = _id;
    update profiles set balance = balance + d.amount where id = d.user_id;
    insert into transactions(user_id, kind, amount, note) values (d.user_id, 'deposit', d.amount, 'Depósito Pix aprovado');
  else
    update deposits set status = 'rejected' where id = _id;
  end if;
end $$;

revoke execute on function public.deposit(numeric) from public, anon, authenticated;