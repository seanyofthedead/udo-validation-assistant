# Wave 5 — UDO Risk Scoring Model (starting hypothesis)

> **Status: DRAFT — placeholder values pending SME review.**
> Reference for the Wave 5 build (`scoreRisk()` in `src/domain`) and the artifact to review
> with colleagues. The model is **deterministic and factor‑attributable**: a line's displayed
> score equals the sum of its factor points, and every point traces to a reason
> (`SPEC.md §5.1`).
>
> Version: 0.1 (draft) · Owner: «name» · Updated: 2026‑06

---

## ⭐ How to update the weights (read this first)

**§1 — Control Panel — is the single source of truth.** Every tunable number in the whole
model lives there once. To retune after feedback:

1. Edit the value in the Control Panel table (and the matching key in the `RISK_MODEL` block in §2 — keep them identical).
2. Flip the row's **Confirmed?** box to ✅ when a colleague signs off.
3. Put a note in the **Feedback** column if the change has a reason worth keeping.
4. Bump the version and add a line to the Change Log (§7).
5. Recompute the Worked Example (§5) — it's tagged with the version it was computed from.

Nowhere else in this document hard‑codes a number — §3 (factor logic) and §4 (bands) refer to
Control‑Panel keys by name. So one edit propagates. The build is instructed to read the same
values from a single `RISK_MODEL` constant, so the doc and the code share one shape.

---

## 1. Control Panel — all tunable values (SINGLE SOURCE OF TRUTH)

Eight factors, **points sum to 100** (a build test enforces this — see §6). Edit values in the
"Value" column only.

### 1a. Factor weights (max points each factor can contribute)

| Key            | Factor                             | Value «PH» | Confirmed? | Feedback |
| -------------- | ---------------------------------- | ---------- | ---------- | -------- |
| `W_VERDICT`    | R1 Validation verdict              | 25         | ☐          |          |
| `W_CONFIDENCE` | R2 Confidence (inverse)            | 10         | ☐          |          |
| `W_POP`        | R3 PoP expiry                      | 15         | ☐          |          |
| `W_INACTIVITY` | R4 Inactivity                      | 10         | ☐          |          |
| `W_DRAWDOWN`   | R5 Drawdown profile                | 15         | ☐          |          |
| `W_DOLLAR`     | R6 Dollar magnitude                | 15         | ☐          |          |
| `W_EVIDENCE`   | R7 Evidence completeness (inverse) | 5          | ☐          |          |
| `W_ANOMALY`    | R8 Prior‑year anomaly              | 5          | ☐          |          |
|                | **Total (must = 100)**             | **100**    |            |          |

### 1b. R1 — verdict → points

| Key               | When verdict is       | Value «PH» | Confirmed? | Feedback |
| ----------------- | --------------------- | ---------- | ---------- | -------- |
| `R1_QUESTIONABLE` | QUESTIONABLE          | 25         | ☐          |          |
| `R1_INSUFFICIENT` | INSUFFICIENT_EVIDENCE | 18         | ☐          |          |
| `R1_VALID`        | VALID                 | 0          | ☐          |          |

### 1c. R3 — PoP expiry bands (`daysPastPoP = asOfDate − periodOfPerformanceEnd`)

| Key          | Band                         | Value «PH» | Confirmed? | Feedback |
| ------------ | ---------------------------- | ---------- | ---------- | -------- |
| `R3_T1_DAYS` | upper bound of "recent" band | 90         | ☐          |          |
| `R3_T2_DAYS` | upper bound of "mid" band    | 365        | ☐          |          |
| `R3_P_NONE`  | points when not expired (≤0) | 0          | ☐          |          |
| `R3_P_T1`    | points when 1…T1             | 5          | ☐          |          |
| `R3_P_T2`    | points when T1+1…T2          | 10         | ☐          |          |
| `R3_P_OVER`  | points when > T2             | 15         | ☐          |          |

### 1d. R4 — inactivity bands (`daysInactive = asOfDate − lastActivityDate`)

| Key          | Band                         | Value «PH» | Confirmed? | Feedback |
| ------------ | ---------------------------- | ---------- | ---------- | -------- |
| `R4_T1_DAYS` | upper bound of "active" band | 90         | ☐          |          |
| `R4_T2_DAYS` | upper bound of "mid" band    | 180        | ☐          |          |
| `R4_T3_DAYS` | upper bound of "stale" band  | 365        | ☐          |          |
| `R4_P_T1`    | points ≤ T1                  | 0          | ☐          |          |
| `R4_P_T2`    | points T1+1…T2               | 4          | ☐          |          |
| `R4_P_T3`    | points T2+1…T3               | 7          | ☐          |          |
| `R4_P_OVER`  | points > T3                  | 10         | ☐          |          |

### 1e. R5 — drawdown profile (`drawdown = amountDisbursed / amountObligated`)

| Key              | Condition                                       | Value «PH» | Confirmed? | Feedback |
| ---------------- | ----------------------------------------------- | ---------- | ---------- | -------- |
| `R5_LOW_THRESH`  | "very low" drawdown cutoff                      | 0.25       | ☐          |          |
| `R5_MID_THRESH`  | "moderate" drawdown cutoff                      | 0.50       | ☐          |          |
| `R5_FULL_THRESH` | "effectively full" cutoff                       | 0.98       | ☐          |          |
| `R5_P_LOW`       | pts: OPEN\_\* and drawdown < LOW                | 15         | ☐          |          |
| `R5_P_MID`       | pts: OPEN\_\* and LOW ≤ drawdown < MID          | 8          | ☐          |          |
| `R5_P_FULL`      | pts: OPEN\_\*/PENDING_CLOSE and drawdown ≥ FULL | 12         | ☐          |          |
| `R5_P_NONE`      | pts otherwise                                   | 0          | ☐          |          |

### 1f. R6 — dollar magnitude (`amountObligated`)

| Key         | Band                    | Value «PH» | Confirmed? | Feedback |
| ----------- | ----------------------- | ---------- | ---------- | -------- |
| `R6_T1`     | small/medium cutoff     | 100000     | ☐          |          |
| `R6_T2`     | medium/large cutoff     | 1000000    | ☐          |          |
| `R6_T3`     | large/very‑large cutoff | 10000000   | ☐          |          |
| `R6_P_T1`   | pts < T1                | 3          | ☐          |          |
| `R6_P_T2`   | pts T1…T2               | 8          | ☐          |          |
| `R6_P_T3`   | pts T2…T3               | 12         | ☐          |          |
| `R6_P_OVER` | pts > T3                | 15         | ☐          |          |

### 1g. R7 — evidence completeness (inverse)

| Key                  | Meaning                                   | Value «PH» | Confirmed? | Feedback |
| -------------------- | ----------------------------------------- | ---------- | ---------- | -------- |
| `R7_PTS_PER_MISSING` | points per missing required evidence item | 2.5        | ☐          |          |
| `R7_CAP`             | max points (= `W_EVIDENCE`)               | 5          | ☐          |          |

### 1h. R8 — prior‑year anomaly

| Key      | Meaning                              | Value «PH» | Confirmed? | Feedback |
| -------- | ------------------------------------ | ---------- | ---------- | -------- |
| `R8_PTS` | points if flagged as anomaly/outlier | 5          | ☐          |          |

### 1i. Risk band cutoffs (applied to the 0–100 total)

| Key             | Band     | Lower bound «PH» | Confirmed? | Feedback |
| --------------- | -------- | ---------------- | ---------- | -------- |
| `BAND_CRITICAL` | CRITICAL | 75               | ☐          |          |
| `BAND_HIGH`     | HIGH     | 50               | ☐          |          |
| `BAND_MEDIUM`   | MEDIUM   | 25               | ☐          |          |
| `BAND_LOW`      | LOW      | 0                | ☐          |          |

---

## 2. `RISK_MODEL` constant (mirror of §1 — implement from this)

The build keeps exactly these values in one exported object so retuning is a one‑file change.
**Keep this identical to the Control Panel.**

```ts
// src/domain/riskModel.ts — single source of truth for Wave 5 scoring.
// If you change a number, change the matching row in wave5-risk-scoring-model.md §1.
export const RISK_MODEL = {
  weights: {
    verdict: 25,
    confidence: 10,
    pop: 15,
    inactivity: 10,
    drawdown: 15,
    dollar: 15,
    evidence: 5,
    anomaly: 5,
  }, // must sum to 100

  r1: { questionable: 25, insufficient: 18, valid: 0 },
  r2: { max: 10 }, // points = round((1 - confidence) * max)
  r3: { t1Days: 90, t2Days: 365, pNone: 0, pT1: 5, pT2: 10, pOver: 15 },
  r4: { t1Days: 90, t2Days: 180, t3Days: 365, pT1: 0, pT2: 4, pT3: 7, pOver: 10 },
  r5: { lowThresh: 0.25, midThresh: 0.5, fullThresh: 0.98, pLow: 15, pMid: 8, pFull: 12, pNone: 0 },
  r6: { t1: 100_000, t2: 1_000_000, t3: 10_000_000, pT1: 3, pT2: 8, pT3: 12, pOver: 15 },
  r7: { ptsPerMissing: 2.5, cap: 5 },
  r8: { pts: 5 },

  bands: { critical: 75, high: 50, medium: 25, low: 0 },
} as const;
```

---

## 3. Factor logic (references §1 keys — no loose numbers)

- **R1 Verdict** → `R1_QUESTIONABLE` / `R1_INSUFFICIENT` / `R1_VALID`. Reason: "Validation {verdict}."
- **R2 Confidence** → `round((1 − confidence) × W_CONFIDENCE)`. Reason: "Validation confidence {confidence%}."
- **R3 PoP expiry** → band on `daysPastPoP` using `R3_T1_DAYS`/`R3_T2_DAYS` → `R3_P_*`. Reason: "PoP ended {n} days ago."
- **R4 Inactivity** → band on `daysInactive` using `R4_T*_DAYS` → `R4_P_*`. Reason: "No activity for {n} days."
- **R5 Drawdown** → condition on `drawdown` + `reportedStatus` using `R5_*_THRESH` → `R5_P_*`. Reason: "Drawdown {drawdown%} while {status}."
- **R6 Dollars** → band on `amountObligated` using `R6_T*` → `R6_P_*`. Reason: "Obligation {amount}."
- **R7 Evidence** → `min(R7_CAP, missingCount × R7_PTS_PER_MISSING)`. Reason: "{n} required evidence item(s) missing."
- **R8 Anomaly** → `R8_PTS` if flagged else 0. Reason: "Flagged by prior‑year anomaly check."

Each factor returns `{ name, points, reason }`. The engine sums points → `score`, then maps to a
band (§4).

## 4. Band mapping (references §1i)

`score ≥ BAND_CRITICAL` → CRITICAL · `≥ BAND_HIGH` → HIGH · `≥ BAND_MEDIUM` → MEDIUM ·
else LOW. Meanings: CRITICAL "review now", HIGH "review this campaign", MEDIUM "review if
capacity", LOW "monitor only".

## 5. Worked example _(computed from defaults v0.1 — recompute if §1 changes)_

Line: QUESTIONABLE, confidence 0.40, PoP ended 200 days ago, inactive 210 days, OPEN_ACTIVE
drawdown 0.10, $2.5M, 1 evidence item missing, not an anomaly.

| Factor        | Points | From keys                                 |
| ------------- | ------ | ----------------------------------------- |
| R1 verdict    | 25     | `R1_QUESTIONABLE`                         |
| R2 confidence | 6      | round((1−0.40)×10)                        |
| R3 PoP expiry | 10     | 200 in (90,365] → `R3_P_T2`               |
| R4 inactivity | 7      | 210 in (180,365] → `R4_P_T3`              |
| R5 drawdown   | 15     | OPEN, 0.10 < 0.25 → `R5_P_LOW`            |
| R6 dollars    | 12     | $2.5M in ($1M,$10M] → `R6_P_T3`           |
| R7 evidence   | 3      | min(5, 1×2.5) → 2.5, rounded 3            |
| R8 anomaly    | 0      | not flagged                               |
| **Score**     | **78** | **band: CRITICAL** (≥ `BAND_CRITICAL` 75) |

## 6. Build/test notes (Wave 5)

- Implement `scoreRisk(udo, finding, deobFlag, anomaly, asOfDate)` as a **pure** function reading only `RISK_MODEL`. No `Date.now()`/`Math.random()`.
- **Guard test:** assert `sum(RISK_MODEL.weights) === 100`.
- **Attribution test:** for every seeded line, assert `sum(factors.points) === score`.
- **Single‑source test:** no scoring number is hard‑coded outside `RISK_MODEL` (grep‑style test or lint rule).
- Extend the seed so the population spans all four bands (Wave 5 acceptance criteria).
- `SPEC.md §5.1` references this file for weights; don't restate numbers there.

## 7. Open questions for SME review

1. Should verdict (`W_VERDICT`) outweigh dollars (`W_DOLLAR`), or the reverse?
2. R3/R4/R5 overlap on stale lines (can stack ~40 pts) — intended emphasis, or cap/combine staleness?
3. Are the day/dollar thresholds realistic for DHS?
4. Is "near‑full but still open" (`R5_P_FULL`) review‑worthy or noise?
5. Where should CRITICAL really start (`BAND_CRITICAL`)?
6. Missing factors? (funding type, fiscal‑year expiration, component history, repeat‑offender vendors)
7. Is `W_EVIDENCE` (5) too low given how much SMEs weigh evidence?

## 8. Change Log

- **0.1 (2026‑06)** — initial placeholder hypothesis, pre‑SME review.
- _0.2 — after colleague feedback: list which keys changed and why._
