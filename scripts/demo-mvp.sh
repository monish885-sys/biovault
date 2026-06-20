#!/usr/bin/env bash
# BioVault Sentinel MVP demo — full ingest → retrieval → audit loop
# Requires: API + Mongo + Redis running, db:seed completed
set -euo pipefail

API="${API_URL:-http://localhost:4000}"
COOKIES="/tmp/sentinel-demo.cookies"
ADMIN_COOKIES="/tmp/sentinel-demo-admin.cookies"
FIXTURE="${FIXTURE:-tests/e2e/fixtures/demo-file.bin}"

echo "=== BioVault Sentinel MVP Demo ==="
echo "API: $API"
echo

# Health check
echo "→ Health check"
curl -sf "$API/health" | jq -r '.status // .'
echo

# Seed fixture if missing
if [[ ! -f "$FIXTURE" ]]; then
  mkdir -p "$(dirname "$FIXTURE")"
  dd if=/dev/urandom of="$FIXTURE" bs=1M count=1 status=none 2>/dev/null || \
    head -c 1048576 /dev/urandom > "$FIXTURE"
  echo "→ Created 1MB demo fixture at $FIXTURE"
fi

# 1. Client login
echo "→ Client login (admin@acme.test)"
curl -sf -c "$COOKIES" -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@acme.test","password":"ChangeMe123!"}' | jq -r '.user.email'
echo

# 2. Ingest upload
echo "→ Upload ingest package"
JOB=$(curl -sf -b "$COOKIES" -X POST "$API/api/v1/ingest/jobs" \
  -F 'category=imaging' \
  -F "files=@${FIXTURE};filename=demo-scan-001.dcm")
JOB_ID=$(echo "$JOB" | jq -r '.job.id')
echo "  Job ID: $JOB_ID"
echo

# 3. Poll until sealed
echo "→ Waiting for ingest seal (tape write + verify)..."
for i in $(seq 1 60); do
  STATUS=$(curl -sf -b "$COOKIES" "$API/api/v1/ingest/jobs/$JOB_ID" | jq -r '.job.status')
  echo "  [$i] status=$STATUS"
  if [[ "$STATUS" == "sealed" ]]; then break; fi
  if [[ "$STATUS" == "failed" ]]; then echo "Ingest failed"; exit 1; fi
  sleep 2
done
[[ "$STATUS" == "sealed" ]] || { echo "Timeout waiting for seal"; exit 1; }
echo

# 4. Ingest report + certificate
echo "→ Ingest report"
curl -sf -b "$COOKIES" "$API/api/v1/ingest/jobs/$JOB_ID/report" | jq '{fileCount: .report.fileCount, totalBytes: .report.totalBytes, sealedAt: .report.sealedAt}'
echo "→ Ingest certificate"
curl -sf -b "$COOKIES" "$API/api/v1/ingest/jobs/$JOB_ID/certificate" | jq -r '.certificate.pdfSha256'
echo

# 5. Search
echo "→ Client search (demo-scan)"
SEARCH=$(curl -sf -b "$COOKIES" "$API/api/v1/search/files?q=demo-scan")
FILE_ID=$(echo "$SEARCH" | jq -r '.files[0].id')
echo "  File ID: $FILE_ID"
echo

# 6. Request retrieval
echo "→ Request retrieval"
RETR=$(curl -sf -b "$COOKIES" -X POST "$API/api/v1/retrieval/jobs" \
  -H 'Content-Type: application/json' \
  -d "{\"fileId\":\"$FILE_ID\"}")
RETR_ID=$(echo "$RETR" | jq -r '.job.id')
echo "  Retrieval job: $RETR_ID (dueAt: $(echo "$RETR" | jq -r '.job.dueAt'))"
echo

# 7. Admin login + complete
echo "→ Admin login (tech@biovault.test)"
curl -sf -c "$ADMIN_COOKIES" -X POST "$API/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"tech@biovault.test","password":"ChangeMe123!"}' | jq -r '.user.role'
echo

echo "→ Assign → start → complete retrieval"
curl -sf -b "$ADMIN_COOKIES" -X PATCH "$API/api/v1/admin/jobs/$RETR_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"assigned"}' > /dev/null
curl -sf -b "$ADMIN_COOKIES" -X PATCH "$API/api/v1/admin/jobs/$RETR_ID" \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}' > /dev/null
COMPLETE=$(curl -sf -b "$ADMIN_COOKIES" -X POST "$API/api/v1/admin/jobs/$RETR_ID/complete")
DOWNLOAD_URL=$(echo "$COMPLETE" | jq -r '.job.downloadUrl')
echo "  Download URL issued"
echo

# 8. Client download
echo "→ Client download via signed URL"
curl -sf -o /tmp/sentinel-demo-download.bin "$API$DOWNLOAD_URL"
BYTES=$(wc -c < /tmp/sentinel-demo-download.bin | tr -d ' ')
echo "  Downloaded $BYTES bytes"
echo

# 9. Audit export
echo "→ Client audit export"
curl -sf -b "$COOKIES" "$API/api/v1/audit/export" | jq '{eventCount: (.events | length), chainValid}'
echo

# 10. Billing summary (Day 15)
echo "→ Billing summary"
curl -sf -b "$COOKIES" "$API/api/v1/billing/summary" | jq '{storageTb: .summary.storageTb, retrievalsUsed: .summary.retrievalsUsed, retrievalsIncluded: .summary.retrievalsIncluded, estimatedMonthlyInr: .summary.estimatedMonthlyInr}'
echo

echo "=== Demo complete ==="
echo "Portals: client http://localhost:5173 | admin http://localhost:5174"
