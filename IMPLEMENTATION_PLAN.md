# IMPLEMENTATION_PLAN.md — UDO Review Platform

> The loop works this plan top to bottom. **Each iteration: pick the first unchecked task,
> implement it, write/extend its test, run the gate, check the box, commit.** SPEC.md wins ties.
>
> **Waves 0–4 are COMPLETE and are a historical record — do not modify them.** New work starts
> at Wave 5. Each new wave carries Objectives, Features, User stories, UX, Data, Technical,
> Dependencies, Demo scenario, and measurable Acceptance criteria.

Legend: `[x]` done · `[ ]` todo.

---

## ✅ COMPLETED — Phase 1 (Waves 0–4) — historical record, do not modify

- [x] **Wave 0 — Scaffold.** Vite + React + TS, Vitest harness, folder skeleton, determinism guard, gate command, CI.
- [x] **Wave 1 — Domain core.** Types; mock CRG ruleset; seed population; `validateStatus`; `qcCheck`; `flagDeobligation`; `priorYearAnomaly`; `runValidation` pipeline.
- [x] **Wave 2 — State + audit + export.** Store/reducer; override guard (mandatory reason); immutable audit log; CSV/JSON export.
- [x] **Wave 3 — Screens.** App shell + routing; UDO Inventory; UDO Detail + AI Findings; High‑Risk Queue; Review Workspace; Executive Dashboard; Reporting/Export.
- [x] **Wave 4 — Acceptance + polish.** Golden‑path integration test; edge states; README; final gate green.

Phase 1 definition of done held: `npm run gate` 0 failures, golden path passes, six screens render.

---

## Wave 5 — Risk‑Based UDO Prioritization (Phase 2)

**Objectives.** Move from "validate everything" to "validate what matters." Introduce an
explainable risk score and a ranked queue so analysts work the highest‑value lines first.

**Features.** Risk scoring engine · High‑Risk UDO Queue · prioritization dashboard widgets ·
review recommendations · Stale Obligation Explorer.

**User stories.**
- As a *UDO Analyst*, I want UDOs ranked by risk so I triage 3,000 lines down to the ~20 that matter.
- As a *Campaign Manager*, I want "top N by risk" selectable so I can scope a review quickly.
- As an *Auditor*, I want each score to show its contributing factors and points so prioritization is defensible.

**UX requirements.** Queue table with sortable `riskScore`, `riskBand` chip
(LOW/MEDIUM/HIGH/CRITICAL), top‑3 factors inline, dollar, age, verdict badge. Risk detail
panel breaks the score into factors with per‑factor contribution and plain‑language reason.
Filters: component, band, status, funding type, $ range, age.

**Data requirements.** Add `RiskScore { udoId, score (0–100), band, factors: {name, points,
reason}[], asOfDate }`. Extend seed so the population yields a spread across all four bands and
a clear top‑N. No change to Phase 1 entities.

**Technical requirements.** `scoreRisk(udo, finding, deobFlag, anomaly, asOfDate)` — pure,
deterministic, no wall‑clock/random; documented weighting with each factor's max points;
`scorePopulation()` returns sorted scores; emits an `AuditEvent` per scoring run. Engine lives
in `src/domain`, free of React.

**Dependencies.** Phase 1 validation, de‑ob, and anomaly engines (done).

**Demo scenario.** Load seed → population scored → queue ranks CRITICAL/HIGH to the top with
visible factors → analyst opens the top line and sees the score broken into factors → filter to
one component and one band narrows the list.

**Acceptance criteria (measurable).**
- `scoreRisk` unit tests cover each factor and a hand‑computed total; output deterministic across runs.
- Seed yields ≥1 CRITICAL, ≥2 HIGH, and a non‑empty LOW band (snapshot‑pinned).
- Queue sorts by score desc by default; each row shows band + ≥1 factor.
- Risk detail sums factor points to the displayed score (test‑asserted).
- `npm run gate` green; new tests added; Wave 5 boxes checked.

---

## Wave 6 — Headquarters Review Campaigns (Phase 3)

**Objectives.** Make the campaign the unit of coordination: scope a review, select a
population, assign to components, track to completion.

**Features.** Campaign creation/config · population selection (manual / saved filter / top‑N by
risk) · assignment tracking · due‑date & SLA management.

**User stories.**
- As a *Campaign Manager*, I want to create a campaign with an objective and period so a review has a clear scope.
- As a *Campaign Manager*, I want to assign slices to components and set due dates so responsibility is explicit.
- As *OCFO Leadership*, I want to see a campaign's overall completion so I know it's progressing.

**UX requirements.** Campaign list + create wizard (name, objective, period, population source,
assignments, due dates). Campaign detail with state badge (Draft/Active/Closing/Closed) and a
per‑component assignment progress table.

**Data requirements.** `Campaign { id, name, objective, period, state, createdBy, createdAt }`;
`Assignment { id, campaignId, component, udoIds[], dueDate, state }`. Lineage: assignment →
campaign. Each gets audit events on create/transition.

**Technical requirements.** Campaign state machine (pure reducer, unit‑tested transitions);
population selectors reuse the Wave 5 risk queue; no auto‑advance of state without a user action.

**Dependencies.** Wave 5 (risk queue powers "top‑N" selection); Phase 1 state/audit infra.

**Demo scenario.** Create "Q3 UDO Review" → select top 25 by risk → assign to USCG/TSA/FEMA →
set due dates → launch (Draft→Active) → campaign detail shows three assignments at 0%.

**Acceptance criteria (measurable).**
- Campaign reducer tests cover every legal transition and reject illegal ones.
- Creating a campaign from "top‑N by risk" produces assignments whose `udoIds` match the queue's top N.
- Campaign + assignment create/transition each append exactly one audit event (test‑asserted).
- `npm run gate` green; Wave 6 boxes checked.

---

## Wave 7 — Component Collaboration (Phase 3)

**Objectives.** Close the HQ→component→HQ loop: components respond with evidence; HQ validates;
exceptions escalate.

**Features.** Response submission (concur/contest/correct) · supporting documentation (mock
upload) · review status tracking · escalations · De‑Obligation Opportunity Tracker (lifecycle).

**User stories.**
- As a *Component FM*, I want to see my assigned lines and respond per line with a reason so my answer is defensible.
- As a *UDO Analyst (HQ)*, I want to validate responses against evidence so concurrence isn't rubber‑stamped.
- As a *Campaign Manager*, I want overdue/contested/high‑$ items to escalate so nothing stalls silently.

**UX requirements.** Component Response Workspace scoped to one component's assignments;
per‑line response control (concur / contest / corrected status + value), evidence attach,
mandatory reason on contest/correct, submit‑to‑HQ. Escalation banner on overdue/contested
items. De‑ob opportunity list with lifecycle state.

**Data requirements.** `Response { id, assignmentId, udoId, action: CONCUR|CONTEST|CORRECT,
correctedStatus?, reason (required unless CONCUR), evidenceRefs[], state }`;
`Escalation { id, udoId/assignmentId, trigger: OVERDUE|CONTESTED|HIGH_DOLLAR|MANUAL, level }`;
`DeobOpportunity { udoId, state: IDENTIFIED|UNDER_REVIEW|CONFIRMED|REJECTED, estimatedRecoverable,
disposition? }`. Lineage: response → assignment → campaign; de‑ob disposition → finding.

**Technical requirements.** Pure escalation rule fn (`evaluateEscalations(asOfDate)`); response
reducer enforces mandatory reason; de‑ob lifecycle reducer with human disposition + reason.
All state changes audited.

**Dependencies.** Wave 6 (assignments to respond to); Phase 1 disposition/audit discipline.

**Demo scenario.** Component opens its assignment → concurs on two, contests one (with reason +
evidence), corrects one status → submits → an overdue line auto‑escalates → HQ validates the
contested response → a stale line is confirmed as a de‑ob opportunity.

**Acceptance criteria (measurable).**
- Contest/correct with empty reason is rejected; concur needs none (tests).
- `evaluateEscalations` flags an overdue and a high‑$ item deterministically (tests).
- De‑ob lifecycle transitions require a reason on CONFIRM/REJECT and append audit events.
- `npm run gate` green; Wave 7 boxes checked.

---

## Wave 8 — Executive Visibility (Phase 4)

**Objectives.** Give leadership defensible department‑wide visibility with drill‑down to the
line and the audit trail.

**Features.** Executive dashboard suite · component scorecards · portfolio analytics ·
de‑obligation opportunity reporting.

**User stories.**
- As *OCFO Leadership*, I want a department scorecard (coverage, exceptions, de‑ob $) so I can see UDO health at a glance.
- As *OCFO Leadership*, I want per‑component scorecards so I can compare and direct attention.
- As an *Auditor*, I want to drill from any KPI to the lines and audit behind it.

**UX requirements.** Portfolio dashboard: department KPIs, component scorecard grid, campaign
completion, de‑ob $ rolled up, trend (using available snapshots). Every KPI is clickable to its
contributing lines; every line links to its audit trail.

**Data requirements.** Aggregation views over UDOs/findings/risk/campaigns/responses/de‑ob;
`ComponentScorecard { component, coverage, exceptionCount, deobDollars, riskMix }`. Lineage:
KPI → component → lines → evidence/audit.

**Technical requirements.** Pure aggregation functions over the in‑memory store; numbers must
reconcile to the underlying records (asserted). No new mutation paths — read‑mostly.

**Dependencies.** Waves 5–7 (risk, campaigns, responses, de‑ob).

**Demo scenario.** Leadership opens the portfolio view → sees coverage %, exception count, total
de‑ob $, and a scorecard per component → clicks the FEMA exception count → lands on FEMA's
exception lines → opens one line's audit trail.

**Acceptance criteria (measurable).**
- Each portfolio KPI equals the sum/aggregate of its source records (test‑asserted, no drift).
- Clicking a KPI navigates to exactly the contributing lines (RTL test).
- Component scorecard values reconcile to per‑component engine output.
- `npm run gate` green; Wave 8 boxes checked.

---

## Wave 9 — Enterprise Command Center (Phase 4 → L5)

**Objectives.** Department‑wide oversight at scale plus advisory forecasting — the L5
predictive step.

**Features.** Cross‑component analytics · department‑wide oversight console · predictive
drawdown/staleness forecasting · advanced portfolio management.

**User stories.**
- As *OCFO Leadership*, I want cross‑component trends and outliers so I can manage the portfolio, not just lines.
- As a *UDO Analyst*, I want a forecast of which obligations will likely go stale so I can act before quarter‑end.
- As an *Auditor*, I want forecasts labeled as projections with their basis so they're never mistaken for fact.

**UX requirements.** Command‑center console: cross‑component heatmap, top movers, forecast panel
clearly badged "Projection" with its inputs. Advanced filters and saved views.

**Data requirements.** Time‑series snapshots of portfolio state; `Forecast { udoId/component,
metric, projectedValue, horizon, basis }`. Lineage from forecast → inputs.

**Technical requirements.** Deterministic, explainable forecasting in MVP (e.g., trend/aging
extrapolation as a pure function with documented method) — no opaque ML in the mock build; the
function signature anticipates a future model‑backed implementation (see AWS future state §6.8).

**Dependencies.** Wave 8 (portfolio aggregates + history).

**Demo scenario.** Open command center → cross‑component heatmap highlights one component's
spike → forecast panel projects N stale obligations next quarter with the basis shown → drill to
the lines driving the projection.

**Acceptance criteria (measurable).**
- Forecast function is deterministic and its output reproduces its documented method on the seed (test).
- Forecast UI always shows the "Projection" label and the basis (RTL test).
- Cross‑component aggregates reconcile to Wave 8 outputs.
- `npm run gate` green; Wave 9 boxes checked.

---

## Verification (platform‑level, in addition to per‑wave)
- All Phase 1 tests still pass unchanged (no regression).
- New engines (risk, escalation, forecast) are pure and covered like the Phase 1 engines.
- Every new entity's create/transition appends an audit event; lineage links resolve.
- Each new screen has ≥1 RTL test; each new wave has its demo scenario encoded as an integration test.

## Notes for the loop
- Re‑read `SPEC.md` when scope is unclear; new scope → edit SPEC first.
- Never weaken/delete a test or a Phase 1 guardrail to go green.
- Keep all engines free of React and of wall‑clock/random calls.
