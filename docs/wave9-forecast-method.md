# Wave 9 — Staleness Forecast Method (advisory projection)

> **Status: DRAFT — deterministic placeholder method pending SME review.**
> Reference for the Wave 9 build (`forecastStaleObligations()` in `src/domain/forecast.ts`).
> The forecast is **advisory and clearly labeled a Projection** (SPEC §5.8); it is never a
> fact and the platform never auto‑posts on it.
>
> Version: 0.1 (draft) · Method label: `aging extrapolation v0.1` · Updated: 2026‑06

---

## 1. What it projects

One metric in the MVP: **`STALE_OBLIGATIONS`** — the count of obligations projected to become
**stale** by the end of a horizon (default: **next quarter, 90 days**). Each projected line is
returned as a _driver_ with its reason, so the count traces all the way down to the specific
obligations behind it (lineage: forecast → input obligations).

"Stale" uses the **SPEC §8 definition** — _expired period of performance + little/no recent
activity_ — encoded once as the `isStale` primitive in `src/domain/engine.ts`:

```
stale(udo, asOf) ==  expired   (periodOfPerformanceEnd < asOf)
                 &&  inactive   (lastActivityDate < asOf − 180 days)
```

Note: **low drawdown is deliberately NOT part of staleness.** Drawdown is the _recoverability_
qualifier that turns a stale line into a de‑obligation candidate (`flagDeobligation`, SPEC §6);
a line can be stale (expired + dormant) yet still have meaningful drawdown. The forecast still
reports `estimatedRecoverable = obligated − disbursed` per driver so leadership sees the dollars
at stake, but the projected count is governed by staleness, not by recoverability.

Already‑CLOSED obligations are excluded from the scope: a closed line going "stale" is
meaningless.

## 2. The method — pure aging extrapolation

The forecast advances the clock and **holds the financials and activity flat** (the
conservative assumption: no new disbursement, no new activity arrives during the horizon). Only
the passage of time changes.

For a horizon of `H` days from `asOfDate`:

1. `horizonEnd = asOfDate + H days` (pure calendar math — `Date.UTC` to parse, a pure
   days‑to‑civil‑date algorithm to format; **no clock, no `new Date()`**).
2. For each non‑CLOSED obligation, evaluate `isStale` twice with the **same record**:
   - `now       = isStale(udo, asOfDate)`
   - `projected = isStale(udo, horizonEnd)`
3. A line is **newly stale** when `!now && projected` — it is not stale today but the passage of
   time alone tips it over the threshold by `horizonEnd` (its PoP expires within the window, or
   its inactivity crosses 180 days within the window).
4. `projectedValue` = the number of newly‑stale lines; `drivers` = those lines, each with a
   plain‑language reason and `estimatedRecoverable = obligated − disbursed`.

Lines that are **already stale today** are excluded — the projection answers "what _will_ turn
stale," not "what is stale now" (that is the Stale Obligation Explorer's job).

## 3. Scope (`target`)

- `DEPARTMENT` — all obligations.
- A `Component` — only that component's obligations (used to build the per‑component
  `projectedStale` heatmap row and the top‑movers comparison).

The department projection equals the sum of the per‑component projections (same predicate, a
partition of the population) — a property the reconciliation tests rely on.

## 4. Why deterministic / why this shape

- **Deterministic & reproducible.** Pure over `(population, asOfDate, horizon)`; no clock, no
  random. The same inputs always yield the same projection, so the build loop terminates and an
  auditor can reproduce any number. A unit test re‑derives the projected set on the seed by the
  documented rule above and asserts the function matches it.
- **Explainable.** Every projection carries a plain‑language `basis` (method + horizon end +
  the flat‑financials assumption) and per‑line `drivers`. It is rendered with a **"Projection"**
  badge so it is never mistaken for an observed fact.
- **Forward‑compatible.** The signature (`inputs + asOfDate + horizon → Forecast`) anticipates a
  future model‑backed implementation (see `AWS_FUTURE_STATE.md`): the method label and `basis`
  string are the seam where a learned model would replace the aging heuristic without changing
  the call sites or the explainability contract.

## 5. Worked basis (seed, as of 2026‑06‑21, horizon 90 days → 2026‑09‑19)

The seed test pins the projected set by re‑deriving it with the rule in §2 (rather than hard‑
coding a count here, which would drift as the seed evolves). The test is the living worked
example; this section records only the method it encodes.

## 6. Change log

- **v0.1 (2026‑06)** — initial deterministic aging‑extrapolation method; horizon defaults to
  one quarter (90 days); staleness predicate shared with `flagDeobligation`.
