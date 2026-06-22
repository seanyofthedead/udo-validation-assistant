# AWS_FUTURE_STATE.md — Backend + Frontend Target Architecture

> MVP ships as a deterministic, mock‑data React SPA with no backend (see `SPEC.md`).
> This document is the **future state**: how the Headquarters‑Led Risk‑Based UDO Review
> Platform runs on AWS GovCloud once a sandbox and data access exist. It is a target to design
> toward, **not** part of the MVP build. The engines are written as pure functions precisely
> so they move server‑side with no rewrite.
>
> Updated (2026‑06) for the platform vision: risk scoring, review campaigns, component
> collaboration, executive analytics, and enterprise data integration.

Maps to discovery: data residency hard constraint (1.17), DHS‑network‑resident design (Phase 9
security), modular multi‑agent reasoning (1.19), CSV/JSON + custom APIs (1.16), phased data
maturity (1.9, 2.10–2.11).

---

## 1. Guiding constraints (carried)

- **No data egress.** All obligation/ERP data stays inside the DHS AWS boundary (GovCloud). Model reasoning only via an in‑boundary service (**Amazon Bedrock** in GovCloud).
- **No auto‑posting** to any system of record; human‑in‑the‑loop preserved in every phase.
- **Immutable audit trail** for every AI + human action; exportable. Now spans validations, risk scores, campaigns, assignments, responses, escalations, and de‑ob dispositions.
- **Role‑based access:** component vs HQ analyst vs campaign manager vs leadership vs auditor.
- **Data lineage** from portfolio KPI down to source line + ingestion timestamp.
- **Portability** — the reasoning core runs in‑browser today and must run identically as Lambda/container.

## 2. Future‑state pipeline (the platform's spine)

```
   Data Sources           (CFO Horizons, ERP, component submissions, historical reviews, financial reporting)
        │
        ▼
   Risk Scoring           (deterministic risk engine + Bedrock policy reasoning; produces ranked review-worthiness)
        │
        ▼
   Review Campaigns       (HQ scopes population, assigns to components, sets due dates)
        │
        ▼
   Component Responses     (components concur / contest / correct, with evidence)
        │
        ▼
   HQ Validation           (analysts validate responses against evidence; escalations fire)
        │
        ▼
   Executive Reporting     (portfolio KPIs, component scorecards, de-obligation rollups, forecasts)
```

Every stage writes to the audit log and preserves lineage to the prior stage.

## 3. Target architecture (AWS GovCloud)

```
                       ┌─────────────────────────────────────────────┐
   Browser (SPA)  ───► │ CloudFront ──► S3 (static React build)       │  frontend
                       └─────────────────────────────────────────────┘
        │  authenticated calls (HTTPS, Cognito JWT, role-scoped)
        ▼
   ┌──────────────┐   ┌───────────────────────────────────────────────┐
   │ API Gateway  │──►│ Service layer (Lambda / ECS Fargate)          │  backend
   └──────────────┘   │  • Ingestion + normalization                  │
        │             │  • Validation engine        (from src/domain) │
        │             │  • Risk Scoring service      (§4.1)           │
        │             │  • Campaign Management service (§4.2)         │
        │             │  • Component Collaboration service (§4.3)     │
        │             │  • Executive Analytics service (§4.4)         │
        │             │  • Portfolio Reporting service (§4.5)         │
        │             │  • Multi-agent QC (creator + checker)         │
        │             │  • Bedrock for policy reasoning / extraction  │
        │             └───────────────────────────────────────────────┘
        │                  │              │                 │
        ▼                  ▼              ▼                 ▼
   ┌──────────┐    ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
   │ Cognito  │    │ RDS Postgres │ │ S3 (evidence,│ │ Enterprise Data  │
   │ (authz,  │    │ (UDOs, risk, │ │ CRG corpus,  │ │ Integration Layer│
   │  roles)  │    │ campaigns,   │ │ exports) +   │ │ (§4.7): CFO      │
   └──────────┘    │ responses,   │ │ OpenSearch / │ │ Horizons, ERP,   │
                   │ dispositions,│ │ Bedrock KB   │ │ Advana feeds     │
                   │ audit, lineage)│ (RAG)        │ │ via Glue/Step Fns│
                   └──────────────┘ └──────────────┘ └──────────────────┘
```

## 4. Platform services (new for the evolved vision)

### 4.1 Risk Scoring Services
Hosts the deterministic risk engine (`SPEC.md §5.1`) as a stateless service; recomputes scores
on ingestion or on demand. Bedrock optionally enriches policy‑based factors, but the
deterministic layer remains authoritative and explainable. Persists `RiskScore` + `riskFactors`
with lineage to the inputs that produced them.

### 4.2 Campaign Management Services
CRUD + state machine for campaigns (Draft → Active → Closing → Closed), population selection
(including "top N by risk" from §4.1), assignment generation, and due‑date/SLA tracking. Emits
assignment events to components and audit events throughout.

### 4.3 Component Collaboration Services
Receives component responses (concur/contest/correct + evidence), manages
Assigned→In Progress→Submitted state, and routes submissions back to HQ validation. Enforces
mandatory reasons and evidence attachment; writes lineage from response → assignment → campaign.

### 4.4 Executive Analytics Services
Aggregates across components and campaigns into portfolio KPIs, component scorecards, and trend
series. Read‑optimized (materialized views / cached aggregates). Drill‑down resolves any KPI to
its contributing lines.

### 4.5 Portfolio‑Level Reporting
Generates department‑wide reports and exports (CSV/JSON now; later scheduled distributions and
custom APIs to TIER/CFO Horizons). De‑obligation rollups report freed budget authority.

### 4.6 Cross‑Component Review Workflows
Orchestrates reviews that span components (e.g., a department‑wide quarter‑end sweep): fan‑out
of assignments, consolidated progress, and consolidated escalation into leadership visibility.

### 4.7 Enterprise Data Integration Layer
Ingestion from source systems via Glue/Step Functions into the normalized model. Each ingested
record carries source system + ingestion timestamp for lineage. Designed so MVP mock fixtures
and real feeds satisfy the same schema.

## 5. Data sources (future integration assumptions — mocked in MVP)

| Source | Provides | MVP stand‑in |
|---|---|---|
| **CFO Horizons** | Transaction‑level obligation/disbursement data | seed fixtures |
| **ERP systems** | Authoritative obligation records, mods | seed fixtures |
| **Historical UDO reviews** | Prior dispositions, prior‑year populations | `PriorYearStat` mock |
| **Component submissions** | Component‑reported statuses + evidence | mock responses |
| **Financial reporting data** | TIER / reporting feeds for reconciliation | mock KPIs |

Until these mature (discovery 1.9, 2.11), the platform operates on component submissions +
mock data; the risk engine runs over whatever population is available.

## 6. Migration path (incremental, each step shippable)

1. **Extract the engines.** Move `src/domain` (validation + risk + staleness + anomaly) into a shared `@udo/engine` package imported by both SPA and a Node service. No logic change.
2. **Stand up the API.** API Gateway + Lambda: `/validate`, `/risk`, `/campaigns`, `/assignments`, `/responses`, `/analytics`, `/audit`, `/export`. Frontend swaps in‑memory calls for fetches behind a feature flag.
3. **Persist.** RDS Postgres for all entities + append‑only audit + lineage tables. Seed with the same fixtures to preserve parity with MVP tests.
4. **Auth + roles.** Cognito (or DHS SSO/SAML); gate screens and routes by the five personas.
5. **Real documents.** S3 for evidence; Textract for extraction; replace mock evidence flags with extracted values.
6. **Real policy reasoning.** Introduce Bedrock (Claude) for CRG reasoning and abstention, with the deterministic engines retained as the verification/guardrail layer so behavior stays explainable and testable.
7. **Enterprise feeds.** Wire the Enterprise Data Integration Layer (§4.7) to CFO Horizons/Advana; the platform now runs over real populations, not just submissions.
8. **Forecasting (L5).** Add predictive drawdown models as an advisory layer feeding Executive Analytics; always labeled as projections.

## 7. Why the MVP makes this cheap
- Engines are **pure + framework‑free** → lift into Lambda unchanged.
- The data model in `SPEC.md` is the **same schema** RDS will use; new entities (RiskScore, Campaign, Assignment, Response, Escalation, DeobOpportunity) are designed in from the start.
- "Never auto‑post," human‑in‑the‑loop, and immutable audit are built in from day one → no retrofit for the security review.
- Deterministic engines don't disappear when Bedrock arrives; they become the **guardrail** that keeps the LLM explainable and auditable.

## 8. Open items to confirm before the AWS build (discovery Phase 8 + evolved)
- GovCloud account + DHS‑network sandbox availability and timeline (1.11).
- Bedrock (Claude) availability/authorization in the target boundary.
- Real CRG document name/owner/version for the knowledge base (A‑2).
- Official UDO status taxonomy + evidence definitions (drives validation **and** risk factors).
- Risk‑factor weighting sign‑off with SMEs (A‑4).
- Component/HQ org model + assignment granularity for campaigns (A‑5).
- CFO Horizons / Advana timeline for transaction‑level data (2.11 / A‑6).
