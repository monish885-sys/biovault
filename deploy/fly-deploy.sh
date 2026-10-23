#!/usr/bin/env bash
# BioVault Sentinel — one-shot Fly.io deploy
# Usage: bash deploy/fly-deploy.sh
set -euo pipefail

export FLYCTL_INSTALL="${FLYCTL_INSTALL:-$HOME/.fly}"
export PATH="$FLYCTL_INSTALL/bin:$PATH"

if ! command -v fly >/dev/null 2>&1; then
  echo "Installing flyctl…"
  curl -fsSL https://fly.io/install.sh | sh
  export PATH="$FLYCTL_INSTALL/bin:$PATH"
fi

cd "$(dirname "$0")/.."

echo "→ Checking Fly auth…"
if ! fly auth whoami >/dev/null 2>&1; then
  echo "Opening browser for Fly login (one-time)…"
  fly auth login
fi

echo "→ Fly user: $(fly auth whoami)"

APP="${FLY_APP_NAME:-biovault-demo}"
REGION="${FLY_REGION:-bom}"

if ! fly apps list 2>/dev/null | grep -q "^${APP}[[:space:]]"; then
  echo "→ Creating app ${APP}…"
  fly apps create "$APP" --yes || fly apps create "$APP"
fi

if ! fly volumes list -a "$APP" 2>/dev/null | grep -q biovault_data; then
  echo "→ Creating volume biovault_data in ${REGION}…"
  fly volumes create biovault_data --region "$REGION" --size 1 -a "$APP" --yes
fi

echo "→ Setting secrets…"
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  SEARCH_TOKEN_SECRET="$(openssl rand -hex 32)" \
  DOWNLOAD_TOKEN_SECRET="$(openssl rand -hex 32)" \
  CORS_ORIGINS="https://${APP}.fly.dev" \
  PUBLIC_URL="https://${APP}.fly.dev" \
  DEMO_MODE="true" \
  -a "$APP"

echo "→ Deploying (remote build, ~5–10 min)…"
fly deploy -a "$APP"

echo ""
echo "Done! Your demo should be live at:"
echo "  https://${APP}.fly.dev/"
echo "  https://${APP}.fly.dev/client/"
echo "  https://${APP}.fly.dev/admin/"
