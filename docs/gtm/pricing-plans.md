# TerraVault — Multi-tier pricing (India healthcare)

**Product:** Managed LTO-9 air-gapped archive + Sentinel Dashboard  
**Region:** India (Hyderabad first; multi-city DR optional)  
**Currency:** INR, exclusive of 18% GST  
**Effective:** July 2026 · **List prices** — founding pilots see [pilot-offer.md](./pilot-offer.md)

---

## Who each plan is for

| Plan | Hospital profile | Typical archive | Example customers |
|------|------------------|-----------------|-------------------|
| **Clinic** | Diagnostic lab, single-specialty clinic, 50–200 beds | 1–5 TB | Imaging lab, dental chain outlet, small IVF unit |
| **Community** | 200–500 bed hospital, one campus | 5–15 TB | Multi-specialty hospital, regional cancer centre |
| **Regional** | 500–1,000 beds or strong imaging volume | 15–60 TB | Private hospital chain (single city), large diagnostic network |
| **Enterprise** | 1,000+ beds, teaching hospital, multi-site | 60–150 TB | Teaching hospital, state private chain HQ archive |

---

## Plan summary (annual contract, billed monthly)

| | **Clinic** | **Community** | **Regional** | **Enterprise** |
|--|------------|---------------|--------------|----------------|
| **Archive included** | 3 TB | 12 TB | 50 TB | 100 TB |
| **List price / month** | **₹9,999** | **₹19,999** | **₹45,833** | **₹91,583** |
| **List price / year** | **₹1,19,988** | **₹2,39,988** | **₹5,49,996** | **₹10,98,996** |
| **Effective ₹/TB/mo** | ~₹3,333 | ~₹1,667 | ~₹917 | ~₹916 |
| **Retrievals included** | 5 / month | 12 / month | 25 / month | 40 / month |
| **LTO copies included** | 1 (Hyderabad) | 1 (Hyderabad) | 1 (Hyderabad) | 1 (Hyderabad) |
| **Compliance cert** | 1 / quarter | 1 / month | 2 / month | 4 / month |
| **Audit export** | 1 / year | 1 / quarter | 1 / month | 1 / month |
| **Ingest (first migration)** | ₹1,49,000 once | ₹2,99,000 once | ₹4,99,000 once | ₹7,99,000 once |
| **SLA** | 15 min retrieval† | 15 min retrieval† | 15 min retrieval† | 15 min retrieval† |

† Business hours (09:00–21:00 IST); 95% monthly target.

**Founding partner (pilot convert):** **40% off** list subscription for **12 months** after 90-day pilot. Ingest **50% off**.

---

## What’s included in every plan

- LTO-9 write → SHA-256 verify → air-gapped shelf storage  
- Online metadata index (search by patient ID, date, category — no tape location exposed to client)  
- Client + compliance portal; ops run by TerraVault  
- Immutable audit log  
- DPDPA Right to Erasure **workflow** (execution + certificate on paid tiers as above)  
- Tape health monitoring (fill %, write cycles, age)  
- Tier-4 colocation (Hyderabad) — climate-controlled vault  

**Not included:** Client’s EMR/PACS licensing, network bandwidth at client site, litigation support, media destruction at client premises.

---

## Add-ons (all plans)

| Add-on | Price | Notes |
|--------|-------|-------|
| **Extra storage** | **₹799/TB/month** | Billed on measured archive TB above plan cap |
| **Offsite mirror copy** | **₹699/tape/month** | Second physical copy (another city / vault zone); ~1 tape per 18 TB |
| **Extra retrieval** | **₹649/job** | After monthly bundle; one file/batch = one job |
| **Bulk retrieval** | **₹12/GB** | Optional cap for jobs &gt; 50 GB (min ₹2,999/job) |
| **Extra compliance certificate** | **₹999** each | Signed PDF (ingest summary, deletion proof, etc.) |
| **Extra audit export** | **₹999** each | Full `audit_events` export for regulators |
| **Expedited retrieval** | **₹1,499/job** | &lt; 60 min, subject to ops capacity |
| **Dedicated compliance review** | **₹24,999/quarter** | 2h review + written memo for DPDPA readiness |

---

## Overage rules (simple)

1. **Storage:** Daily measured TB (from indexed `sizeBytes`). Overage billed at **₹799/TB/month** pro-rata.  
2. **Retrievals:** Count = completed jobs (status `delivered` or `ready`). Pending/failed don’t bill.  
3. **Annual prepay:** **8% discount** on subscription (not on ingest or overages).  
4. **Minimum term:** 12 months after pilot; 90-day pilot can convert without ingest re-quote.

---

## Competitive position — why this beats cloud & Iron Mountain

### How we compare “apples to apples”

| Cost bucket | DIY cloud (Glacier-class) | Iron Mountain–class vault‡ | **TerraVault** |
|-------------|---------------------------|------------------------------|----------------|
| Storage $ | Low headline ₹/TB | High ₹/TB | Mid ₹/TB |
| Retrieval / egress | **Unpredictable** | Per-cart + fees | **Bundled jobs** |
| Compliance tooling | Build yourself | Limited self-service | **Included** |
| Air gap | No | Yes | **Yes** |
| India / DPDPA story | You assemble | Global vendor | **Purpose-built** |

‡Iron Mountain–class = managed physical offsite archive with handling (indicative India enterprise **~₹1,600–2,200/TB/month** all-in).

### Worked examples — **annual cost to hospital**

Assumptions: **8% of archive retrieved per year** (spread as monthly jobs), cloud = Glacier Deep Archive Mumbai + restore + **internet egress**, Iron = **₹1,800/TB/month** managed vault.

#### Clinic — 3 TB archive, ~250 GB retrieved/year (~3 jobs/mo)

| | Cloud equiv. | Iron Mountain | **TerraVault Clinic** |
|--|--------------|---------------|------------------------|
| Storage | ₹0.03 L | ₹0.65 L | (in plan) |
| Retrieval + egress | ₹0.08 L | ₹0.15 L | (in plan) |
| Platform + compliance FTE slice | ₹1.20 L | ₹0.40 L | (in plan) |
| **Total / year** | **~₹1.31 L** | **~₹1.20 L** | **₹1.20 L** list · **₹0.72 L** founding yr1 |
| **Winner** | | | **TerraVault** (founding) / **tie** at list with far more product |

#### Community — 12 TB archive, ~1 TB retrieved/year

| | Cloud equiv. | Iron Mountain | **TerraVault Community** |
|--|--------------|---------------|--------------------------|
| **Total / year** | **~₹3.4 L** | **~₹2.59 L** | **₹2.40 L** list · **₹1.44 L** founding yr1 |
| **Winner** | | | **TerraVault** |

#### Regional — 50 TB archive, ~4 TB retrieved/year

| | Cloud equiv. | Iron Mountain | **TerraVault Regional** |
|--|--------------|---------------|-------------------------|
| **Total / year** | **~₹5.8 L** | **~₹10.8 L** | **₹5.50 L** list · **₹3.30 L** founding yr1 |
| **Winner** | | | **TerraVault** (both list & founding vs cloud & Iron) |

#### Enterprise — 100 TB archive, ~8 TB retrieved/year

| | Cloud equiv. | Iron Mountain | **TerraVault Enterprise** |
|--|--------------|---------------|---------------------------|
| **Total / year** | **~₹12.0 L** | **~₹21.6 L** | **₹10.99 L** list · **₹6.59 L** founding yr1 |
| **Winner** | | | **TerraVault** (~8% under cloud list; **~49% under Iron**) |

> **Sales line:** “We’re priced **below your all-in cloud archive stack** and **well below Iron Mountain** — with **zero egress surprises** and a **DPDPA dashboard** included.”

---

## TerraVault unit economics (your profitability)

Indicative **gross margin** on **list** pricing after plan is running (shared colo, amortized library, 1 FTE : 8–12 clients).

| Plan | Revenue / yr | Est. COGS / yr† | **Gross margin** | Notes |
|------|--------------|-----------------|------------------|-------|
| Clinic | ₹1.20 L | ₹0.55 L | **~54%** | High ₹/TB; anchor for land-and-expand |
| Community | ₹2.40 L | ₹1.05 L | **~56%** | Sweet spot for Hyderabad ICP |
| Regional | ₹5.50 L | ₹2.35 L | **~57%** | Core profit engine |
| Enterprise | ₹10.99 L | ₹4.65 L | **~58%** | Amortizes first-library capex |

†COGS = colo rack share + LTO media refresh + retrieval labour (₹300/job internal) + platform + insurance slice.

### First-hospital capex (~₹25L) payback

Typical **first** deployment (80 TB capable): library + drives + ~5 tapes + ingest workstation + colo deposit + software.

| Client mix | Payback |
|------------|---------|
| 1× Enterprise @ list | **~18–24 months** |
| 1× Regional + 2× Community | **~14–18 months** |
| 3× Community | **~20–26 months** |

**Target:** land **Community or Regional** as second client within 6 months to pull blended payback **under 15 months**.

### Margin protections (don’t skip)

- Always charge **ingest** on first migration (waive only for pilot).  
- **Cap** bulk retrieval at ₹12/GB so 500 GB jobs don’t erase margin.  
- **Offsite mirror** at ₹699/tape is high-margin (extra media + slot, low touch).  
- **Annual prepay** improves cash; don’t discount overages.

---

## Plan selection guide (for sales)

```
Beds + imaging volume → archive TB in 3 years → pick plan one size up
```

| If they say… | Recommend |
|--------------|-----------|
| “We’re 150 beds, mostly PDF reports” | **Clinic** |
| “300 beds + CT/MRI, 5-year retention” | **Community** |
| “800 beds or 10+ modalities” | **Regional** |
| “Teaching hospital / 50+ TB today” | **Enterprise** |
| “Multi-city chain, 200+ TB” | **Enterprise** + offsite mirrors + custom SOW |

---

## Upgrade path

| From | To | Trigger |
|------|-----|---------|
| Clinic | Community | &gt; 3 TB sustained or &gt; 5 retrievals/mo for 3 months |
| Community | Regional | &gt; 12 TB or compliance wants monthly certs |
| Regional | Enterprise | &gt; 50 TB or chain HQ roll-up |

Upgrades: **pro-rata** plan difference; no re-ingest fee for indexed metadata.

---

## Legal & quoting notes

- Prices **exclude GST** (18%).  
- Archive TB = logical bytes ingested (SHA-256 measured), not compressed marketing TB.  
- Comparison tables use **indicative** cloud/Iron costs — cite “estimates per AWS Mumbai list + industry vault benchmarks” on proposals.  
- Custom SOW for **&gt; 150 TB** or **multi-tenant chain**: floor **₹850/TB/month** effective with **₹12L/year** minimum.

---

## Implementation backlog (align product to this doc)

| Item | File / module |
|------|----------------|
| Replace flat `TIER_LIMITS` with plan caps + base fee | `services/sentinel-api/src/modules/billing/tiers.ts` |
| Bill: base + storage overage + retrieval overage | `billing.service.ts` |
| Cloud comparison calculator (honest egress model) | Billing UI + API |
| Map `clients.tier` → `clinic \| community \| regional \| enterprise` | `schemas/client.ts` |

---

## Quick reference card

| Plan | /mo | /yr | TB | Retrievals/mo |
|------|-----|-----|-----|---------------|
| Clinic | ₹9,999 | ₹1.20 L | 3 | 5 |
| Community | ₹19,999 | ₹2.40 L | 12 | 12 |
| Regional | ₹45,833 | ₹5.50 L | 50 | 25 |
| Enterprise | ₹91,583 | ₹10.99 L | 100 | 40 |

**Add-ons:** +₹799/TB · +₹699/tape offsite · +₹649/retrieval · +₹999 cert/audit

---

*TerraVault · Managed offline archival · DPDPA-aligned · Hyderabad Tier-4*
