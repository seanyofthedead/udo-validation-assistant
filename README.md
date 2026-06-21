# UDO Validation Assistant (MVP‑1)

An independent, explainable **second opinion** on DHS Undelivered Orders (UDOs): for any
obligation a component reports, the app says — with a confidence score and a cited reason —
whether the reported status looks right and whether the obligation looks stale enough to
de‑obligate. A human is in the loop on every disposition; an immutable audit trail sits behind
every decision.

This is a deterministic, **mock‑data React SPA**. No backend, no network, no API key, no
database. `SPEC.md` is the source of truth; `IMPLEMENTATION_PLAN.md` is the task plan.

## Run it

```bash
nvm use            # Node version is pinned in .nvmrc (22)
npm install
npm run dev        # serve the app
```

## Using the app

Validation runs once on load over the mock seed population. Navigate the six screens
(SPEC §7) from the top nav:

- **Executive Dashboard** — coverage %, exception count, total de‑obligation $.
- **UDO Inventory** — full population, filterable by component/status and sortable by $ / age,
  with a verdict badge per row.
- **High‑Risk Queue** — questionable lines and de‑obligation candidates, ranked by $.
- **UDO Detail** — record, evidence, verdict + confidence + justification + cited rule, and the
  de‑obligation flag with its reasons.
- **Review Workspace** — confirm or override the AI verdict (override requires a non‑empty
  reason), with disposition history and the audit trail for the line.
- **Reporting / Export** — download the validated population, exception worklist, de‑obligation
  shortlist, and full audit trail as **CSV and JSON**.

The app only **proposes**; a human disposes on every line, and every AI and human action is
appended to an immutable audit trail. The end‑to‑end acceptance scenario lives in
`src/goldenPath.test.ts`.

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

The engine is a **pure function of its inputs**. There must be **no `Math.random()`, no
`Date.now()`, and no `new Date(`** inside `src/domain` — pass an explicit `asOfDate` instead.
This is what makes results reproducible and lets the build loop terminate. It is enforced
automatically by `src/domain/determinism.guard.test.ts`, which fails the suite if any of those
tokens appears in a non‑test domain source file.

## Where the engine lives

```
src/domain      types (SPEC §5) + pure validation engine (SPEC §6) — no React, no clock/random
src/data        mock fixtures (CRG ruleset, seed population, evidence)
src/state        in‑memory store + reducer (population, findings, dispositions, audit log)
src/export       CSV/JSON serializers + Blob download
src/screens      the six SPEC §7 screens
src/components   shared presentational components
```

The validation engine (`src/domain`) is deliberately framework‑free and clock‑free so it can
later move server‑side unchanged. See **[AWS_FUTURE_STATE.md](./AWS_FUTURE_STATE.md)** for the
target backend + hosting architecture.
