-- Rodar no SQL Editor do Supabase (projeto ovuvykctdwugnzqmzueu)

-- Campos novos no todo_items
alter table todo_items add column if not exists is_private boolean default false;
alter table todo_items add column if not exists owner_email text;

-- Link previews cache (24h)
create table if not exists link_previews (
  url text primary key,
  title text,
  description text,
  image text,
  fetched_at timestamp default now()
);
alter table link_previews disable row level security;

-- E-mail do colaborador: necessario para @mencoes e notificacoes (card_moved/comment)
-- resolverem um user_email real. A tabela collaborators so tinha (id, name, role,
-- created_at) — sem isso, notificacoes endereçadas a um colaborador nunca
-- encontrariam o usuario correspondente em user_roles.
alter table collaborators add column if not exists email text;

-- Registros de settings usados pela tela de Configuracoes (upload de logo/imagem
-- de login usa upsert com onConflict: 'key', entao isso so garante que a linha
-- exista desde o inicio; o valor real e preenchido no primeiro upload).
insert into settings (key) values ('system_logo') on conflict (key) do nothing;
insert into settings (key) values ('login_bg_image') on conflict (key) do nothing;

-- Multiplos quadros de To-Do (ex: "Equipe" compartilhado + quadros pessoais do
-- admin, tipo "Financeiro", "Projeto X"). board_id nulo = quadro padrao "Equipe"
-- (mesmo comportamento de antes, nenhum dado existente precisa migrar).
create table if not exists todo_boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  created_at timestamp default now()
);
alter table todo_boards disable row level security;

alter table todo_items add column if not exists board_id uuid references todo_boards(id);
