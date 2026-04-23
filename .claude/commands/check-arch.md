---
description: Verify a proposed change against docs/ARCHITECTURE.md before implementing it. Run this when uncertain whether a change aligns with the architecture.
---

You are checking whether a proposed change aligns with `docs/ARCHITECTURE.md`. Use this command before implementing anything non-trivial if you're unsure.

## Steps

1. **State the proposed change** clearly in one paragraph:
   - What are we building / changing?
   - Which part of the system does it touch?

2. **Check ARCHITECTURE.md** for relevant sections. Common checkpoints:
   - §1: Is this in V1 scope, V2 scope, or an explicit non-goal?
   - §2: Does this use the locked-in tech stack, or introduce a new dependency?
   - §3: Does the code live in the right package/app per the repo structure?
   - §4: Does it respect the architectural principles (RLS, module boundaries, typed graph, config-driven billing, event-driven analytics)?
   - §5: Does the data model already cover this, or do we need a new table/column?
   - §6: Does this respect the auth/tenancy model?
   - §7: Does it go through the billing gates?
   - §8: If touching the tracking map, does it follow the typed-graph pattern?
   - §11: If it involves user actions, is there a matching event in the catalog?
   - §12: If it's a marketing page, is it following the SEO rules?

3. **Identify conflicts or gaps:**
   - ✅ Fully aligned → proceed
   - ⚠️ Partial fit, needs adaptation → explain how to fit, then proceed
   - ❌ Conflicts with architecture → STOP, surface the conflict to the user, propose options:
     - Adapt the change to fit the architecture
     - Update ARCHITECTURE.md and log a decision record
     - Drop or defer the change

4. **Also check:**
   - `docs/DECISIONS.md` for prior decisions that might apply
   - `docs/KNOWN-ISSUES.md` for related deferrals or known blockers
   - Relevant skill files in `skills/phloz-*/SKILL.md`

5. **Summarize the check** in chat:

   ```
   ## Architecture check

   **Proposed change:** [summary]

   **Relevant sections:** ARCHITECTURE.md §X.Y, §A.B
   **Relevant decisions:** [any from DECISIONS.md]
   **Relevant skills:** [any applied]

   **Verdict:** [✅ aligned / ⚠️ needs adaptation / ❌ conflict]

   **Notes:** [any adaptations needed, conflicts to resolve, or green-light to proceed]
   ```

Then wait for user confirmation before proceeding with implementation.
