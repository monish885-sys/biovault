# TerraVault GTM kit — Phase 1

Assets for LinkedIn campaign, sales, and pilot onboarding.

## Files

| File | Purpose |
|------|---------|
| [demo-script.md](./demo-script.md) | Voiceover script for the product tour video |
| [pilot-offer.md](./pilot-offer.md) | 1-page Hyderabad pilot offer (send as PDF or paste in email) |
| [pricing-plans.md](./pricing-plans.md) | Multi-tier hospital pricing vs cloud & Iron Mountain |
| [pipeline-template.csv](./pipeline-template.csv) | CRM tracker for leads → paying clients |
| [demo-video/](./demo-video/) | Recorded product tour (`pnpm demo:record`) |

## Quick commands

```bash
# Record / refresh the product demo video (requires Mongo + Redis)
pnpm demo:record

# Local all-in-one sandbox for prospects
bash deploy/local-demo.sh

# Interactive demo credentials
# Client:  admin@acme.test / ChangeMe123!
# Ops:     tech@biovault.test / ChangeMe123!
```

## LinkedIn CTA ladder

1. **Soft:** Comment “DEMO” → send `demo-video/terravault-product-demo.mp4` + sandbox link  
2. **Medium:** Book 20-min walkthrough (Calendly)  
3. **Hard:** Attach `pilot-offer.md` → kickoff call within 7 days  

## Phase 1 targets (from KT)

- 3 paying clients in Hyderabad region  
- Zero churn in Phase 1  
- Known as DPDPA archival partner in healthcare/pharma  
