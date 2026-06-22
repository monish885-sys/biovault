# BioVault Sentinel — MVP Flow (v0.1.0)

## System at a glance

```mermaid
flowchart TB
  subgraph Online["Online — Sentinel Dashboard"]
    CP[Client Portal :5173]
    AP[Admin Portal :5174]
    API[Sentinel API :4000]
    DB[(MongoDB — metadata only)]
    Q[Redis + BullMQ]
  end

  subgraph Offline["Offline — Air-gapped"]
    TAPE[LTO-9 Tape Simulator]
    SHELF[Tape on shelf — barcode / rack / slot]
  end

  CP --> API
  AP --> API
  API --> DB
  API --> Q
  Q --> TAPE
  TAPE --> SHELF
```

## Core loop (what happens today)

```mermaid
sequenceDiagram
  participant C as Client Portal
  participant A as API + Worker
  participant T as Tape (sim)
  participant O as Admin Portal

  Note over C,O: 1. INGEST
  C->>A: Upload file + category
  A->>A: SHA-256 index → MongoDB
  A->>T: Write block + verify read-back
  A->>C: Job sealed + PDF certificate

  Note over C,O: 2. SEARCH & RETRIEVE
  C->>A: Search metadata (no tape location)
  C->>A: Request retrieval
  O->>A: Assign → Start → Complete
  A->>T: Read from tape → staging
  C->>A: Signed download link
  A->>A: Purge staging after download

  Note over C,O: 3. COMPLIANCE
  C->>A: DPDPA erasure request
  O->>A: Confirm degauss
  A->>C: Signed deletion PDF
```

## Security boundary

| Online | Never online |
|--------|----------------|
| Filename, category, checksum, job status | File bytes on tape |
| Client search results | Tape barcode / rack / slot (client API) |
| Time-limited download URL | Permanent file storage in MongoDB |

**SLA:** Retrieval due in **15 minutes** · Unassigned alert at **60 seconds**
