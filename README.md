# BioVault Sentinel (Phase 1)

Managed LTO-9 archival vault + **Sentinel Dashboard** — metadata and jobs online; tape bytes air-gapped offline.

Product context: [`docs/KT-phase1.md`](docs/KT-phase1.md)

## Stack

| Layer | Tech |
|-------|------|
| API | Node 22, Express 5, Mongoose, BullMQ (Redis) |
| DB | MongoDB 7 (metadata index only) |
| Portals | React 19, Vite, Tailwind 4 |
| Tape (dev) | `TapeSimulator` — swap via `TAPE_ADAPTER` |

## Quick start

```bash
# Prerequisites: Node 22+, pnpm 9+, Docker
pnpm install
pnpm --filter @biovault/common build
pnpm --filter @biovault/contracts build

# Infrastructure
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example up -d mongo redis

# Migrate / register schemas
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed

# API (terminal 1)
pnpm dev:api

# Portals (optional)
pnpm dev:client   # http://localhost:5173
pnpm dev:admin    # http://localhost:5174
```

Health check:

```bash
curl -s http://localhost:4000/health | jq
```

Login (after seed; cookie jar for follow-up calls):

```bash
curl -s -c /tmp/sentinel.cookies -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acme.test","password":"ChangeMe123!"}' | jq
curl -s -b /tmp/sentinel.cookies http://localhost:4000/api/v1/auth/me | jq
```

Full stack in Docker (API + Mongo + Redis):

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example up --build
```

## Repo layout

```
packages/common/       # errors, logger, correlation-id
packages/contracts/    # OpenAPI → TypeScript
services/sentinel-api/ # modular monolith (auth, ingest, search, …)
apps/client-portal/
apps/admin-portal/
deploy/                # docker-compose, .env.example
docs/daily/            # 6pm review logs
docs/runbooks/         # ops procedures (Day 14+)
```

## 14-day sprint

See KT plan todos in `docs/KT-phase1.md` (Day 1–2 ✅). **Day 3:** ingest intake + SHA-256.

**Slip rule:** Drop billing and onboarding polish first; never drop checksum verify or audit log.

## Security reminders

- No file content in MongoDB or public API responses
- Client search must not expose tape barcode / rack / slot
- Retrieved files: `STAGING_PATH` + expiring download links only

## License

Private — BioVault / Project Sentinel.
