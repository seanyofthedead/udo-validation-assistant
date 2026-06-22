# Wave 5 — UDO Risk Scoring Model (starting hypothesis)

> **Status: DRAFT — placeholder weights and thresholds pending SME review.**
> This is the reference the Wave 5 build implements (`scoreRisk()` in `src/domain`) and the
> artifact to walk through with colleagues. Every number marked «PH» is a placeholder: change
> it here, then the build/loop picks it up. Keep the model **deterministic and
> factor‑attributable** — the displayed score must equal the sum of factor points, and every
> point must trace to a reason (`SPEC.md §5.1`, NFR explainability).
>
> Version: 0.1 (draft) · Owner: «PH — name» · Last updated: 2026‑06 · Total points: 100

---

## How to read this

- **Max points** = the most a factor can contribute. The eight factors sum to **100**.
- **Scoring rule** = how raw input maps to points (bands or a formula). Thresholds are «PH».
- **Reason string** = the plain‑language text shown in the risk detail panel for that factor.
- **Confirmed?** = ☐ until a colleague signs off; flip to ✅ when agreed.
- Output shape (matches `SPEC.md`): `RiskScore { udoId, score 0–100, band, factors:[{name, points, reason}], asOfDate }`.

## Factor weights (the starting hypothesis)

| ID  | Factor                          | Measures                                     | Input field(s)                                      | Max pts «PH» | Rationale                                                                | Confirmed? |
| --- | ------------------------------- | -------------------------------------------- | --------------------------------------------------- | ------------ | ------------------------------------------------------------------------ | ---------- |
| R1  | Validation verdict              | The Phase 1 engine's judgment                | `ValidationFinding.verdict`                         | **25**       | The strongest single signal that a line needs a human                    | ☐          |
| R2  | Validation confidence (inverse) | How unsure the engine is                     | `ValidationFinding.confidence`                      | **10**       | Low confidence = more worth a look                                       | ☐          |
| R3  | PoP expiry                      | Days past period of performance end          | `periodOfPerformanceEnd`, `asOfDate`                | **15**       | Expired performance with money still open is classic stale               | ☐          |
| R4  | Inactivity                      | Days since last activity                     | `lastActivityDate`, `asOfDate`                      | **10**       | Dormant obligations are review‑worthy                                    | ☐          |
| R5  | Drawdown profile                | Disbursed vs obligated, in context of status | `amountDisbursed/amountObligated`, `reportedStatus` | **15**       | Both very‑low (stale $) and ~full‑but‑open (should be closing) are flags | ☐          |
| R6  | Dollar magnitude                | Size of the obligation                       | `amountObligated`                                   | **15**       | Bigger dollars = bigger impact if wrong; prioritize                      | ☐          |
| R7  | Evidence completeness (inverse) | Missing required evidence                    | `EvidenceItem` set vs `CrgRule.requiredEvidence`    | **5**        | Thin evidence raises review value                                        | ☐          |
| R8  | Prior‑year anomaly              | Outlier / anomalous population               | `priorYearAnomaly()` output                         | **5**        | Anomalies historically hide errors                                       | ☐          |
|     | **Total**                       |                                              |                                                     | **100**      |                                                                          |            |

## Scoring rules per factor (all thresholds «PH»)

**R1 — Validation verdict (max 25)**
| Verdict | Points «PH» | Reason string |
|---|---|---|
| QUESTIONABLE | 25 | "Validation flagged the reported status as questionable." |
| INSUFFICIENT_EVIDENCE | 18 | "Validation could not confirm the status (insufficient evidence)." |
| VALID | 0 | "Validation confirmed the reported status." |

**R2 — Confidence inverse (max 10).** `points = round((1 − confidence) × 10)`.
Reason: "Validation confidence was {confidence%}."

**R3 — PoP expiry (max 15)**, where `daysPastPoP = asOfDate − periodOfPerformanceEnd`:
| daysPastPoP «PH» | Points «PH» |
|---|---|
| ≤ 0 (not expired) | 0 |
| 1–90 | 5 |
| 91–365 | 10 |
| > 365 | 15 |
Reason: "Period of performance ended {n} days ago."

**R4 — Inactivity (max 10)**, where `daysInactive = asOfDate − lastActivityDate`:
| daysInactive «PH» | Points «PH» |
|---|---|
| ≤ 90 | 0 |
| 91–180 | 4 |
| 181–365 | 7 |
| > 365 | 10 |
Reason: "No activity for {n} days."

**R5 — Drawdown profile (max 15)**, `drawdown = disbursed / obligated`:
| Condition «PH» | Points «PH» |
|---|---|
| status is OPEN*\* and drawdown < 0.25 | 15 |
| status is OPEN*\_ and 0.25 ≤ drawdown < 0.50 | 8 |
| status is OPEN\_\_/PENDING_CLOSE and drawdown ≥ 0.98 | 12 |
| otherwise | 0 |
Reason: "Drawdown is {drawdown%} while status is {status}."

**R6 — Dollar magnitude (max 15)** on `amountObligated`:
| Amount «PH» | Points «PH» |
|---|---|
| < $100K | 3 |
| $100K–$1M | 8 |
| $1M–$10M | 12 |
| > $10M | 15 |
Reason: "Obligation amount is {amount}."

**R7 — Evidence completeness inverse (max 5).**
`missing = requiredEvidence − presentEvidence`; `points = min(5, missing × «PH 2.5»)`.
Reason: "{n} required evidence item(s) missing."

**R8 — Prior‑year anomaly (max 5).** 5 if the line is an anomaly outlier or sits in an
anomalous population, else 0. Reason: "Flagged by prior‑year anomaly check."

## Risk bands (thresholds «PH»)

| Band     | Score range «PH» | Intended meaning          |
| -------- | ---------------- | ------------------------- |
| CRITICAL | 75–100           | Review now                |
| HIGH     | 50–74            | Review this campaign      |
| MEDIUM   | 25–49            | Review if capacity allows |
| LOW      | 0–24             | Monitor only              |

## Worked example (illustrates attribution)

Sample line: QUESTIONABLE, confidence 0.40, PoP ended 200 days ago, inactive 210 days,
OPEN_ACTIVE with drawdown 0.10, $2.5M, 1 evidence item missing, not an anomaly.

| Factor        | Points | Reason                      |
| ------------- | ------ | --------------------------- |
| R1 verdict    | 25     | flagged questionable        |
| R2 confidence | 6      | confidence 40%              |
| R3 PoP expiry | 10     | 200 days past PoP           |
| R4 inactivity | 7      | 210 days inactive           |
| R5 drawdown   | 15     | 10% drawn, still open       |
| R6 dollars    | 12     | $2.5M                       |
| R7 evidence   | 3      | 1 item missing («PH 2.5»→3) |
| R8 anomaly    | 0      | not flagged                 |
| **Score**     | **78** | **band: CRITICAL**          |

The detail panel shows exactly this breakdown; the score (78) equals the sum.

## Open questions for the SME review

1. **Weights** — does verdict (R1) deserve the largest share, or should dollars (R6) outrank it?
2. **Overlap** — R3/R4/R5 all correlate (stale lines tend to trip all three). Acceptable as cumulative emphasis, or should they be capped/combined so staleness isn't triple‑counted?
3. **Thresholds** — are the PoP/inactivity day bands and the $ bands right for DHS reality?
4. **Drawdown direction** — is "near‑full but still open" (R5 row 3) truly review‑worthy, or noise?
5. **Band cutoffs** — where does "review now" really start? (CRITICAL ≥ 75 is a guess.)
6. **Missing factors** — funding type, fiscal‑year expiration, component‑specific risk history, or repeat‑offender vendors?
7. **Evidence weighting** — is 5 pts too low given how much SMEs rely on evidence?

## Implementation notes (for the Wave 5 build)

- Implement as a pure function `scoreRisk(udo, finding, deobFlag, anomaly, asOfDate)`; no `Date.now()`/`Math.random()`.
- Keep weights/thresholds in one exported constants object (e.g. `RISK_MODEL`) so retuning is a one‑file change and unit tests can import the same numbers.
- Each factor returns `{name, points, reason}`; the engine sums points → `score`, maps to `band`.
- Add a test asserting `sum(factors.points) === score` for every seeded line (guards attribution).
- Extend the seed so the population spans all four bands (Wave 5 acceptance criteria).
- This file is the source for those weights — if SPEC and this file ever disagree on a number, fix it here and reference it from SPEC §5.1.

## Change log

- 0.1 (2026‑06) — initial placeholder hypothesis, pre‑SME review.
- _«PH» 0.2 — after colleague feedback: record what changed and why._
