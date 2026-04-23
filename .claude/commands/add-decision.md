---
description: Log a new architectural decision to docs/DECISIONS.md with proper context, rationale, and consequences.
---

You are adding a new decision record to `docs/DECISIONS.md`. This is used when a non-trivial architectural or product decision is made and needs to be remembered across sessions.

## When to use this command

Use whenever:
- A choice is made between multiple viable approaches (library, pattern, data model)
- A departure from defaults is taken for a specific reason
- A scope decision is made (building X now vs. deferring to V2)
- A workaround is adopted that future-you should know about

Do NOT use for:
- Routine implementation details (which helper function to name what)
- Choices fully covered by ARCHITECTURE.md already
- Bug fixes (those go in CHANGELOG.md)

## Steps

1. **Ask the user** for the decision details if not already clear from context:
   - Title (short, descriptive)
   - Context (what question were we facing?)
   - Decision (what was chosen?)
   - Rationale (why? what alternatives?)
   - Consequences (what does this commit us to?)

2. **Append to `docs/DECISIONS.md`** using this format:

   ```markdown
   ## YYYY-MM-DD: [Decision title]

   **Status:** Accepted

   **Context:** [What was the problem or question?]

   **Decision:** [What did we decide?]

   **Alternatives considered:**
   - [Alternative 1] — [why not]
   - [Alternative 2] — [why not]

   **Rationale:** [Why this choice?]

   **Consequences:**
   - [Positive consequence]
   - [Tradeoff accepted]
   - [Future implications]

   **Related:** [Links to ARCHITECTURE.md sections, issues, or prior decisions]
   ```

3. **If the decision contradicts or updates ARCHITECTURE.md**, also update ARCHITECTURE.md to stay consistent. Add a note in the decision record: `**Updates:** ARCHITECTURE.md §X.Y`.

4. **Commit** the change with: `docs(decisions): [decision title]`

5. **Confirm** to the user that the decision has been logged and committed.
