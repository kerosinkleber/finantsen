#!/usr/bin/env bash
# Prüft eine Sicherung, ohne die echte Datenbank anzufassen: spielt sie in eine Wegwerf-Datenbank zurück und
# vergleicht die Zeilenzahlen wichtiger Tabellen mit der Quelle.
#   scripts/restore-check.sh <dump-Datei> <Quell-DATABASE_URL> <Admin-URL-ohne-Datenbankname>
# Beispiel (lokal):  scripts/restore-check.sh backup.dump postgres://u:p@localhost:5432/finantsen postgres://u:p@localhost:5432
set -euo pipefail
dump="$1"; src="$2"; base="${3%/}"
scratch="finantsen_restore_check_$$"
trap 'psql "$base/postgres" -qc "drop database if exists $scratch" >/dev/null' EXIT
psql "$base/postgres" -qc "create database $scratch" >/dev/null
pg_restore -d "$base/$scratch" --no-owner "$dump"
ok=1
for t in users groups expenses expense_shares payments recovery_codes passkeys; do
  a=$(psql "$src" -Atc "select count(*) from $t")
  b=$(psql "$base/$scratch" -Atc "select count(*) from $t")
  printf '%-18s Quelle=%s Wiederherstellung=%s\n' "$t" "$a" "$b"
  [ "$a" = "$b" ] || ok=0
done
[ "$ok" = 1 ] && echo "Wiederherstellung OK" || { echo "ABWEICHUNG" >&2; exit 1; }
