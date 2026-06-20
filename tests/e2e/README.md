# E2E tests (Day 14)

Playwright flow per `docs/KT-phase1.md` E2E demo script:

1. Seed users (via `db:seed` before running)
2. Ingest → sim tape → verify → seal
3. Client search → retrieval request
4. Admin complete → client download → purge
5. Ingest confirmation PDF
6. Billing summary (Day 15)

## Run

```bash
# Prerequisites: Docker (mongo + redis), db:migrate, db:seed
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example up -d mongo redis
pnpm install
pnpm --filter @biovault/common build && pnpm --filter @biovault/contracts build
export SESSION_SECRET=dev-secret SEARCH_TOKEN_SECRET=dev-search STAGING_PATH=./staging
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed

# API-only demo (no browser)
pnpm demo

# Full Playwright E2E (starts dev servers if not running)
pnpm test:e2e
```

## API demo script

`scripts/demo-mvp.sh` — curl-based full loop for CI and ops demos.
