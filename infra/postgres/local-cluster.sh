#!/usr/bin/env bash
# Levanta un clúster PostgreSQL local SIN Docker (para entornos donde Docker no está disponible).
# Uso: infra/postgres/local-cluster.sh start|stop|status   (puerto 54329; superusuario "postgres" sin contraseña por socket TCP local)
# Salida: URL de administración en SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:54329/postgres
set -euo pipefail
BIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
DATA="${SIFCA_PG_DATA:-/tmp/sifca-pgdata}"
PORT="${SIFCA_PG_PORT:-54329}"
run() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
case "${1:-status}" in
  start)
    if [ ! -d "$DATA/base" ]; then
      mkdir -p "$DATA"; [ "$(id -u)" = 0 ] && chown postgres:postgres "$DATA"
      run "$BIN/initdb -D '$DATA' -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"
    fi
    run "$BIN/pg_ctl -D '$DATA' -o '-p $PORT -k /tmp -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off' -l '$DATA/server.log' -w start" >/dev/null
    echo "SIFCA_TEST_PG_ADMIN_URL=postgresql://postgres@127.0.0.1:$PORT/postgres" ;;
  stop) run "$BIN/pg_ctl -D '$DATA' -m fast stop" ;;
  status) run "$BIN/pg_ctl -D '$DATA' status" ;;
esac
