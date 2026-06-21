# IMPLEMENTATION_PLAN.md — UDO Validation Assistant (MVP‑1)

> The loop works this plan top to bottom. **Each iteration: pick the first unchecked task,
> implement it, write/extend its test, run `npm test`, check the box, commit.** One task per
> commit. Do not start a later wave until the earlier wave's tasks are checked and green.
> Tasks are ordered by dependency — earlier waves are contracts later waves build on.

Legend: `[ ]` todo · `[x]` done · each task names its **done‑check**.

---

## Wave 0 — Scaffold

- [x] **0.1 Project init.** Vite + React + TypeScript app; add Vitest + @testing-library/react + jsdom; add Tailwind (or plain CSS modules). **Done:** `npm run build` and `npm test` both run (a trivial passing test is fine).
- [x] **0.2 Repo conventions.** Folder layout: `src/domain` (types + engine, no React), `src/data` (fixtures), `src/screens`, `src/components`, `src/state`, `src/export`. **Done:** folders exist; `src/domain/types.ts` holds every interface from SPEC §5 and compiles.

## Wave 1 — Domain core (no UI) — *the contract everything else depends on*

- [x] **1.1 Types.** Implement all SPEC §5 interfaces in `src/domain/types.ts`. **Done:** `tsc --noEmit` clean.
- [x] **1.2 Mock CRG ruleset.** `src/data/crgRules.ts` — one `CrgRule` per `ReportedStatus` with `requiredEvidence`. **Done:** unit test asserts a rule exists for each status.
- [x] **1.3 Seed population.** `src/data/seed.ts` — ~20 `UdoRecord`s across ≥3 components, their `EvidenceItem`s, and `PriorYearStat`s. **Fixture must be designed so the engine produces: several VALID, ≥3 QUESTIONABLE (each triggering a different rule), exactly ONE INSUFFICIENT_EVIDENCE, and ≥3 de‑obligation candidates with non‑zero $.** Use a fixed `AS_OF_DATE` constant. **Done:** snapshot test pins counts by verdict.
- [x] **1.4 Status engine.** `validateStatus()` per SPEC §6, pure. **Done:** unit tests cover each branch — VALID, each QUESTIONABLE trigger, the abstain path — with hand‑computed expected confidence.
- [x] **1.5 QC agent.** `qcCheck()` independent re‑derivation; forces abstain + lowers confidence on disagreement. **Done:** test with a contrived disagreement asserts fail‑safe behavior.
- [x] **1.6 De‑obligation engine.** `flagDeobligation()` per SPEC §6. **Done:** tests assert candidate/non‑candidate and exact `estimatedRecoverable`.
- [x] **1.7 Prior‑year anomaly.** `priorYearAnomaly()` — population shift + outliers. **Done:** test triggers a ≥50% shift flag and an outlier.
- [x] **1.8 Pipeline.** `runValidation(population, evidence, rules, priorStats, asOfDate)` returns `{findings, deobFlags, anomalies}` and emits one `AuditEvent` per AI action. **Done:** integration test over the full seed asserts the SPEC §8 verdict mix and that audit events were produced.

## Wave 2 — State + audit + export (still no screens)

- [x] **2.1 App state.** `src/state` store (Context + reducer, or Zustand) holding population, findings, dispositions, audit log. **Done:** reducer unit tests for confirm/override.
- [x] **2.2 Override guard.** Override action **rejects empty/whitespace reason**; confirm needs no reason. **Done:** test asserts rejection and acceptance.
- [x] **2.3 Immutable audit log.** Append‑only; override and export each append an event. **Done:** test asserts log grows and prior entries are never mutated.
- [x] **2.4 Export.** `src/export` → CSV + JSON for validated population, exceptions, de‑ob shortlist, audit trail; triggers Blob download. **Done:** unit test on the serializer output (headers + row counts); export appends an audit event.

## Wave 3 — Screens (each independent; parallelizable via `/batch` after Wave 2)

- [x] **3.1 App shell + routing.** Nav across the six screens; `runValidation` executes once on load over the seed. **Done:** renders without console errors; nav switches screens (RTL test).
- [x] **3.2 UDO Inventory.** Table with filter/sort by component, status, $, age; verdict badge. **Done:** RTL test: filter narrows rows; sort reorders.
- [x] **3.3 UDO Detail + AI Findings panel.** Record + evidence + verdict + confidence + justification + cited rule + abstain note + de‑ob reasons. **Done:** RTL test renders a known QUESTIONABLE line with its justification text.
- [x] **3.4 High‑Risk Queue.** Questionable + de‑ob candidates, sorted by $ desc. **Done:** RTL test asserts ordering and that VALID lines are excluded.
- [x] **3.5 Review Workspace.** Confirm/override UI; override disabled until reason entered; disposition history. **Done:** RTL test: empty‑reason override blocked, valid override recorded + audited.
- [x] **3.6 Executive Dashboard.** Coverage %, exception count, total de‑ob $. **Done:** RTL test asserts the three numbers match engine output over the seed.
- [x] **3.7 Reporting/Export screen.** Buttons for CSV/JSON of each artifact; wired to Wave 2.4. **Done:** RTL test: clicking export calls the serializer and appends an audit event.

## Wave 4 — Acceptance + polish

- [x] **4.1 Golden‑path integration test.** Encode SPEC §8 step‑for‑step as one Vitest test driving the store + engine (load → validate → mix assertion → override empty rejected → override with reason accepted → export → audit‑trail contents). **Done:** test passes.
- [x] **4.2 Empty/edge states.** No‑evidence line shows abstain cleanly; export with zero exceptions doesn't crash. **Done:** tests cover both.
- [ ] **4.3 README.** How to run, the determinism rule, where the engine lives, link to `AWS_FUTURE_STATE.md`. **Done:** `README.md` exists.
- [ ] **4.4 Final gate.** All of SPEC §9 holds. **Done:** `npm run build` 0, `npm test` 0 failures, every box above checked.

---

## Verification (the suite the gate checks)

Minimum tests that must exist and pass:
- engine: VALID / each QUESTIONABLE trigger / abstain / QC fail‑safe / de‑ob $ / anomaly
- seed: verdict‑mix snapshot (SPEC §8 distribution)
- state: confirm, override‑empty‑rejected, override‑recorded, audit append‑only
- export: CSV/JSON serializer shape + audit event
- screens: one RTL test per screen (3.1–3.7)
- **golden path: the single SPEC §8 integration test (4.1)**

## Notes for the loop
- If a task is ambiguous, re‑read `SPEC.md` — do not invent scope. New scope → propose an edit to SPEC first.
- Never weaken or delete a test to make the gate pass. Fix the code.
- Keep the engine free of React and of wall‑clock/random calls (determinism is what lets this loop terminate).
