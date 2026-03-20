#!/bin/sh
set -e

echo "============================================"
echo "  MCE Workspace — Docker Entrypoint"
echo "============================================"

# ---- Parse MySQL connection details from DATABASE_URL ----
# DATABASE_URL format: mysql://user:pass@host:port/dbname
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|mysql://([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|mysql://[^:]+:([^@]+)@.*|\1|')
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+)[:/].*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*@[^:]+:([0-9]+)/.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
DB_PORT=${DB_PORT:-3306}

echo "[Entrypoint] Waiting for MySQL at ${DB_HOST}:${DB_PORT}..."
MAX_RETRIES=30
RETRY_COUNT=0
until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[Entrypoint] ERROR: MySQL not reachable after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "[Entrypoint] MySQL not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done
echo "[Entrypoint] MySQL is ready!"

# ---- Create database if it doesn't exist ----
echo "[Entrypoint] Ensuring database '${DB_NAME}' exists..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" \
  -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null \
  || echo "[Entrypoint] WARNING: Could not create database (may already exist or insufficient privileges)"

# ---- Run database migrations ----
echo "[Entrypoint] Running database migrations..."
npx drizzle-kit migrate 2>&1 || {
  echo "[Entrypoint] WARNING: Migration failed — attempting drizzle-kit push as fallback..."
  npx drizzle-kit push 2>&1 || echo "[Entrypoint] WARNING: Push also failed — check DATABASE_URL"
}
echo "[Entrypoint] Migrations complete."

# ---- Start the application ----
echo "[Entrypoint] Starting MCE Workspace..."
exec node dist/index.js
