---
description: Load context from documentation files at the start of a Claude Code session. Run this first.
---

You are starting a new session on the Phloz project. Before doing anything else, perform this orientation:

1. Read `CLAUDE.md` (at repo root) — these are the project rules
2. Read `docs/ARCHITECTURE.md` — the source of truth for all structural decisions
3. Read `docs/ROADMAP.md` — which phase we are in and what's next
4. Read `docs/NEXT-STEPS.md` — the immediate queued actions
5. Read `docs/CHANGELOG.md` — skim the most recent 3 entries to understand where the last session left off
6. Read `docs/KNOWN-ISSUES.md` — skim for anything relevant to current work

Then, produce a brief summary in chat:

- **Where we are:** Which phase, which step, last session's outcome
- **What's next:** The top 1-3 actions from NEXT-STEPS.md
- **Any blockers or open questions:** From KNOWN-ISSUES.md or recent DECISIONS.md

Ask the user to confirm the plan or redirect before starting work.

Do NOT start writing code until the user confirms the plan.

If any of the required doc files are missing, surface that as a blocker — the user needs to have completed initial setup per PROMPT_1.md before proceeding.
