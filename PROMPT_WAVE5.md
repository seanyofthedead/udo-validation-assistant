You are ONE iteration of an autonomous build loop, running with a FRESH context.
You remember nothing from prior iterations — the repository is your only memory.
Your job: advance Wave 5 (Risk-Based UDO Prioritization) of the UDO Review Platform.

ORIENT (do this every iteration, in order):

1. Read CLAUDE.md, SPEC.md (esp. §5.1 and §10), the Wave 5 section of IMPLEMENTATION_PLAN.md
   (including its `### Tasks` checklist), and docs/wave5-risk-scoring-model.md (the
   risk-weight source of truth).
2. Run `git log --oneline -10` and `npm run gate` to observe the current state.
3. In IMPLEMENTATION_PLAN.md → Wave 5 → `### Tasks`, find the FIRST unchecked `[ ]` task.

IF there are no unchecked Wave 5 tasks AND `npm run gate` passes with 0 failures:

- Create an empty file named WAVE5_DONE at the repo root, print "WAVE5 COMPLETE", and stop.

OTHERWISE, complete EXACTLY ONE task:

1. Implement only that single task — nothing from later tasks.
2. All scoring weights/thresholds come from a single exported RISK_MODEL constant
   (src/domain/riskModel.ts) that mirrors docs/wave5-risk-scoring-model.md §2.
   Do NOT hard-code any scoring number anywhere else.
3. Write or extend tests for the task. Make tests ROBUST TO FUTURE WEIGHT CHANGES —
   assert the mechanism, not magic numbers:
   • sum(RISK_MODEL.weights) === 100
   • for every seeded line, sum(factor.points) === score
   • the scored population spans all four bands (CRITICAL/HIGH/MEDIUM/LOW)
   • the risk queue sorts by score descending
   You MAY pin the single docs/wave5-risk-scoring-model.md §5 worked-example line
   (expected 78 → CRITICAL under v0.1 defaults) as one labeled "golden vector" test,
   updated when RISK_MODEL changes. Do not pin exact scores for many lines.
4. Run `npm run gate`. If anything is red, fix it before proceeding.
5. Flip the task's `[ ]` to `[x]` in IMPLEMENTATION_PLAN.md.
6. Commit: `git commit -am "wave5: <task id> <short summary>"`. One task per commit.
7. STOP this iteration so the next one starts with a clean context.

HARD RULES (never violate):

- SPEC.md is the source of truth. Re-read it when unsure. New scope → edit SPEC first, don't drift.
- Do NOT modify Waves 0–4 in the plan; do NOT regress any Phase 1 behavior or test.
- Determinism: engines are pure functions; no Date.now()/Math.random() in src/domain; pass asOfDate in.
- Never weaken or delete a test or a guardrail to make the gate pass. Fix the code.
- Never auto-post to a system of record; preserve mandatory reasons; append an audit event per scoring run.
- Do EXACTLY ONE task this iteration, then stop. Do not attempt the whole wave at once.
