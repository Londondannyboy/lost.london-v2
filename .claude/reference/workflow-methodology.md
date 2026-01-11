# Lost London Workflow Methodology

Based on Cole Medin's 5 Techniques for Agentic Coding.

## 1. PRD-First Development

Before any major feature, create a Product Requirements Document:

```markdown
# Feature: [Name]

## Problem Statement
What issue are we solving?

## User Story
As a [user type], I want [goal] so that [benefit].

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Technical Approach
High-level implementation plan.

## Files to Modify
- file1.py: What changes
- file2.tsx: What changes

## Acceptance Test
How to verify the feature works.
```

Store PRDs in `.claude/prd/` for reference.

---

## 2. Modular Rules Architecture

### Structure
```
.claude/
├── commands/       # Workflow commands (deploy, test, evolve)
├── reference/      # Domain knowledge (Zep, CopilotKit, architecture)
├── prd/           # Product requirements documents
└── rules/         # Coding conventions (future)

CLAUDE.md           # Main project context (loaded automatically)
```

### Key Files

| File | Purpose | When to Load |
|------|---------|--------------|
| `CLAUDE.md` | Core project context | Always (auto) |
| `reference/zep-integration.md` | Zep API patterns | Working on memory/greetings |
| `reference/workflow-methodology.md` | This file | Planning new features |
| `commands/deploy.md` | Deployment checklist | Before deploying |
| `commands/evolve.md` | System evolution | After fixing bugs |

---

## 3. Command-ify Everything

### Available Commands

| Command | Purpose |
|---------|---------|
| `/deploy` | Deploy to Railway + Vercel |
| `/test-zep` | Test Zep memory integration |
| `/evolve` | Document learnings after bug fixes |

### Creating New Commands

1. Create `.claude/commands/[name].md`
2. Document the workflow steps
3. Use consistently

---

## 4. Context Reset Between Planning and Execution

### Planning Phase
- Explore codebase thoroughly
- Read all relevant files
- Create implementation plan
- Get user approval

### Execution Phase
- Fresh context after approval
- Focus on implementation
- Use todo list for tracking
- Test as you go

### Why This Matters
- Planning needs broad context
- Execution needs focused context
- Prevents context exhaustion

---

## 5. System Evolution Mindset

After every bug fix or feature:

### 1. Identify the Issue
- What went wrong?
- Coding mistake, missing context, or process gap?

### 2. Determine Root Cause
- Did the LLM lack a rule?
- Was there missing reference documentation?
- Did a command/workflow need updating?

### 3. Update the System

| If... | Then... |
|-------|---------|
| Coding convention issue | Add rule to `CLAUDE.md` |
| Domain-specific knowledge | Add/update reference file |
| Workflow issue | Update/create command |

### 4. Document the Learning
Add to `commands/evolve.md` Lessons Learned section.

---

## Lost London Specific Patterns

### Two-Stage Voice Architecture
```
Stage 1: Instant (<0.7s)
- Keyword cache lookup
- Fast LLM teaser
- Background loading starts

Stage 2: Full Response
- Pre-loaded content ready
- User says "yes" → instant playback
```

### TSCA (Two-Stage Contextual Anchoring)
Prevents topic drift across conversation turns:
- `current_topic_context` anchors responses
- `conversation_history` provides continuity
- `pending_topic` handles topic changes

### HITL (Human-in-the-Loop) Patterns
UI confirmation for:
- Topic changes: `TopicChangeConfirmation.tsx`
- Interest storage: `ConfirmInterest.tsx`

### File Locations
| Pattern | Backend | Frontend |
|---------|---------|----------|
| Session management | `agent.py:60-200` | N/A |
| Topic anchoring | `agent.py:180-350` | N/A |
| Voice handling | `agent.py:1800+` | `voice-input.tsx` |
| HITL components | N/A | `src/components/` |

---

## Daily Workflow

### Starting a Session
1. Read `CLAUDE.md` (auto-loaded)
2. Understand current task
3. Load relevant reference files
4. Use todo list for complex tasks

### During Development
1. Make incremental changes
2. Test frequently
3. Commit logical units
4. Update documentation

### Before Deploying
1. Run `/deploy` command
2. Verify build passes
3. Check Railway logs
4. Test in production

### After Bug Fixes
1. Run `/evolve` command
2. Document the learning
3. Update relevant files
4. Prevent recurrence
