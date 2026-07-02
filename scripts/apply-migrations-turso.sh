#!/usr/bin/env bash
# Applies all Prisma migration SQL files to a Turso database, in order.
# Prisma Migrate cannot connect to remote libsql:// URLs, so migrations
# are applied through the Turso CLI instead.
#
# Usage: ./scripts/apply-migrations-turso.sh <turso-db-name>
# Requires: turso CLI installed and logged in (https://docs.turso.tech/cli)

set -euo pipefail

DB_NAME="${1:?Usage: $0 <turso-db-name>}"

for dir in prisma/migrations/*/; do
  sql="$dir/migration.sql"
  if [ -f "$sql" ]; then
    echo "Applying $(basename "$dir")..."
    turso db shell "$DB_NAME" < "$sql"
  fi
done

echo "All migrations applied to $DB_NAME."
