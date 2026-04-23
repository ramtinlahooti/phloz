---
description: Wrap up a Claude Code session cleanly. Updates all doc files, commits, and hands off to the next session. Run this at the end of every session.
---

You are wrapping up a Claude Code session on the Phloz project. Execute this checklist in order, without skipping steps:

## 1. Code state

- Ensure all new code is committed using conventional commit format:
  - `feat(scope): description`
  - `fix(scope): description`
  - `docs(scope): description`
  - `refactor(scope): description`
  - `test(scope): description`
  - `chore(scope): description`
- If there are uncommitted changes, commit them now
- Run `pnpm check` (typecheck + lint + unit tests) and confirm it passes
- If something fails, fix it now — do NOT leave the repo broken

## 2. Update `docs/CHANGELOG.md`

Append a new dated entry at the top:

```markdown
## YYYY-MM-DD

### Added
- Feature X in `packages/foo`
- New component Y in `apps/app`

### Changed
- Refactored Z

### Fixed
- Bug W

### Files touched
- `packages/foo/bar.ts`
- `apps/app/app/...`
```

Use today's date. Be concrete — list actual files and changes, not vague summaries.

## 3. Update `docs/ROADMAP.md`

- Check off items completed this session with `[x]`
- Flag any items that turned out to be blocked with `[blocked]` and a one-line reason
- Do NOT remove or rewrite the roadmap structure — only update status

## 4. Update `docs/NEXT-STEPS.md`

**Rewrite this file completely.** It should always be 3–10 concrete, actionable bullets for the next session. Each bullet:

- Starts with an action verb
- References specific files or features
- Is small enough to fit in one session step
- Ordered by priority

Example:

```markdown
# Next Steps (as of 2026-04-23)

1. Complete Drizzle schema for `tracking_nodes` and `tracking_edges` in `packages/db/schema/`
2. Write RLS policies for both tables in `packages/db/rls/`
3. Add pgTAP tests verifying workspace isolation for tracking tables
4. Scaffold React Flow empty state in `apps/app/app/(dashboard)/[workspace]/clients/[clientId]/page.tsx`
5. Set up Inngest dev environment in `apps/app/inngest/`
```

## 5. Update `docs/DECISIONS.md` (if applicable)

If any non-trivial architectural decision was made this session, append an entry:

```markdown
## YYYY-MM-DD: [Decision title]

**Context:** What was the question or problem?

**Decision:** What did we decide?

**Rationale:** Why? What alternatives were considered?

**Consequences:** What does this commit us to / away from?
```

## 6. Update `docs/KNOWN-ISSUES.md` (if applicable)

Append anything discovered this session that was deferred:

```markdown
## YYYY-MM-DD: [Issue title]

**Description:** What's the issue?

**Impact:** Who is affected? How badly?

**Workaround:** Is there one?

**Planned fix:** When / how?
```

## 7. Push to GitHub

```bash
git push
```

If the push fails (auth, remote out of sync, etc.), surface it to the user — do not force-push.

## 8. Session summary

Produce a brief summary in chat:

- **What was completed this session** (2-5 bullets)
- **What's next** (top 3 items from the updated NEXT-STEPS.md)
- **Any flags or blockers** the user should know about
- **Session health:** did `pnpm check` pass? Is CI green?

End the session cleanly. Do not start new work after running this command.
