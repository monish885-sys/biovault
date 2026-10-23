#!/usr/bin/env bash
# Build demo stack, record TerraVault product tour via Playwright, publish video assets.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GATEWAY_PORT="${GATEWAY_PORT:-8080}"
export API_PORT="${API_PORT:-4000}"
export MONGODB_URI="${MONGODB_URI:-mongodb://127.0.0.1:27017/sentinel-demo}"
export REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379}"
export STAGING_PATH="${STAGING_PATH:-$ROOT/staging-demo}"
export SESSION_SECRET="${SESSION_SECRET:-demo-video-session-secret-32chars}"
export SEARCH_TOKEN_SECRET="${SEARCH_TOKEN_SECRET:-demo-video-search-secret-32chars}"
export DOWNLOAD_TOKEN_SECRET="${DOWNLOAD_TOKEN_SECRET:-demo-video-download-secret-32c}"
export DEMO_MODE="${DEMO_MODE:-true}"
export NODE_ENV="${NODE_ENV:-production}"
export TAPE_ADAPTER="${TAPE_ADAPTER:-sim}"
export DEMO_URL="http://127.0.0.1:${GATEWAY_PORT}"

VIDEO_DIR="$ROOT/docs/gtm/demo-video"
MARKETING_VIDEO_DIR="$ROOT/apps/marketing/public/demo-video"
API_PID=""
GATEWAY_PID=""

log() { echo "[terravault-demo] $*"; }

cleanup() {
  if [[ -n "$GATEWAY_PID" ]] && kill -0 "$GATEWAY_PID" 2>/dev/null; then
    kill "$GATEWAY_PID" 2>/dev/null || true
  fi
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

mkdir -p "$STAGING_PATH" "$VIDEO_DIR" "$MARKETING_VIDEO_DIR"

log "Installing Playwright Chromium (if needed)…"
pnpm exec playwright install chromium 2>/dev/null || true

log "Building packages & apps…"
pnpm --filter @biovault/common build >/dev/null
pnpm --filter @biovault/contracts build >/dev/null
pnpm --filter @biovault/sentinel-api build >/dev/null
VITE_BASE_PATH=/client/ VITE_DEMO_MODE=true VITE_API_URL= pnpm --filter @biovault/client-portal build >/dev/null
VITE_BASE_PATH=/admin/ VITE_DEMO_MODE=true VITE_API_URL= pnpm --filter @biovault/admin-portal build >/dev/null
pnpm --filter @biovault/marketing build >/dev/null

log "Migrating & seeding demo data…"
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed

if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
  log "API already running on :${API_PORT}"
else
  log "Starting API on :${API_PORT}…"
  PORT="$API_PORT" pnpm --filter @biovault/sentinel-api start &
  API_PID=$!
  for _ in $(seq 1 45); do
    curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

if curl -sf "http://127.0.0.1:${GATEWAY_PORT}/" >/dev/null 2>&1; then
  log "Gateway already running on :${GATEWAY_PORT}"
else
  log "Starting gateway on :${GATEWAY_PORT}…"
  PORT="$GATEWAY_PORT" node deploy/local-gateway.mjs &
  GATEWAY_PID=$!
  for _ in $(seq 1 20); do
    curl -sf "http://127.0.0.1:${GATEWAY_PORT}/health" >/dev/null 2>&1 && break
    sleep 1
  done
fi

curl -sf "http://127.0.0.1:${GATEWAY_PORT}/health" >/dev/null || {
  log "ERROR: Demo stack failed to start"
  exit 1
}

log "Recording product demo video (1920×1080)…"
rm -rf "$VIDEO_DIR/.playwright-output"
DEMO_URL="$DEMO_URL" pnpm exec playwright test --config playwright.demo.config.ts

# Playwright saves video next to test output on context close
RECORDED="$(find "$VIDEO_DIR/.playwright-output" -name "*.webm" -type f 2>/dev/null | head -1)"
if [[ -z "$RECORDED" ]]; then
  RECORDED="$(find test-results -name "*.webm" -type f 2>/dev/null | head -1)"
fi

if [[ -z "$RECORDED" || ! -f "$RECORDED" ]]; then
  log "ERROR: No video file produced — check Playwright output above"
  exit 1
fi

cp "$RECORDED" "$VIDEO_DIR/terravault-product-demo.webm"
cp "$RECORDED" "$MARKETING_VIDEO_DIR/terravault-product-demo.webm"
log "Published: $VIDEO_DIR/terravault-product-demo.webm"

if command -v ffmpeg >/dev/null 2>&1; then
  FFMPEG_BIN="ffmpeg"
elif [[ -x "$HOME/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac" ]]; then
  FFMPEG_BIN="$HOME/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac"
elif [[ -x "$HOME/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac-arm64/ffmpeg" ]]; then
  FFMPEG_BIN="$HOME/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac-arm64/ffmpeg"
elif [[ -x "$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux/ffmpeg" ]]; then
  FFMPEG_BIN="$HOME/.cache/ms-playwright/ffmpeg-1011/ffmpeg-linux/ffmpeg"
fi

if [[ -n "${FFMPEG_BIN:-}" ]]; then
  log "Converting to MP4 for LinkedIn…"
  "$FFMPEG_BIN" -y -i "$VIDEO_DIR/terravault-product-demo.webm" \
    -c:v libx264 -crf 23 -pix_fmt yuv420p \
    "$VIDEO_DIR/terravault-product-demo.mp4" 2>/dev/null
  cp "$VIDEO_DIR/terravault-product-demo.mp4" "$MARKETING_VIDEO_DIR/terravault-product-demo.mp4"
  log "Published: $VIDEO_DIR/terravault-product-demo.mp4"
else
  log "ffmpeg not found — webm only (run: pnpm exec playwright install ffmpeg)"
fi

log "Done. Demo URLs:"
log "  Landing:  $DEMO_URL/"
log "  Client:   $DEMO_URL/client/"
log "  Admin:    $DEMO_URL/admin/"
log "  Video:    $DEMO_URL/demo-video/terravault-product-demo.webm (after gateway static mount)"
