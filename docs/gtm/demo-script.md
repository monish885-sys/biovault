# TerraVault — Product demo voiceover script

**Length:** ~3 minutes · **Format:** Screen recording + optional voiceover  
**Video file:** `docs/gtm/demo-video/terravault-product-demo.webm` (regenerate with `pnpm demo:record`)

---

## 0:00 — Opening (landing page)

> TerraVault is a managed offline archival vault for hospitals, pharma, and enterprises in India.
>
> We store legally required records on LTO-9 magnetic tape — air-gapped in a Tier-4 Hyderabad data centre — with a modern dashboard so your team can search, retrieve, and prove DPDPA compliance without exposing file bytes to the internet.

---

## 0:20 — Client portal login

> This is the client portal. Hospital staff sign in with role-based access — admins can request files; compliance officers can manage erasure requests.
>
> No tape barcodes or rack locations are ever shown here. Clients see only what they need: filenames, categories, and status.

---

## 0:40 — Vault overview

> The overview shows storage by record type — imaging, lab reports, clinical notes — all indexed online while the actual bytes sit offline on tape.

---

## 0:55 — Search

> Let's find a patient MRI from the archive. Search by patient ID, filename, or keyword — results come from the metadata index instantly, without loading every tape.

---

## 1:15 — Request retrieval

> One click creates a retrieval job. TerraVault commits to a fifteen-minute SLA — the client sees a live tracker with countdown.

---

## 1:30 — Operations portal

> Behind the scenes, our operations team sees the full picture: which tape, which rack, which slot. Assign, load the cartridge, copy to a secure staging area, and release a time-limited download link.

---

## 1:55 — Client download

> The client downloads through their portal. Staging is purged automatically after download or expiry — file content never sits on public-facing servers.

---

## 2:10 — DPDPA compliance

> For Right to Erasure under DPDPA, compliance officers submit a subject ID. TerraVault locates matching files across tapes, runs the degauss workflow, and issues a cryptographically signed deletion certificate — audit-ready for regulators.

---

## 2:35 — Tape health & billing

> Operations monitors tape fill percentage, write cycles, and health scores. Clients see transparent billing with savings versus cloud cold storage — no surprise egress fees on retrieval.

---

## 2:50 — Close + pilot CTA

> TerraVault Phase 1 is live in Hyderabad. We're onboarding three founding pilot partners — waived ingest fee, ninety-day pilot, full dashboard access.
>
> DM me or email hello@terravault.in for a walkthrough or pilot details.

---

## Recording tips

- Use **1080p** full-screen browser, zoom 100–110%  
- Hide OS notifications before `pnpm demo:record`  
- For LinkedIn: upload **MP4** (`terravault-product-demo.mp4`) with captions burned in or SRT  
- Pin the demo link in your LinkedIn featured section  
