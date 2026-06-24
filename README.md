# UDO Review Platform

A **department‑wide, Headquarters‑led, risk‑based platform** for reviewing and managing DHS
Undelivered Orders (UDOs). It started as an independent, explainable **second opinion** on a
single obligation's reported status, and has grown into the full HQ workflow: identify which
UDOs deserve attention → coordinate component reviews → validate the responses → prioritize
de‑obligation → give leadership enterprise visibility and an advisory forecast of what's coming.

Throughout, two rules never bend: the platform only **proposes** (a human disposes on every
action), and every machine output and human action lands in an **immutable, explainable audit
trail**. It is a deterministic, **mock‑data React SPA** — no backend, no network, no API key, no
database. `SPEC.md` is the source of truth; `IMPLEMENTATION_PLAN.md` is the task plan;
`docs/product-evolution-roadmap.md` explains the phasing.

## Run it

```bash
nvm use            # Node version is pinned in .nvmrc (22)
npm install
npm run dev        # serve the app
```

## What it does, by phase

The product was built in waves, each phase adding a layer over the last without regressing it.

### Phase 1 — Record‑level validation (Waves 0–4)

For each obligation the engine renders a verdict (`VALID` / `QUESTIONABLE` /
`INSUFFICIENT_EVIDENCE`) with a **confidence score** and a **cited rule**, abstaining rather than
guessing when evidence is thin. A separate QC pass cross‑checks the creator's verdict and fails
safe on disagreement. It also flags **de‑obligation candidates** (expired performance window,
low drawdown, gone quiet) with an estimated recoverable amount, and surfaces prior‑year
anomalies.

### Phase 2 — Risk‑based prioritization (Wave 5)

An explainable **risk score** (0–100, banded LOW/MEDIUM/HIGH/CRITICAL) ranks the whole
population so analysts work the ~20 lines that matter, not 3,000. Every score breaks into
**per‑factor contributions**, each with a plain‑language reason; weights live in one place
(`src/domain/riskModel.ts`, mirroring `docs/wave5-risk-scoring-model.md`).

### Phase 3 — Campaigns & component collaboration (Waves 6–7)

HQ scopes a **review campaign** (objective, period, population — manual, saved filter, or top‑N
by risk), assigns slices to components with due dates, and tracks completion through a
forward‑only state machine. Components **respond per line** (concur / contest / correct) with
evidence and a mandatory reason on anything but concur; HQ validates so concurrence isn't
rubber‑stamped. Overdue / contested / high‑dollar items **escalate** deterministically, and
de‑obligation opportunities move through their own dispositioned lifecycle.

### Phase 4 — Executive visibility (Wave 8)

A **portfolio scorecard** rolls the department up — coverage, exceptions, confirmed de‑ob $,
campaign completion, per‑component risk mix — where **every KPI reconciles to its source records**
(asserted, no drift) and **drills from a number down to the contributing lines and their audit
trail**.

### Phase 4 → L5 — Enterprise command center (Wave 9)

Cross‑component oversight plus the predictive step: a **heatmap** that highlights where each
metric spikes, **top movers** versus an earlier recomputed snapshot, and an advisory **staleness
forecast**. The forecast is a deterministic aging extrapolation (documented in
`docs/wave9-forecast-method.md`) — always rendered as a **"Projection"** with its basis and the
exact lines driving it, so it's never mistaken for fact.

## Using the app

Validation, risk scoring, and de‑ob identification all run once on load over the mock seed
population. The top nav exposes every screen (SPEC §7):

| Screen                        | What it's for                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Executive Dashboard**       | Headline coverage %, exception count, total de‑obligation $.                                                 |
| **Portfolio Command Center**  | Department scorecard + per‑component grid; click any KPI to drill to its lines and audit trail.              |
| **Enterprise Command Center** | Cross‑component heatmap, top movers, and the staleness **Projection** panel with drill‑to‑driver.            |
| **UDO Inventory**             | Full population, filterable by component/status, sortable by $ / age, verdict badge per row.                 |
| **High‑Risk Queue**           | Risk‑ranked lines with band chip, top factors, $, age; filterable, with a score‑breakdown panel.             |
| **Stale Obligation Explorer** | De‑obligation candidates by aging bucket, expired‑PoP / low‑drawdown filters, sorted by recoverable $.       |
| **Review Campaigns**          | Create a campaign + assignments; campaign detail shows per‑component progress.                               |
| **Component Workspace**       | A component's assigned lines; respond concur/contest/correct with evidence and submit to HQ.                 |
| **Escalations & De‑Ob**       | Escalation banner + the de‑obligation opportunity tracker lifecycle.                                         |
| **UDO Detail**                | Record, evidence, verdict + confidence + justification + cited rule, risk breakdown, de‑ob flag.             |
| **Review Workspace**          | Confirm or override a verdict (override needs a reason), with disposition history + audit trail.             |
| **Reporting / Export**        | Download the validated population, exception worklist, de‑ob shortlist, and audit trail as **CSV and JSON**. |

The app only **proposes**; a human disposes, and every AI and human action — verdicts, risk
scoring, campaign/assignment changes, responses, escalations, de‑ob dispositions, exports — is
appended to an immutable audit trail. Each wave's end‑to‑end scenario is encoded as an
integration test (`src/goldenPath.test.ts`, `src/wave5Demo.test.tsx` … `src/wave9Demo.test.tsx`).

## The verification gate

One command proves the repo is healthy. It runs typecheck → lint → build → tests in sequence:

```bash
npm run gate
```

Individual steps:

| Script              | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run typecheck` | `tsc --noEmit` (TypeScript strict mode)      |
| `npm run lint`      | ESLint (typescript-eslint) + Prettier compat |
| `npm run build`     | `vite build` (must exit 0)                   |
| `npm run test:run`  | Vitest, run‑once (the completion gate)       |

CI runs `npm ci && npm run gate` on every push (`.github/workflows/ci.yml`). A husky
pre‑commit hook runs typecheck + tests so commits stay green.

## The determinism rule

Every engine — validation, risk scoring, escalation, and forecasting — is a **pure function of
its inputs**. There must be **no `Math.random()`, no `Date.now()`, and no `new Date(`** inside
`src/domain`; pass an explicit `asOfDate` (and, for the forecast, an explicit horizon) instead.
This is what makes results reproducible and auditable and lets the build loop terminate. It is
enforced automatically by `src/domain/determinism.guard.test.ts`, which fails the suite if any of
those tokens appears in a non‑test domain source file.

## Where the engine lives

```
src/domain      types (SPEC §5) + pure engines — no React, no clock/random:
                  engine.ts      validation, QC, de‑obligation, anomaly, staleness (SPEC §6/§8)
                  riskEngine.ts  risk scoring over riskModel.ts (Phase 2)
                  campaign.ts · assignment.ts · population.ts   campaigns + selection (Phase 3)
                  response.ts · escalation.ts · deob.ts          component collaboration (Phase 3)
                  portfolio.ts   department roll‑up + scorecards (Phase 4)
                  forecast.ts · analytics.ts   staleness forecast + cross‑component analytics (Wave 9)
src/data        mock fixtures (CRG ruleset, seed population, evidence, prior‑year stats)
src/state       in‑memory store + reducer (findings, risk, campaigns, responses, dispositions, audit)
src/export      CSV/JSON serializers + Blob download
src/screens     the SPEC §7 screens + nav/shell
src/components  shared presentational components
```

The engines (`src/domain`) are deliberately framework‑free and clock‑free so the whole platform
can later move server‑side unchanged. See **[AWS_FUTURE_STATE.md](./AWS_FUTURE_STATE.md)** for the
target backend + hosting architecture, including where a model‑backed forecast would replace the
deterministic aging heuristic.
