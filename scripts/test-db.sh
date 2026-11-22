#!/usr/bin/env bash
# Runs the gym database schema and its access rule tests against a throwaway local Postgres.
# Needs the Postgres server binaries (initdb, pg_ctl). GitHub ubuntu runners and most Linux boxes have them.
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$BIN/initdb" ] || { echo "Postgres server binaries not found. Set PG_BIN."; exit 1; }
DIR="$(mktemp -d)"
PORT="${PG_TEST_PORT:-55432}"
RUN=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DIR"; RUN=(runuser -u postgres --); fi
cleanup() { "${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"; }
trap cleanup EXIT
"${RUN[@]}" "$BIN/initdb" -D "$DIR/data" -U postgres -A trust >/dev/null
"${RUN[@]}" "$BIN/pg_ctl" -D "$DIR/data" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" -w start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f supabase/gym/test/stub.sql
"${PSQL[@]}" -f supabase/gym/schema.sql
"${PSQL[@]}" -o /dev/null -f supabase/gym/test/rls.sql
echo "Database tests passed."
