# BioVault Sentinel — public demo deployment

## Live demo (local machine + Cloudflare tunnel)

While your laptop is running the stack, the demo is reachable at a public URL:

```bash
# Terminal 1 — API + datastores
export SESSION_SECRET=$(openssl rand -hex 16)
export SEARCH_TOKEN_SECRET=$(openssl rand -hex 16)
export DOWNLOAD_TOKEN_SECRET=$(openssl rand -hex 16)
export STAGING_PATH=./staging DEMO_MODE=true
pnpm compose:up   # or local mongod + redis-server
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed
pnpm --filter @biovault/sentinel-api start

# Terminal 2 — gateway (marketing + portals + API proxy)
bash deploy/local-demo.sh   # builds static apps, starts gateway on :8080

# Terminal 3 — public URL (free, no account)
cloudflared tunnel --url http://127.0.0.1:8080
```

## Permanent hosting (recommended)

### Option A — Fly.io (full stack, free allowance)

```bash
fly auth login
fly apps create biovault-demo
fly volumes create biovault_data --region bom --size 1
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) \
  SEARCH_TOKEN_SECRET=$(openssl rand -hex 32) \
  DOWNLOAD_TOKEN_SECRET=$(openssl rand -hex 32) \
  CORS_ORIGINS=https://biovault-demo.fly.dev \
  PUBLIC_URL=https://biovault-demo.fly.dev
fly deploy
```

Custom domain (after you register biovault.in / .com / .ai):

```bash
fly certs add biovault.in
# Add DNS: CNAME @ → biovault-demo.fly.dev
```

### Option B — Render.com (one-click from GitHub)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/monish885-sys/biovault)

Uses `render.yaml` — Docker image with embedded MongoDB + Redis.

### Option C — Docker anywhere

```bash
docker build -f deploy/Dockerfile.production -t biovault-demo .
docker run -p 8080:8080 \
  -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e SEARCH_TOKEN_SECRET=$(openssl rand -hex 32) \
  -e DOWNLOAD_TOKEN_SECRET=$(openssl rand -hex 32) \
  biovault-demo
```

## URLs on single host

| Path | App |
|------|-----|
| `/` | Marketing / company page |
| `/client/` | Client portal demo |
| `/admin/` | Admin operations demo |
| `/api/v1/*` | Sentinel API |
| `/health` | Health check |

## Demo credentials

| Portal | Email | Password |
|--------|-------|----------|
| Client | admin@acme.test | ChangeMe123! |
| Admin | tech@biovault.test | ChangeMe123! |

## Custom domain (biovault.in)

1. Register the domain (`.in` ~₹400/yr, `.com` ~$12/yr — not free).
2. Point DNS to Fly/Render or use Cloudflare proxy.
3. Set `PUBLIC_URL` and `CORS_ORIGINS` to your domain.

Free alternatives without registration: `*.fly.dev`, `*.onrender.com`, `*.trycloudflare.com` (temporary).
