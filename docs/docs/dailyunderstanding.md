# BioVault Sentinel: Fixed 14-Day Context Matrix

## 1. Core Identity & Constraint
- SYSTEM TYPE: Offline, air-gapped LTO-9 Tape Management Monolith (CtrlS Colocation Simulation).
- DATA LAW: Strictly compliant with the Indian DPDPA Framework (2026/2027 enforcement).
- CRITICAL BOUNDARY: Zero raw file bytes or buffers persist in MongoDB or public API memory. Files are processed as transient pipeline streams flowing strictly through a local `STAGING_PATH` directory.

## 2. Technical Stack Boundaries
- Backend: Node 22 (Strict ESM), Express 5, TypeScript 5.x.
- Database: MongoDB 7 (Mongoose schemas), Redis + BullMQ (For background tape jobs).
- Frontend: React 19, Vite, Tailwind CSS 4.
- Abstraction: `TapeLibraryAdapter` handles all operations. Simulator writes blocks to disk under `STAGING_PATH/tape-sim/`.

## 3. Scope Cut-Offs (Strictly Forbidden)
- NO DNA translation, AGCT encoding, or wet-lab biology software blocks.
- NO client-side cryptographic key distribution management.
- NO native AWS S3 or Azure Blob SDKs (Everything must wrap under `TapeLibraryAdapter`).