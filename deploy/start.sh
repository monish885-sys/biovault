#!/usr/bin/env bash
set -euo pipefail

export PORT="${PORT:-8080}"
export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/sentinel}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export STAGING_PATH="${STAGING_PATH:-/staging}"
export NODE_ENV="${NODE_ENV:-production}"
export DEMO_MODE="${DEMO_MODE:-true}"
export SEED_ON_START="${SEED_ON_START:-true}"
export USE_EMBEDDED_DATASTORES="${USE_EMBEDDED_DATASTORES:-true}"

mkdir -p /data/db /staging /var/log/nginx /run/nginx
chmod 755 /run/nginx

log() { echo "[start] $*"; }

if [[ "${USE_EMBEDDED_DATASTORES}" == "true" ]]; then
  log "Starting MongoDB…"
  if id mongodb &>/dev/null; then
    chown -R mongodb:mongodb /data/db
    su -s /bin/bash mongodb -c "mongod --dbpath /data/db --bind_ip 127.0.0.1 --fork --logpath /var/log/mongod.log"
  else
    mongod --dbpath /data/db --bind_ip 127.0.0.1 --fork --logpath /var/log/mongod.log
  fi

  log "Starting Redis…"
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379

  for _ in $(seq 1 45); do
    if mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | grep -q 1; then
      log "MongoDB ready"
      break
    fi
    sleep 1
  done
fi

cd /app/api

if [[ "${SEED_ON_START}" == "true" ]]; then
  log "Running migrations…"
  node dist/db/migrate.js
  USER_COUNT=$(mongosh "mongodb://127.0.0.1:27017/sentinel" --quiet --eval "db.users.countDocuments()" 2>/dev/null | tr -d '[:space:]' || echo "0")
  if [[ "${USER_COUNT}" == "0" ]] || [[ "${FORCE_SEED:-false}" == "true" ]]; then
    log "Seeding demo data…"
    node dist/db/seed.js
  else
    log "Database already seeded (${USER_COUNT} users)"
  fi
fi

log "Starting API on :4000…"
node dist/index.js &
API_PID=$!

for _ in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:4000/health" >/dev/null 2>&1; then
    log "API ready"
    break
  fi
  sleep 1
done

log "Starting nginx on :${PORT}…"
envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
