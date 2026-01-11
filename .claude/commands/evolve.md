# System Evolution Command

Run this after fixing a bug or completing a feature to improve the system.

## Process

1. **Identify the Issue**
   - What went wrong?
   - Was it a coding mistake, missing context, or process gap?

2. **Determine Root Cause**
   - Did the LLM lack a rule?
   - Was there missing reference documentation?
   - Did a command/workflow need updating?

3. **Update the System**

   ### If it's a coding convention issue:
   Add rule to `CLAUDE.md` under appropriate section.

   ### If it's domain-specific knowledge:
   Add or update a reference file in `.claude/reference/`

   ### If it's a workflow issue:
   Update or create a command in `.claude/commands/`

4. **Document the Learning**
   Add to the "Lessons Learned" section below.

---

## Lessons Learned

### Jan 10, 2026: Iframe Click-Through
**Bug:** Maps weren't clickable because iframe captured click events.
**Fix:** Add `pointerEvents: 'none'` to iframe styles.
**Rule Added:** When embedding iframes inside clickable containers, always add `pointer-events: none` to allow clicks to pass through.

### Jan 10, 2026: Zep Thread-Based Memory
**Bug:** Zep wasn't returning conversation history properly.
**Fix:** Switch from `graph.add()` to `thread.add_messages()` and use `thread.get_user_context()`.
**Reference Added:** `.claude/reference/zep-integration.md`

### Jan 10, 2026: Greeting Not Using Function
**Bug:** CLM endpoint had hardcoded greetings instead of using `generate_returning_user_greeting()`.
**Fix:** Updated CLM to call the function which handles Keegan family special cases.
**Rule:** Always use centralized functions for repeated logic (DRY principle applies to AI coding too).

### Jan 10, 2026: Topic Change "Elastic Band" Effect
**Bug:** TSCA worked TOO well - users felt "elastic-banded" back to original topic when trying to change.
**Fix:** Added topic change confirmation flow:
1. Detect when user mentions new topic (different from current anchor)
2. Ask "Shall we leave X and explore Y instead?"
3. Wait for user confirmation before switching anchor
**Files Changed:**
- `agent.py`: Added `pending_topic`, `is_topic_change_request()`, confirmation handling
- `TopicChangeConfirmation.tsx`: HITL UI component near VIC avatar
- `page.tsx`: Detect topic changes in voice messages, render confirmation
**Reference Added:** `CLAUDE.md` updated with Topic Change Confirmation section
**Rule:** When context anchoring is too strong, add explicit user confirmation for context switches.

---

## How to Use This

After any bug fix, run:
```
/evolve
```

Then answer:
1. What was the bug?
2. What was the root cause?
3. What should be added to rules/reference/commands to prevent this?
