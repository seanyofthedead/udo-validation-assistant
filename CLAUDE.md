# CLAUDE.md — build rules for this repo

You are building the **UDO Review Platform**. Read `SPEC.md` (source of truth) and work
`IMPLEMENTATION_PLAN.md` top to bottom. Also see `docs/product-evolution-roadmap.md` for the
strategy behind the phasing.

## What this product is now
The product is **no longer solely a UDO validation tool**. It is evolving into a
**department‑wide, Headquarters‑led, risk‑based UDO review and management platform**:
identify which UDOs deserve attention → coordinate component reviews → validate responses →
prioritize de‑obligation → give leadership enterprise visibility.

Phase 1 (record‑level validation, Waves 0–4) is **shipped and must not regress**. Phases 2–4
(risk‑based review → component review management → enterprise command center) extend it.

## Evaluate every implementation decision against
- **Headquarters value** — does it help HQ find and prioritize what matters?
- **Component usability** — can a component FM act on it without friction?
- **Executive visibility** — does it roll up into defensible leadership views?
- **Audit readiness** — is the action traceable, explainable, and logged?
- **Scalability** — does it hold at department scale and move server‑side unchanged?

## Loop protocol (every iteration)
1. Open `IMPLEMENTATION_PLAN.md`; pick the **first unchecked** task (Wave 5+ now).
2. Implement only that task; write/extend its test.
3. Run `npm run gate` (typecheck + lint + build + test). Fix red before moving on.
4. Check the task's box; commit one task per commit.
5. Stop when the wave's acceptance criteria hold.

## Hard rules (global, all phases)
- **SPEC wins.** Re‑read it when unsure; change scope by editing SPEC first, never by drifting.
- **Do not modify completed Waves 0–4** in the plan; do not regress Phase 1 behavior or its tests.
- **Determinism.** No `Math.random()` / `Date.now()` / `new Date()` inside `src/domain`. All engines (validation, risk, escalation, forecast) are pure over inputs + explicit `asOfDate`. This is what lets the loop terminate and keeps outputs auditable.
- **Never auto‑post** to any system of record. The platform proposes; humans dispose.
- **Mandatory reason** on override, contest, correct, and de‑ob confirm/reject. **Abstain over confident‑wrong.**
- **Immutable audit trail** — append‑only; every AI output and human action logged, including risk scoring, campaign/assignment changes, responses, escalations, de‑ob dispositions.
- **Explainability** — every machine output carries its reasoning: verdicts → confidence + cited rule; risk scores → per‑factor contribution; forecasts → labeled projection + basis.
- **Data lineage** — surfaced values trace down to source lines/evidence (and, in future state, source system + ingestion time).
- **Never delete or weaken a test or a guardrail to go green.** Fix the implementation.
- Keep `src/domain` free of React imports.

## Federal financial management constraints
- Data residency: design as DHS‑network‑resident; no data egress (see `AWS_FUTURE_STATE.md`).
- Human‑in‑the‑loop is mandatory and non‑negotiable.
- Treat ULO as a synonym for UDO; label everything "UDO".
- CRG, status taxonomy, and evidence definitions are mocked until confirmed (SPEC §9 assumptions).

## Executive demonstration priorities
The platform exists to be demoed to OCFO leadership and SMEs. Favor work that makes the
golden‑path and per‑wave demo scenarios crisp: ranked risk queue, a launched campaign with
component responses, and a portfolio scorecard that drills to the line. Clarity over polish.

## Architecture (do not redesign)
`src/domain` (types + pure engines: validation, risk, escalation, forecast) · `src/data`
(mock fixtures) · `src/state` (store + reducers) · `src/export` (CSV/JSON) · `src/screens` ·
`src/components`. New entities: RiskScore, Campaign, Assignment, Response, Escalation,
DeobOpportunity, ComponentScorecard, Forecast — additive to the Phase 1 model.

## Stack
Vite + React + TypeScript SPA. Vitest + Testing Library + jsdom. No backend, no network, no API
key, no database in MVP. Session state in memory; export via Blob download.

## Commands
- `npm run dev` — serve
- `npm run gate` — typecheck + lint + build + test (the completion gate)
- `npm test` / `npm run test:run` — Vitest
- `npm run build` — production build (must exit 0)
