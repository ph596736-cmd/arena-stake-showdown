
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  nickname text not null,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.profiles to authenticated;
grant update (nickname) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select email from auth.users where id = auth.uid()) = 'ph596736@gmail.com', false)
$$;

create policy "own or admin profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid());

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, nickname)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'nickname',''), split_part(new.email,'@',1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  amount numeric(12,2) not null,
  note text,
  created_at timestamptz not null default now()
);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own tx" on public.transactions for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nickname text not null,
  amount numeric(12,2) not null,
  pix_key text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "own wd" on public.withdrawals for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  stake numeric(12,2) not null,
  rules text,
  creator_id uuid not null,
  creator_nick text not null,
  opponent_id uuid,
  opponent_nick text,
  status text not null default 'open',
  winner_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "read matches" on public.matches for select to authenticated using (true);

create table public.proofs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null,
  nickname text not null,
  image_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select on public.proofs to authenticated;
grant all on public.proofs to service_role;
alter table public.proofs enable row level security;
create policy "read proofs" on public.proofs for select to authenticated using (
  user_id = auth.uid() or public.is_admin() or exists (select 1 from public.matches m where m.id = match_id and (m.creator_id = auth.uid() or m.opponent_id = auth.uid()))
);

create or replace function public.deposit(_amount numeric) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if _amount <= 0 or _amount > 10000 then raise exception 'Valor inválido'; end if;
  update profiles set balance = balance + _amount where id = auth.uid();
  insert into transactions(user_id, kind, amount, note) values (auth.uid(), 'deposit', _amount, 'Depósito Pix');
end $$;

create or replace function public.request_withdraw(_amount numeric, _pix_key text) returns void language plpgsql security definer set search_path = public as $$
declare p profiles;
begin
  select * into p from profiles where id = auth.uid() for update;
  if p.id is null then raise exception 'Não autenticado'; end if;
  if _amount < 10 then raise exception 'Saque mínimo de R$ 10,00'; end if;
  if coalesce(trim(_pix_key),'') = '' then raise exception 'Informe a chave Pix'; end if;
  if p.balance < _amount then raise exception 'Saldo insuficiente'; end if;
  update profiles set balance = balance - _amount where id = p.id;
  insert into withdrawals(user_id, nickname, amount, pix_key) values (p.id, p.nickname, _amount, trim(_pix_key));
  insert into transactions(user_id, kind, amount, note) values (p.id, 'withdraw', -_amount, 'Saque Pix solicitado');
end $$;

create or replace function public.create_match(_game text, _stake numeric, _rules text) returns uuid language plpgsql security definer set search_path = public as $$
declare p profiles; mid uuid;
begin
  select * into p from profiles where id = auth.uid();
  if p.id is null then raise exception 'Não autenticado'; end if;
  if _game not in ('sinuca','freefire','codm') then raise exception 'Jogo inválido'; end if;
  if _stake < 1 then raise exception 'Aposta mínima de R$ 1,00'; end if;
  if p.balance < _stake then raise exception 'Saldo insuficiente para criar essa sala'; end if;
  insert into matches(game, stake, rules, creator_id, creator_nick) values (_game, _stake, left(_rules, 500), p.id, p.nickname) returning id into mid;
  return mid;
end $$;

create or replace function public.accept_match(_match_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare m matches; me profiles; cr profiles;
begin
  select * into m from matches where id = _match_id for update;
  if m.id is null then raise exception 'Sala não encontrada'; end if;
  if m.status <> 'open' then raise exception 'Essa sala não está mais aberta'; end if;
  if m.creator_id = auth.uid() then raise exception 'Você não pode aceitar seu próprio desafio'; end if;
  select * into me from profiles where id = auth.uid() for update;
  select * into cr from profiles where id = m.creator_id for update;
  if me.id is null then raise exception 'Não autenticado'; end if;
  if me.balance < m.stake then raise exception 'Saldo insuficiente'; end if;
  if cr.balance < m.stake then raise exception 'O criador não tem mais saldo para essa aposta'; end if;
  update profiles set balance = balance - m.stake where id in (me.id, cr.id);
  insert into transactions(user_id, kind, amount, note) values (me.id,'bet',-m.stake,'Aposta X1'),(cr.id,'bet',-m.stake,'Aposta X1');
  update matches set opponent_id = me.id, opponent_nick = me.nickname, status = 'live' where id = m.id;
end $$;

create or replace function public.cancel_match(_match_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update matches set status = 'cancelled' where id = _match_id and creator_id = auth.uid() and status = 'open';
  if not found then raise exception 'Não foi possível cancelar'; end if;
end $$;

create or replace function public.submit_proof(_match_id uuid, _path text) returns void language plpgsql security definer set search_path = public as $$
declare m matches; p profiles;
begin
  select * into m from matches where id = _match_id;
  if m.id is null or m.opponent_id is null or auth.uid() not in (m.creator_id, m.opponent_id) then raise exception 'Você não está nessa partida'; end if;
  if m.status not in ('live','review') then raise exception 'Partida não aceita prints agora'; end if;
  if _path not like auth.uid()::text || '/%' then raise exception 'Arquivo inválido'; end if;
  select * into p from profiles where id = auth.uid();
  insert into proofs(match_id, user_id, nickname, image_path) values (m.id, p.id, p.nickname, _path);
  update matches set status = 'review' where id = m.id;
end $$;

create or replace function public.admin_approve_proof(_proof_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare pr proofs; m matches; prize numeric;
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  select * into pr from proofs where id = _proof_id for update;
  if pr.id is null then raise exception 'Print não encontrado'; end if;
  select * into m from matches where id = pr.match_id for update;
  if m.status = 'finished' then raise exception 'Partida já finalizada'; end if;
  prize := round(m.stake * 2 * 0.9, 2);
  update profiles set balance = balance + prize where id = pr.user_id;
  insert into transactions(user_id, kind, amount, note) values (pr.user_id, 'prize', prize, 'Prêmio X1 (90%)');
  update proofs set status = case when id = pr.id then 'approved' else 'rejected' end where match_id = m.id and status = 'pending';
  update matches set status = 'finished', winner_id = pr.user_id where id = m.id;
end $$;

create or replace function public.admin_reject_proof(_proof_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  update proofs set status = 'rejected' where id = _proof_id;
end $$;

create or replace function public.admin_resolve_withdraw(_id uuid, _approve boolean) returns void language plpgsql security definer set search_path = public as $$
declare w withdrawals;
begin
  if not is_admin() then raise exception 'Acesso negado'; end if;
  select * into w from withdrawals where id = _id for update;
  if w.status <> 'pending' then raise exception 'Pedido já resolvido'; end if;
  if _approve then
    update withdrawals set status = 'paid' where id = _id;
  else
    update withdrawals set status = 'rejected' where id = _id;
    update profiles set balance = balance + w.amount where id = w.user_id;
    insert into transactions(user_id, kind, amount, note) values (w.user_id, 'refund', w.amount, 'Saque recusado - estorno');
  end if;
end $$;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.deposit(numeric), public.request_withdraw(numeric, text), public.create_match(text, numeric, text), public.accept_match(uuid), public.cancel_match(uuid), public.submit_proof(uuid, text), public.admin_approve_proof(uuid), public.admin_reject_proof(uuid), public.admin_resolve_withdraw(uuid, boolean) from anon, public;
grant execute on function public.is_admin(), public.deposit(numeric), public.request_withdraw(numeric, text), public.create_match(text, numeric, text), public.accept_match(uuid), public.cancel_match(uuid), public.submit_proof(uuid, text), public.admin_approve_proof(uuid), public.admin_reject_proof(uuid), public.admin_resolve_withdraw(uuid, boolean) to authenticated;

create policy "upload own proof" on storage.objects for insert to authenticated with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read proofs files" on storage.objects for select to authenticated using (bucket_id = 'proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
