-- PandaReports: schema completo (derivado do uso em src/). Idempotente.
create extension if not exists pgcrypto;

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role text not null default 'member' check (role in ('admin','member','freelancer')),
  created_at timestamptz default now()
);
create table if not exists settings (key text primary key, logo_url text, updated_at timestamptz default now());
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null, seg text, resp text, color text, logo_url text,
  created_at timestamptz default now()
);
create table if not exists collaborators (
  id uuid primary key default gen_random_uuid(),
  name text not null, role text, email text, created_at timestamptz default now()
);
create table if not exists materials (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  collaborator_id uuid references collaborators(id) on delete set null,
  description text, type text, date date default current_date,
  created_at timestamptz default now()
);
create table if not exists files (
  id uuid primary key default gen_random_uuid(),
  material_id uuid references materials(id) on delete cascade,
  url text not null, name text, file_type text, created_at timestamptz default now()
);
create table if not exists briefings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  protocol text, title text, type text, description text, deadline date, contact text,
  ref_links jsonb default '[]', files jsonb default '[]',
  status text default 'pending', created_at timestamptz default now()
);
create table if not exists kanban_columns (
  id uuid primary key default gen_random_uuid(),
  label text not null, color text, position int default 0, created_at timestamptz default now()
);
create table if not exists kanban_cards (
  id uuid primary key default gen_random_uuid(),
  column_id uuid references kanban_columns(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  collaborator_id uuid references collaborators(id) on delete set null,
  finalized_material_id uuid references materials(id) on delete set null,
  title text not null, description text, attachments jsonb default '[]',
  position int default 0, created_at timestamptz default now()
);
create table if not exists kanban_comments (
  id uuid primary key default gen_random_uuid(),
  card_id uuid references kanban_cards(id) on delete cascade,
  user_email text not null, content text not null, created_at timestamptz default now()
);
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_email text not null, type text, title text, body text,
  card_id uuid references kanban_cards(id) on delete cascade,
  read boolean default false, created_at timestamptz default now()
);
create table if not exists todo_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null, owner_email text not null, created_at timestamptz default now()
);
create table if not exists todo_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references todo_boards(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  title text not null, day_of_week int, task_time text, week_date date,
  is_recurring boolean default false, is_private boolean default false, owner_email text,
  completed boolean default false, position int default 0, created_at timestamptz default now()
);
create table if not exists link_previews (
  url text primary key, title text, description text, image text, fetched_at timestamptz default now()
);

insert into settings (key) values ('system_logo'),('login_bg_image'),('favicon') on conflict do nothing;
insert into kanban_columns (label,color,position)
  select * from (values ('A fazer','#6366f1',0),('Em andamento','#f59e0b',1),('Revisão','#8b5cf6',2),('Concluído','#10b981',3)) v
  where not exists (select 1 from kanban_columns);

-- RLS: autenticados acessam tudo (equivalente ao comportamento atual, mas sem anon);
-- anon so le clients e insere briefings (pagina publica de briefing).
do $$ declare t text; begin
  foreach t in array array['user_roles','settings','clients','collaborators','materials','files','briefings',
    'kanban_columns','kanban_cards','kanban_comments','notifications','todo_boards','todo_items','link_previews'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists auth_all on %I', t);
    execute format('create policy auth_all on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
drop policy if exists anon_read_clients on clients;
create policy anon_read_clients on clients for select to anon using (true);
drop policy if exists anon_read_settings on settings;
create policy anon_read_settings on settings for select to anon using (true);
drop policy if exists anon_insert_briefings on briefings;
create policy anon_insert_briefings on briefings for insert to anon with check (true);

-- Realtime
do $$ begin
  begin alter publication supabase_realtime add table notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table kanban_cards; exception when others then null; end;
end $$;

-- Storage: bucket publico 'uploads'
insert into storage.buckets (id,name,public) values ('uploads','uploads',true) on conflict (id) do nothing;
drop policy if exists uploads_read on storage.objects;
create policy uploads_read on storage.objects for select to public using (bucket_id='uploads');
drop policy if exists uploads_auth_write on storage.objects;
create policy uploads_auth_write on storage.objects for all to authenticated using (bucket_id='uploads') with check (bucket_id='uploads');
drop policy if exists uploads_anon_briefings on storage.objects;
create policy uploads_anon_briefings on storage.objects for insert to anon with check (bucket_id='uploads' and name like 'briefings/%');
