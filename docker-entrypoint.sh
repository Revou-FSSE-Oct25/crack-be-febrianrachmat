#!/bin/sh
set -eu

echo "[docker-entrypoint] prisma migrate deploy..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-}" = "true" ]; then
  echo "[docker-entrypoint] RUN_DB_SEED=true -> prisma db seed"
  npx prisma db seed
fi

echo "[docker-entrypoint] node dist/main.js"
exec node dist/main.js
