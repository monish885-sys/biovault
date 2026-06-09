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

# Portals (Day 12–13)
pnpm dev:client   # http://localhost:5173 — search, request, tracker
pnpm dev:admin    # http://localhost:5174 — job queue, SLA, complete retrieval
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

## Environment variables

Copy `deploy/.env.example` to `deploy/.env` (or export for local dev).

| Variable | Required | When | Purpose |
|----------|----------|------|---------|
| `MONGODB_URI` | Yes | Day 1 | Metadata DB connection |
| `REDIS_URL` | Yes | Day 1 | BullMQ job queue |
| `SESSION_SECRET` | Yes | Day 2 | httpOnly session cookie signing (32+ random bytes in prod) |
| `SEARCH_TOKEN_SECRET` | Yes | Day 5+ | HMAC key for filename/keyword search tokens (separate from session secret) |
| `STAGING_PATH` | Yes | Day 3 | Transient file staging on disk (`./staging` local) |
| `TAPE_ADAPTER` | Yes | Day 4 | `sim` (default), `mtx`, or `scalar` when hardware adapters land |
| `CORS_ORIGINS` | Yes | Day 2 | Client/admin portal origins (comma-separated) |
| `PORT` | No | Day 1 | API port (default `4000`) |
| `LOG_LEVEL` | No | Day 1 | `info` / `debug` / … |
| `VITE_API_URL` | Portals only | Day 12 | API base URL for Vite dev proxies |

**No third-party API keys** are required for Phase 1 MVP through Day 14 (no AWS, Stripe, SendGrid, etc. in scope).

### Secrets by sprint day

| Day | You must provide |
|-----|------------------|
| **1** | Docker; `MONGODB_URI`, `REDIS_URL` (Compose defaults OK locally) |
| **2** | `SESSION_SECRET` — generate: `openssl rand -hex 32` |
| **3–4** | `STAGING_PATH` writable directory |
| **5** | `SEARCH_TOKEN_SECRET` — generate: `openssl rand -hex 32` (must differ from `SESSION_SECRET`) |
| **6–10** | Same stack; no new secrets |
| **11** | `CERT_SIGNING_KEY_PATH` (optional — dev auto-generates Ed25519 in `STAGING_PATH`) |
| **12–13** | Portals proxy `/api` in dev; set `VITE_API_URL` for production builds |
| **14 (prod)** | Strong secrets for all of the above; real `TAPE_ADAPTER=mtx\|scalar` on ingest workstation |

Seeded login (after `db:seed`): `admin@acme.test` / `ChangeMe123!`

## Ingest end-to-end (local)

Requires API + Mongo + Redis + worker (API starts ingest worker automatically).

```bash
# 1. Infrastructure + seed
docker compose -f deploy/docker-compose.yml --env-file deploy/.env.example up -d mongo redis
export SESSION_SECRET=dev-secret SEARCH_TOKEN_SECRET=dev-search STAGING_PATH=./staging
pnpm --filter @biovault/sentinel-api db:migrate
pnpm --filter @biovault/sentinel-api db:seed
pnpm dev:api

# 2. Login
curl -s -c /tmp/sentinel.cookies -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acme.test","password":"ChangeMe123!"}' | jq

# 3. Upload file (streams to STAGING_PATH; enqueues tape write+verify)
curl -s -b /tmp/sentinel.cookies -X POST http://localhost:4000/api/v1/ingest/jobs \
  -F 'category=imaging' \
  -F 'files=@./README.md;filename=scan-001.dcm' | jq

# 4. Poll job until status=sealed (worker runs write → read-back verify → purge staging)
JOB_ID=<id-from-step-3>
curl -s -b /tmp/sentinel.cookies "http://localhost:4000/api/v1/ingest/jobs/$JOB_ID" | jq '.job.status'

# 5. Ingest confirmation report (sealed jobs only)
curl -s -b /tmp/sentinel.cookies "http://localhost:4000/api/v1/ingest/jobs/$JOB_ID/report" | jq
```

Pipeline: **upload → index (Mongo metadata) → BullMQ tape write → SHA-256 read-back → job `sealed` → ingest staging purged**. Tape blocks remain under `STAGING_PATH/tape-sim/` until retrieval purge (Day 9).

## 14-day sprint

See KT plan todos in `docs/KT-phase1.md` (Day 1–2 ✅). **Day 3:** ingest intake + SHA-256.

**Slip rule:** Drop billing and onboarding polish first; never drop checksum verify or audit log.

## Security reminders

- No file content in MongoDB or public API responses
- Client search must not expose tape barcode / rack / slot
- Retrieved files: `STAGING_PATH` + expiring download links only

## License

Private — BioVault / Project Sentinel.
