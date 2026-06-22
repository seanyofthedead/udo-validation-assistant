# UDO Platform Evolution Strategy

> Companion to `SPEC.md`, `IMPLEMENTATION_PLAN.md`, `AWS_FUTURE_STATE.md`, and `CLAUDE.md`.
> Explains the _why_ behind the phasing from a validation assistant to a department‑wide
> review platform. (2026‑06)

## Current state

A shipped Phase 1 MVP: an **AI‑powered UDO Status Validation Assistant** — a deterministic,
mock‑data React SPA that validates individual UDO statuses (Valid / Questionable /
Insufficient‑Evidence with confidence and a cited rule), flags de‑obligation candidates with an
estimated recoverable amount, enforces human‑in‑the‑loop dispositions with mandatory reasons,
and records an immutable, exportable audit trail. Built and verified across Waves 0–4.

## Future vision

An **AI‑powered, Headquarters‑Led, Risk‑Based UDO Review Platform**: DHS OCFO identifies which
UDOs deserve attention, coordinates component reviews, validates responses, prioritizes
de‑obligation opportunities, and gets department‑wide executive visibility — with explainability,
auditability, and human control preserved at every step.

## Strategic drivers

1. **Volume.** Components report thousands of UDOs; validating every record doesn't scale. HQ needs to know _which_ deserve review — hence risk‑based prioritization.
2. **HQ‑led coordination.** Value comes from HQ tasking components and validating what comes back, not from isolated record checks — hence campaigns and component collaboration.
3. **Budget recovery.** Stale‑obligation identification and de‑obligation are high‑value, dollar‑denominated outcomes leadership can report.
4. **Executive accountability.** Leadership needs defensible, department‑wide visibility and a clean audit story.
5. **Data maturity.** CFO Horizons / enterprise transaction data are future‑state inputs; the platform must be ready to consume them without redesign.
6. **Trust constraints.** Human‑in‑the‑loop, explainability, auditability, and traceability are non‑negotiable and shape every phase.

## Capability maturity model

### Level 1 — Validation Assistant _(shipped)_

- **Users:** UDO Analysts.
- **Capabilities:** record‑level status validation; de‑ob candidate flagging; dispositions; audit/export.
- **Data:** mock UDO records + evidence; mock CRG ruleset.
- **Success metrics:** golden path passes; exceptions surfaced with cited reasons; zero confident‑wrong (abstains instead).

### Level 2 — Risk‑Based Review _(Wave 5)_

- **Users:** HQ Analysts, Campaign Managers.
- **Capabilities:** explainable risk scoring; ranked high‑risk queue; stale‑obligation explorer.
- **Data:** + `RiskScore`/factors; richer seed spanning risk bands.
- **Success metrics:** analysts triage to a small high‑value set; every score factor‑attributable; queue drives selection.

### Level 3 — Review Campaign Management _(Waves 6–7)_

- **Users:** Campaign Managers, Component FMs, HQ Analysts.
- **Capabilities:** campaign creation + population selection; assignments + due dates; component responses with evidence; escalations; de‑ob lifecycle.
- **Data:** + Campaign, Assignment, Response, Escalation, DeobOpportunity; lineage across them.
- **Success metrics:** a campaign runs end‑to‑end; responses validated against evidence; overdue/contested items escalate; confirmed de‑ob dollars captured.

### Level 4 — Enterprise Oversight _(Wave 8)_

- **Users:** OCFO Leadership, Auditors.
- **Capabilities:** portfolio dashboards; component scorecards; de‑ob rollups; drill‑down to line + audit.
- **Data:** + aggregation/scorecard views; cross‑entity lineage.
- **Success metrics:** every KPI reconciles to source records; any number drills to its evidence and audit.

### Level 5 — Predictive Financial Management _(Wave 9)_

- **Users:** Leadership, Analysts.
- **Capabilities:** cross‑component analytics; advisory forecasting of staleness/drawdown.
- **Data:** + time‑series snapshots; `Forecast` with basis.
- **Success metrics:** forecasts deterministic + labeled projections with basis; cross‑component trends actionable.

## Multi‑wave roadmap (visual)

```
Phase 1 ──────────── Phase 2 ──── Phase 3 ─────────── Phase 4 ──────────────►
L1                   L2           L3                  L4            L5
Validation           Risk         Campaign Mgmt       Enterprise    Predictive
(Waves 0–4 ✅)       (Wave 5)     (Waves 6–7)         (Wave 8)      (Wave 9)

Record validation ─► Rank by risk ─► Task & validate ─► See it all ─► See what's coming
```

## Risks

- **Scope expansion** — platform vision is much larger than the validation MVP; mitigate by strict wave gating and "do not regress Phase 1."
- **Risk‑model trust** — wrong weights erode confidence; mitigate by deterministic, factor‑attributable scoring reviewed with SMEs before reliance (A‑4).
- **Data dependency** — full value needs CFO Horizons/Advana; mitigate by mock parity so the schema is ready (A‑6).
- **Org/workflow fit** — campaign/assignment granularity may not match how DHS actually tasks components (A‑5); validate before Wave 6 build.
- **Determinism erosion** — adding analytics/forecasting tempts non‑pure code; mitigate with the determinism guard test extended to all engines.
- **Audit/lineage completeness** — more entities means more to trace; mitigate by requiring audit + lineage in each new wave's acceptance criteria.

## Dependencies

- Wave 5 risk queue feeds Wave 6 population selection.
- Waves 6–7 produce the campaign/response data Wave 8 aggregates.
- Wave 8 portfolio history feeds Wave 9 forecasting.
- AWS build (any phase server‑side) depends on GovCloud sandbox + Bedrock authorization (`AWS_FUTURE_STATE.md §8`).
- Real CRG + official status/evidence taxonomy refine both validation and risk factors.

## Key decisions

- **Extend, don't replace.** Phase 1 stays intact; each phase wraps it. (Accepted.)
- **Deterministic engines throughout**, including risk and forecasting in the MVP, with model‑backed reasoning deferred to the AWS/Bedrock future state. (Accepted.)
- **Campaign as the unit of coordination** rather than ad‑hoc per‑record tasking. (Accepted.)
- **Mock parity with future data sources** so the schema doesn't churn when real feeds arrive. (Accepted.)

## Open questions

- What are the official UDO status values and the required evidence per status? (A‑2/A‑3)
- What risk factors and weights do SMEs endorse? (A‑4)
- At what granularity does HQ assign work to components — line, batch, funding type? (A‑5)
- When will transaction‑level data (CFO Horizons/Advana) be available? (A‑6)
- Who are the named role‑holders for each persona, and what are their access boundaries?
- What is the target cadence (quarter‑end? continuous?) that campaigns should model?
