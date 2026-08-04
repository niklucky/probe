#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/probe
mkdir -p backups
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
database=$(sed -n 's/^POSTGRES_DB=//p' .env)
user=$(sed -n 's/^POSTGRES_USER=//p' .env)
docker compose --env-file .env --env-file images.env -f compose.prod.yml \
  exec -T postgres pg_dump --format=custom --username "$user" "$database" \
  > "backups/postgres-${timestamp}.dump"
find backups -type f -name 'postgres-*.dump' -mtime +14 -delete
