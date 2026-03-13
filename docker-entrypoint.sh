#!/bin/sh
set -e

echo "============================================"
echo "  MCE Ingestion Engine — Docker Entrypoint"
echo "============================================"

# ---- Wait for MySQL to be ready ----
echo "[Entrypoint] Waiting for MySQL..."
MAX_RETRIES=30
RETRY_COUNT=0
until node -e "
  const mysql = require('mysql2/promise');
  const url = process.env.DATABASE_URL;
  if (!url) { process.exit(1); }
  mysql.createConnection(url)
    .then(c => { c.end(); process.exit(0); })
    .catch(() => process.exit(1));
" 2>/dev/null; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ "$RETRY_COUNT" -ge "$MAX_RETRIES" ]; then
    echo "[Entrypoint] ERROR: MySQL not reachable after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "[Entrypoint] MySQL not ready yet (attempt $RETRY_COUNT/$MAX_RETRIES)..."
  sleep 2
done
echo "[Entrypoint] MySQL is ready!"

# ---- Run database migrations ----
echo "[Entrypoint] Running database migrations..."
npx drizzle-kit migrate 2>&1 || {
  echo "[Entrypoint] WARNING: Migration failed — attempting drizzle-kit push as fallback..."
  npx drizzle-kit push 2>&1 || echo "[Entrypoint] WARNING: Push also failed — check DATABASE_URL"
}
echo "[Entrypoint] Migrations complete."

# ---- Start the application ----
echo "[Entrypoint] Starting MCE Ingestion Engine..."
exec node dist/index.js
