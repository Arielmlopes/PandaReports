#!/usr/bin/env bash
# Aplica supabase/migrations/*.sql ainda nao aplicados, em ordem, no Postgres do servidor (SSH + docker exec).
# Cada migration roda em UMA transacao (-1) e so e registrada em public.app_migrations se der certo.
# Antes de aplicar qualquer pendente, faz pg_dump (public+auth) em /opt/panda/backups.
# Uso: SSH_TARGET=user@host [SSH_OPTS="-i key"] [DB_CONTAINER=supabase-db] scripts/apply-migrations.sh
set -euo pipefail
: "${SSH_TARGET:?defina SSH_TARGET}"
DB="${DB_CONTAINER:-supabase-db}"
# shellcheck disable=SC2086
rsh() { ssh ${SSH_OPTS:-} "$SSH_TARGET" "$@"; }
psql_q() { rsh "docker exec -i $DB psql -U postgres -v ON_ERROR_STOP=1 -q -tA $*"; }

psql_q <<< "create table if not exists public.app_migrations (name text primary key, applied_at timestamptz default now());"

pending=()
for f in "$(dirname "$0")"/../supabase/migrations/*.sql; do
  n="$(basename "$f")"
  done_=$(psql_q <<< "select 1 from public.app_migrations where name='$n';")
  [ -z "$done_" ] && pending+=("$f")
done

if [ ${#pending[@]} -eq 0 ]; then echo "migrations: nada pendente"; exit 0; fi

ts=$(date +%Y%m%d-%H%M%S)
rsh "mkdir -p /opt/panda/backups && docker exec $DB pg_dump -U postgres -Fc -n public -n auth > /opt/panda/backups/pre-migrate-$ts.dump && chmod 600 /opt/panda/backups/pre-migrate-$ts.dump"
echo "backup: /opt/panda/backups/pre-migrate-$ts.dump"

for f in "${pending[@]}"; do
  n="$(basename "$f")"
  echo "aplicando $n"
  { cat "$f"; echo; echo "insert into public.app_migrations(name) values ('$n');"; } | rsh "docker exec -i $DB psql -U postgres -v ON_ERROR_STOP=1 -1 -q -o /dev/null"
done
echo "migrations: ok (${#pending[@]} aplicada(s))"
