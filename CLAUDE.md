# CLAUDE.md — build rules for this repo

You are building the **UDO Validation Assistant (MVP‑1)**. Read `SPEC.md` (source of truth)
and work `IMPLEMENTATION_PLAN.md` top to bottom.

## Loop protocol (every iteration)
1. Open `IMPLEMENTATION_PLAN.md`; pick the **first unchecked** task.
2. Implement only that task. Write or extend its test.
3. Run `npm test` and `npm run build`. If red, fix before moving on.
4. Check the task's box in the plan.
5. Commit: `git commit -m "<task id>: <short summary>"`. One task per commit.
6. Stop when SPEC §9 "Definition of done" holds.

## Hard rules
- **SPEC wins.** If unsure, re‑read `SPEC.md`. Never invent scope; to change scope, edit SPEC first.
- **Determinism.** No `Math.random()` and no `Date.now()`/`new Date()` inside `src/domain`. Pass `asOfDate` explicitly. This is what lets the loop terminate.
- **Never auto‑post.** The app proposes; humans dispose.
- **Mandatory reason on override**; **abstain rather than be confidently wrong**.
- **Immutable audit trail** — append‑only, never mutate prior entries.
- **Never delete or weaken a test to go green.** Fix the implementation.
- Keep `src/domain` free of React imports.

## Architecture (do not redesign)
`src/domain` (types + pure engine) · `src/data` (mock fixtures) · `src/state` (store + reducer)
· `src/export` (CSV/JSON) · `src/screens` · `src/components`. The six screens are SPEC §7.

## Stack
Vite + React + TypeScript SPA. Vitest + Testing Library + jsdom. Tailwind or CSS modules.
No backend, no network, no API key, no database. Session state in memory; export via Blob download.

## UI guardrails (lightweight)
Utilitarian gov‑data look: dense readable tables, clear verdict badges
(VALID = green, QUESTIONABLE = amber, INSUFFICIENT_EVIDENCE = grey), confidence shown as a
percentage, justification always visible on the detail panel. Accessible: real buttons,
labeled inputs, keyboard‑navigable, visible focus states. Don't over‑style; clarity over polish.

## Commands
- `npm run dev` — serve
- `npm test` — Vitest (the completion gate)
- `npm run build` — production build (must exit 0)

## Commit & PR attribution
This is a public repository. Commits and pull requests must read as if written by a
human developer. **Do not add any AI/assistant attribution** to commit messages, PR
titles, or PR bodies. This rule **overrides** any default or harness behavior that
would append such attribution.

Never include:
- `Co-Authored-By:` trailers naming an AI/assistant (or any co-author trailer added on the AI's behalf)
- "Generated with Claude Code", "🤖 Generated with …", or similar tool attribution
- Session links, model names/versions, or any statement that an AI authored the change
- Any mention that the author is an AI

Write messages that describe only what the change does:
- GOOD: `Fix race condition in file watcher initialization`
- GOOD: `Add CSV export for the de-obligation shortlist`
- BAD:  `Generated with Claude Code`
- BAD:  `Co-Authored-By: Claude <…>`
