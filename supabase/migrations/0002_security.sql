-- 0002: seguranca. Substitui as policies abertas (auth_all using true) por RLS baseado em papel.
-- Idempotente. Pre-requisito: 0001_init.sql.

-- ---------------------------------------------------------------- colunas faltantes de 0001
alter table todo_items add column if not exists assigned_email text;
alter table todo_items add column if not exists completed_at timestamptz;

-- ---------------------------------------------------------------- papeis por auth.uid()
alter table user_roles add column if not exists user_id uuid unique references auth.users(id) on delete cascade;
update user_roles ur set user_id = u.id from auth.users u where ur.user_id is null and lower(u.email) = lower(ur.email);

create or replace function public.jwt_email() returns text
language sql stable as $$ select lower(auth.jwt() ->> 'email') $$;

-- Papel do usuario logado; NULL = sem acesso (conta sem linha em user_roles).
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.app_role() = 'admin', false)
$$;

create or replace function public.is_staff() returns boolean   -- admin ou member
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.app_role() in ('admin','member'), false)
$$;

create or replace function public.has_role() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.app_role() in ('admin','member','freelancer'), false)
$$;

-- Ids de collaborators que correspondem ao usuario logado (email, ou nome == email).
create or replace function public.my_collaborator_ids() returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.collaborators
  where lower(email) = public.jwt_email() or lower(name) = public.jwt_email()
$$;

-- Vincula user_roles.user_id ao criar a linha so se o e-mail ja existir em auth.users.
create or replace function public.user_roles_link_user() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.user_id is null then
    select id into new.user_id from auth.users where lower(email) = lower(new.email);
  end if;
  return new;
end $$;
drop trigger if exists trg_user_roles_link on user_roles;
create trigger trg_user_roles_link before insert on user_roles for each row execute function public.user_roles_link_user();

-- ---------------------------------------------------------------- criacao de usuario pelo admin
-- Substitui auth.signUp no cliente: o cadastro publico fica desligado (DISABLE_SIGNUP).
create or replace function public.admin_create_user(p_email text, p_password text, p_role text)
returns uuid language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role not in ('admin','member','freelancer') then raise exception 'invalid role'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;
  if length(coalesce(p_password,'')) < 8 then raise exception 'password too short (min 8)'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'user already exists'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());

  insert into public.user_roles (email, role, user_id) values (v_email, p_role, v_id)
  on conflict (email) do update set role = excluded.role, user_id = excluded.user_id;
  return v_id;
end $$;

-- Dados publicos minimos do cliente para o formulario de briefing (substitui select anon em clients).
create or replace function public.get_public_client(p_id uuid)
returns table (id uuid, name text, color text, logo_url text)
language sql stable security definer set search_path = public, pg_temp as $$
  select c.id, c.name, c.color, c.logo_url from public.clients c where c.id = p_id
$$;

revoke all on function public.admin_create_user(text,text,text) from public, anon;
grant execute on function public.admin_create_user(text,text,text) to authenticated;
revoke all on function public.get_public_client(uuid) from public;
grant execute on function public.get_public_client(uuid) to anon, authenticated;
revoke all on function public.app_role(), public.is_admin(), public.is_staff(), public.has_role(), public.my_collaborator_ids() from public, anon;
grant execute on function public.app_role(), public.is_admin(), public.is_staff(), public.has_role(), public.my_collaborator_ids(), public.jwt_email() to authenticated;

-- ---------------------------------------------------------------- RLS: remove policies abertas
do $$ declare t text; r record; begin
  foreach t in array array['user_roles','settings','clients','collaborators','materials','files','briefings',
    'kanban_columns','kanban_cards','kanban_comments','notifications','todo_boards','todo_items','link_previews'] loop
    execute format('alter table %I enable row level security', t);
    for r in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on %I', r.policyname, t);
    end loop;
  end loop;
end $$;

-- anon: so o minimo (settings leitura p/ logo do login, insert de briefing). Nada mais.
revoke all on all tables in schema public from anon;
grant select on settings to anon;
grant insert on briefings to anon;

-- user_roles
create policy ur_select on user_roles for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy ur_write  on user_roles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- settings / clients / collaborators: leitura por qualquer papel, escrita admin
create policy settings_anon_read on settings for select to anon using (true);
create policy settings_read  on settings for select to authenticated using (true);
create policy settings_write on settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy clients_read   on clients for select to authenticated using (public.has_role());
create policy clients_write  on clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy collab_read    on collaborators for select to authenticated using (public.has_role());
create policy collab_write   on collaborators for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- materiais e arquivos: qualquer papel (freelancer finaliza cards)
create policy materials_all on materials for all to authenticated using (public.has_role()) with check (public.has_role());
create policy files_all     on files     for all to authenticated using (public.has_role()) with check (public.has_role());

-- briefings: anon so insere pendente e com tamanhos limitados; equipe le/atualiza
create policy briefings_anon_insert on briefings for insert to anon with check (
  status = 'pending' and client_id is not null
  and length(coalesce(title,'')) <= 200 and length(coalesce(description,'')) <= 10000
  and length(coalesce(contact,'')) <= 200 and length(coalesce(protocol,'')) <= 64
  and jsonb_array_length(coalesce(files,'[]')) <= 20);
create policy briefings_staff on briefings for all to authenticated using (public.has_role()) with check (public.has_role());

-- kanban
create policy kcols_read  on kanban_columns for select to authenticated using (public.has_role());
create policy kcols_write on kanban_columns for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy kcards_select on kanban_cards for select to authenticated using (
  public.is_staff() or (public.app_role() = 'freelancer' and collaborator_id in (select public.my_collaborator_ids())));
create policy kcards_insert on kanban_cards for insert to authenticated with check (
  public.is_staff() or (public.app_role() = 'freelancer' and collaborator_id in (select public.my_collaborator_ids())));
create policy kcards_update on kanban_cards for update to authenticated
  using (public.is_staff() or (public.app_role() = 'freelancer' and collaborator_id in (select public.my_collaborator_ids())))
  with check (public.is_staff() or (public.app_role() = 'freelancer' and collaborator_id in (select public.my_collaborator_ids())));
create policy kcards_delete on kanban_cards for delete to authenticated using (public.is_staff());

-- comentarios: visiveis se o card e visivel (RLS do card se aplica no subselect); editar/apagar so autor ou admin
create policy kcom_select on kanban_comments for select to authenticated using (exists (select 1 from kanban_cards k where k.id = card_id));
create policy kcom_insert on kanban_comments for insert to authenticated with check (
  lower(user_email) = public.jwt_email() and exists (select 1 from kanban_cards k where k.id = card_id));
create policy kcom_update on kanban_comments for update to authenticated
  using (lower(user_email) = public.jwt_email() or public.is_admin())
  with check (lower(user_email) = public.jwt_email() or public.is_admin());
create policy kcom_delete on kanban_comments for delete to authenticated using (lower(user_email) = public.jwt_email() or public.is_admin());

-- notificacoes: cada um ve/marca as suas; qualquer papel cria (card movido, mencao)
create policy notif_select on notifications for select to authenticated using (lower(user_email) = public.jwt_email());
create policy notif_update on notifications for update to authenticated using (lower(user_email) = public.jwt_email()) with check (lower(user_email) = public.jwt_email());
create policy notif_delete on notifications for delete to authenticated using (lower(user_email) = public.jwt_email());
create policy notif_insert on notifications for insert to authenticated with check (public.has_role());

-- to-do: quadros so do dono; itens privados so do dono; quadro padrao (board_id nulo) compartilhado
create policy tboards_owner on todo_boards for all to authenticated
  using (public.has_role() and lower(owner_email) = public.jwt_email())
  with check (public.has_role() and lower(owner_email) = public.jwt_email());
create policy titems_all on todo_items for all to authenticated
  using (public.has_role() and (
    (board_id is null and (coalesce(is_private,false) = false or lower(owner_email) = public.jwt_email()))
    or board_id in (select id from todo_boards where lower(owner_email) = public.jwt_email())))
  with check (public.has_role() and (
    (board_id is null and (coalesce(is_private,false) = false or lower(owner_email) = public.jwt_email()))
    or board_id in (select id from todo_boards where lower(owner_email) = public.jwt_email())));

create policy lp_all on link_previews for all to authenticated using (public.has_role()) with check (public.has_role());

-- ---------------------------------------------------------------- Storage
update storage.buckets set
  file_size_limit = 52428800,
  allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/avif','image/heic','image/heif',
    'video/mp4','video/quicktime','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm',
    'application/pdf','application/zip','application/octet-stream','text/plain','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'uploads';

-- Sem policy de SELECT para anon/public: a URL publica (/object/public) continua servindo, mas o bucket nao pode ser listado.
drop policy if exists uploads_read on storage.objects;
drop policy if exists uploads_auth_write on storage.objects;
drop policy if exists uploads_anon_briefings on storage.objects;
drop policy if exists uploads_staff_select on storage.objects;
drop policy if exists uploads_staff_write on storage.objects;
drop policy if exists uploads_staff_update on storage.objects;
drop policy if exists uploads_staff_delete on storage.objects;
create policy uploads_staff_select on storage.objects for select to authenticated using (bucket_id = 'uploads' and public.has_role());
create policy uploads_staff_write  on storage.objects for insert to authenticated with check (bucket_id = 'uploads' and public.has_role());
create policy uploads_staff_update on storage.objects for update to authenticated using (bucket_id = 'uploads' and public.is_staff()) with check (bucket_id = 'uploads' and public.is_staff());
create policy uploads_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'uploads' and public.is_staff());
create policy uploads_anon_briefings on storage.objects for insert to anon with check (bucket_id = 'uploads' and name like 'briefings/%');

-- Realtime: notifications ja esta publicada; RLS filtra por dono.
