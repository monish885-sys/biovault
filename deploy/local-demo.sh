#!/usr/bin/env bash
# Local all-in-one demo gateway (no Docker) + optional Cloudflare quick tunnel
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PORT="${PORT:-8080}"
export API_PORT="${API_PORT:-4000}"
export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/sentinel}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export STAGING_PATH="${STAGING_PATH:-$ROOT/staging}"
export SESSION_SECRET="${SESSION_SECRET:-local-demo-session-secret-32chars}"
export SEARCH_TOKEN_SECRET="${SEARCH_TOKEN_SECRET:-local-demo-search-secret-32c}"
export DOWNLOAD_TOKEN_SECRET="${DOWNLOAD_TOKEN_SECRET:-local-demo-download-secret-32}"
export DEMO_MODE="${DEMO_MODE:-true}"
export NODE_ENV="${NODE_ENV:-production}"
export TAPE_ADAPTER="${TAPE_ADAPTER:-sim}"

log() { echo "[biovault-demo] $*"; }

mkdir -p "$STAGING_PATH"

if ! pgrep -x mongod >/dev/null 2>&1; then
  log "Starting MongoDB…"
  mkdir -p "$ROOT/.demo-data/mongo"
  mongod --dbpath "$ROOT/.demo-data/mongo" --bind_ip 127.0.0.1 --fork --logpath "$ROOT/.demo-data/mongod.log"
fi

if ! pgrep -x redis-server >/dev/null 2>&1; then
  log "Starting Redis…"
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379
fi

log "Building apps (if needed)…"
pnpm --filter @biovault/common build >/dev/null
pnpm --filter @biovault/sentinel-api build >/dev/null
VITE_BASE_PATH=/client/ VITE_DEMO_MODE=true VITE_API_URL= pnpm --filter @biovault/client-portal build >/dev/null
VITE_BASE_PATH=/admin/ VITE_DEMO_MODE=true VITE_API_URL= pnpm --filter @biovault/admin-portal build >/dev/null
pnpm --filter @biovault/marketing build >/dev/null

log "Migrating & seeding…"
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed

if ! curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
  log "Starting API on :${API_PORT}…"
  pnpm --filter @biovault/sentinel-api start &
  API_PID=$!
  for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

log "Starting gateway on :${PORT}…"
node deploy/local-gateway.mjs &
GATEWAY_PID=$!

sleep 2
log "Local demo ready: http://localhost:${PORT}"
log "  Marketing:  http://localhost:${PORT}/"
log "  Client:     http://localhost:${PORT}/client/"
log "  Admin:      http://localhost:${PORT}/admin/"

if command -v cloudflared >/dev/null 2>&1; then
  log "Opening Cloudflare quick tunnel (public URL)…"
  cloudflared tunnel --url "http://127.0.0.1:${PORT}" 2>&1 | tee "$ROOT/.demo-data/tunnel.log" &
  sleep 5
  grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$ROOT/.demo-data/tunnel.log" | head -1 || true
fi

wait $GATEWAY_PID
