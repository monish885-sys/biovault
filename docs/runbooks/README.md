# Operational runbooks

| Runbook | Status | File |
|---------|--------|------|
| Ingest (upload → index → tape → verify → shelf) | ✅ Day 14 | [ingest.md](./ingest.md) |
| Retrieval (15m SLA, staging link, purge) | ✅ Day 14 | [retrieval.md](./retrieval.md) |
| DPDPA Right to Erasure | ✅ Day 16 | [dpdpa-erasure.md](./dpdpa-erasure.md) |
| Tape swap / re-copy | TODO Phase 1 completion | — |
| Colo bootstrap (CtrlS) | Stub | `deploy/scripts/ctrls-bootstrap.sh` |

Reference: `docs/KT-phase1.md` §3.4, §5.3.
