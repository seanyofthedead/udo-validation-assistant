# AWS_FUTURE_STATE.md — Backend + Frontend Target Architecture

> MVP‑1 ships as a deterministic, mock‑data React SPA with no backend (see `SPEC.md`).
> This document is the **future state**: how to stand up a real backend and a hosted frontend
> on AWS once a sandbox and data access exist. It is a target to design toward, **not** part of
> the MVP‑1 build. The MVP‑1 engine is written as pure functions precisely so it can move
> server‑side later with no rewrite.

Maps to discovery doc: data residency hard constraint (1.17), DHS‑network‑resident design
(Phase 9 security), modular multi‑agent reasoning (1.19), CSV/JSON + custom APIs (1.16),
phased data maturity (1.9, 2.10–2.11).

---

## 1. Guiding constraints (carried from discovery)

- **No data egress.** All obligation/ERP data stays inside the DHS AWS boundary (GovCloud). No call‑outs to public model endpoints unless via an approved in‑boundary service (e.g. **Amazon Bedrock** in GovCloud).
- **No auto‑posting** to any system of record; human‑in‑the‑loop preserved.
- **Immutable audit trail** for every AI + human action; exportable.
- **Role‑based access:** component vs HQ vs leadership vs auditor.
- **Platform optionality** — keep the reasoning core portable (it currently runs in‑browser; it must run equally as a Lambda/container).

## 2. Target architecture (AWS GovCloud)

```
                       ┌─────────────────────────────────────────────┐
   Browser (SPA)  ───► │ CloudFront ──► S3 (static React build)       │  frontend
                       └─────────────────────────────────────────────┘
        │  authenticated calls (HTTPS, Cognito JWT)
        ▼
   ┌──────────────┐   ┌───────────────────────────────────────────────┐
   │ API Gateway  │──►│ Lambda / ECS Fargate  (the validation service) │  backend
   └──────────────┘   │  • ingestion + normalization                  │
        │             │  • validation engine  (ported from src/domain)│
        │             │  • staleness / de‑ob engine                   │
        │             │  • multi‑agent QC (creator + checker)         │
        │             │  • Bedrock for policy reasoning / doc extract │
        │             └───────────────────────────────────────────────┘
        │                       │                    │
        ▼                       ▼                    ▼
   ┌──────────┐         ┌──────────────┐     ┌──────────────────┐
   │ Cognito  │         │ RDS Postgres │     │ S3 (evidence +   │
   │ (authz)  │         │ (UDOs, finds,│     │ CRG corpus) +    │
   └──────────┘         │ dispositions,│     │ OpenSearch/      │
                        │ audit log)   │     │ Bedrock KB (RAG) │
                        └──────────────┘     └──────────────────┘
```

### Component mapping
| Concern | MVP‑1 (now) | AWS future state |
|---|---|---|
| Frontend hosting | local `vite dev` | **S3 + CloudFront**, same React build |
| Auth | none | **Cognito** (or DHS SSO/SAML), role‑based |
| API | none (in‑browser) | **API Gateway → Lambda** (or ECS Fargate for long jobs) |
| Validation engine | `src/domain` pure fns in browser | **same code** packaged for Node Lambda |
| Policy reasoning ("real AI") | deterministic rules | **Amazon Bedrock** (Claude) for CRG reasoning + document understanding, with rules as a deterministic guardrail layer |
| CRG knowledge base | mock `crgRules.ts` | **Bedrock Knowledge Base / OpenSearch** RAG over the real CRG |
| UDO + findings + audit | in‑memory | **RDS Postgres**; audit log append‑only (consider QLDB/ledger table) |
| Evidence + documents | mock flags | **S3** + Textract for extraction |
| Export / integration | Blob download | S3 presigned downloads + **custom APIs** to TIER / CFO Horizons later |
| Ingestion of transactions | n/a (submissions only) | **CFO Horizons / Advana** feed when mature (1.9, 2.11) |

## 3. Migration path (incremental, each step shippable)

1. **Extract the engine.** Move `src/domain` into a shared workspace package (`@udo/engine`) imported by both the SPA and a Node service. No logic change.
2. **Stand up the API.** API Gateway + Lambda exposing `POST /validate`, `GET /udos`, `POST /dispositions`, `GET /audit`, `POST /export`. Lambda calls `@udo/engine`. Frontend swaps its in‑memory calls for fetches behind a feature flag.
3. **Persist.** RDS Postgres for UDOs, findings, dispositions, and an append‑only audit table. Seed with the same fixtures to keep parity with MVP‑1 tests.
4. **Auth + roles.** Cognito; gate screens and API routes by role (component/HQ/leadership/auditor).
5. **Real documents.** S3 for evidence; Textract for extraction; replace mock evidence flags with extracted values.
6. **Real policy reasoning.** Introduce Bedrock (Claude) for CRG reasoning and abstention, **with the deterministic rules retained as a verification/guardrail layer** so behavior stays explainable and testable. The QC agent becomes a true creator+checker pair.
7. **Enterprise feed.** When CFO Horizons/Advana delivers transaction‑level data, add an ingestion path; the validator now runs over real populations, not just submissions.

## 4. Why MVP‑1 makes this cheap
- Engine is **pure + framework‑free** → lifts into Lambda unchanged.
- Data model in `SPEC.md §5` is the **same schema** RDS will use.
- Audit trail and "never auto‑post" are built in from day one → no retrofit for the security review.
- Deterministic rules don't disappear when Bedrock arrives; they become the **guardrail** that keeps the LLM explainable and auditable — exactly the explainability leadership probed for (1.13).

## 5. Open items to confirm before the AWS build (from discovery Phase 8)
- GovCloud account + DHS‑network sandbox availability and timeline (1.11).
- Bedrock (Claude) availability/authorization in the target boundary.
- Real CRG document name/owner/version for the knowledge base (A‑2).
- Official UDO status taxonomy + evidence definitions (drives the real ruleset).
- CFO Horizons / Advana timeline for transaction‑level data (2.11).
