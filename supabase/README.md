# Supabase

- `migrations/` — SQL em ordem. O deploy (`.github/workflows/deploy.yml`) aplica as pendentes antes de publicar o front
  via `scripts/apply-migrations.sh` (backup `pg_dump` em `/opt/panda/backups`, uma transação por migration,
  controle em `public.app_migrations`). Nunca edite uma migration ja aplicada: crie a proxima.
- `tests/rls-check.mjs` — valida as policies com usuarios reais (anon, sem papel, member, freelancer, admin).
  `BASE=https://host/supabase ANON=... SERVICE=... ADMIN_EMAIL=... ADMIN_PASS=... node supabase/tests/rls-check.mjs`
- Cadastro publico desligado (`DISABLE_SIGNUP=true` no `.env` do Supabase). Usuarios sao criados pelo admin em
  Configuracoes (RPC `admin_create_user`).
- `deploy/nginx-panda.conf` — headers/CSP e protecao dos uploads usados no nginx de producao.
