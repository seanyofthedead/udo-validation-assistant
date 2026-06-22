// src/domain/riskModel.ts — single source of truth for Wave 5 scoring.
//
// Mirrors docs/wave5-risk-scoring-model.md §2 (Control Panel) EXACTLY. Every
// tunable weight, threshold, and band cutoff for the risk engine lives here once
// and nowhere else (a guard test — task 5.10 — enforces "no loose scoring numbers").
// If you change a number, change the matching row in wave5-risk-scoring-model.md §1
// and bump the version + change log there.
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
