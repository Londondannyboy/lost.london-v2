# Prime Command

Load essential context for the Lost London project before starting any work.

## Instructions

1. Read the PRD and current status:
   - `CLAUDE.md` - Project overview, architecture, known issues
   - `RESTART_PLAN_JAN_2026.md` - Current implementation plan

2. Understand the codebase structure:
   - `agent/src/agent.py` - VIC backend (CLM endpoint, Zep, two-stage voice)
   - `src/app/page.tsx` - Main frontend with CopilotKit integration
   - `src/components/generative-ui/` - Custom UI components

3. Check recent changes:
   - Run `git log --oneline -10` to see recent commits
   - Run `git status` to see uncommitted changes

4. After priming, ask: "Based on the PRD and current state, what should we work on next?"

## Key Context Files
- `/Users/dankeegan/lost-london-v2/CLAUDE.md`
- `/Users/dankeegan/lost-london-v2/RESTART_PLAN_JAN_2026.md`
- `/Users/dankeegan/lost-london-v2/agent/src/agent.py`
- `/Users/dankeegan/lost-london-v2/src/app/page.tsx`
