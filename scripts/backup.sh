#!/usr/bin/env bash
# Sicherung der Datenbank (Docker-Compose-Stack). Aufruf im Projektordner:
#   scripts/backup.sh [Zielordner]      (Standard: ./backups, behält die letzten 14 Sicherungen)
# Cron-Beispiel (täglich 03:15):  15 3 * * *  cd /pfad/zu/finantsen && scripts/backup.sh >> backups/backup.log 2>&1
# Wichtig: Zusätzlich APP_SECRET (.env) separat sicher aufbewahren. Ohne ihn sind TOTP-Einrichtungen nicht lesbar.
set -euo pipefail
cd "$(dirname "$0")/.."
dir="${1:-backups}"
compose="${COMPOSE_FILE_ARGS:-}"
mkdir -p "$dir"
out="$dir/finantsen-$(date +%Y-%m-%d_%H%M%S).dump"
# shellcheck disable=SC2086
docker compose $compose exec -T db pg_dump -U finantsen -Fc finantsen > "$out"
# Eine leere/abgebrochene Sicherung nie stehen lassen
[ -s "$out" ] || { rm -f "$out"; echo "Sicherung fehlgeschlagen" >&2; exit 1; }
ls -1t "$dir"/finantsen-*.dump | tail -n +15 | xargs -r rm -f
echo "OK: $out ($(du -h "$out" | cut -f1))"
