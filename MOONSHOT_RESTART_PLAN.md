# Lost London V2 - Moonshot Restart Plan

**Created:** January 2026
**Last Session:** Librarian-only CopilotKit + dynamic backgrounds
**Git Commit:** 376a6cf

---

## Project Vision

A **dual-agent voice-first** London history experience:
- **VIC** (Hume EVI voice): The storyteller - warm, elaborate narration via voice
- **London Librarian** (CopilotKit UI): The researcher - concise facts, visual components

The architecture solves the core UX problem: voice and text saying different things at different times. By making this *intentional* with two distinct agents, we turn a bug into a feature.

---

## Current Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend (Vercel)                   │
│  CopilotSidebar (Librarian UI) + VoiceInput     │
└────────────────┬─────────────────┬───────────────┘
                 │ AG-UI           │ CLM/SSE
                 ▼                 ▼
┌──────────────────────────────────────────────────┐
│           Backend (Railway)                      │
│                                                  │
│   VIC Agent (Orchestrator)                       │
│     └─ delegate_to_librarian tool               │
│           └─ Librarian Agent                    │
│               └─ surface_topic_context          │
│               └─ surface_articles               │
│               └─ surface_map                    │
│               └─ surface_timeline               │
│               └─ surface_books                  │
│                                                  │
│  Endpoints:                                      │
│   - /agui (AG-UI for CopilotKit)                │
│   - /chat/completions (CLM for Hume EVI)        │
└────────────────┬─────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │  Neon DB       │
         │  (pgvector)    │
         │  370+ articles │
         └────────────────┘
```

---

## What's Been Implemented

### Phase 1-2: Core Multi-Agent ✅

| Component | Status | Location |
|-----------|--------|----------|
| Librarian Agent | ✅ Done | `agent/src/librarian.py` |
| delegate_to_librarian tool | ✅ Done | `agent/src/agent.py:714` |
| LibrarianAvatar component | ✅ Done | `src/components/LibrarianAvatar.tsx` |
| TopicContext (combined UI) | ✅ Done | `src/components/generative-ui/TopicContext.tsx` |
| Librarian-only CopilotKit | ✅ Done | `src/app/page.tsx` (LibrarianOnlyAssistant) |
| Dynamic backgrounds | ✅ Done | `src/app/page.tsx` (BackgroundContext) |
| Era detection from dates | ✅ Done | `agent/src/tools.py:228` |
| Featured image from DB | ✅ Done | `agent/src/database.py` (featured_image_url) |

### Phase 3-6: Remaining Work

| Phase | Feature | Status |
|-------|---------|--------|
| 3 | HITL Tools (confirm relevance, suggest explorations) | 🔲 Not started |
| 3 | Zep memory for confirmed interests | 🔲 Not started |
| 5 | BookStrip (purchase CTA banner) | 🔲 Not started |
| 5 | Dashboard knowledge graph | 🔲 Not started |
| 6 | **Librarian Voice Mode** | 🔲 Not started |
| 6 | Dual Voice toggle (VIC + Librarian) | 🔲 Not started |

---

## Key Files Reference

### Backend (Railway - `agent/src/`)

| File | Purpose | Key Functions |
|------|---------|---------------|
| `agent.py` | VIC orchestrator agent | `delegate_to_librarian()`, `show_books()`, CLM + AG-UI endpoints |
| `librarian.py` | Librarian research agent | `surface_topic_context()`, `surface_articles()`, `surface_map()`, `surface_timeline()`, `surface_books()` |
| `database.py` | Neon PostgreSQL + RRF search | `search_articles_hybrid()`, `get_article_by_slug()` |
| `tools.py` | Search + phonetic corrections | `search_articles()`, `normalize_query()`, `extract_era_from_content()`, `extract_location_from_content()` |
| `models.py` | Pydantic models | `Article`, `SearchResults`, `LibrarianDelegation`, `SpeakerSegment` |

### Frontend (Vercel - `src/`)

| File | Purpose | Key Components |
|------|---------|----------------|
| `app/page.tsx` | Main page + CopilotKit | `LibrarianOnlyAssistant`, `BackgroundUpdater`, useRenderToolCall hooks |
| `components/LibrarianAvatar.tsx` | Librarian visual indicator | `LibrarianAvatar`, `LibrarianMessage`, `LibrarianThinking` |
| `components/ChatMessages.tsx` | Custom chat messages | `CustomUserMessage`, `ChatUserContext` |
| `components/voice-input.tsx` | Hume EVI widget | Voice recording + CLM forwarding |
| `components/generative-ui/*.tsx` | UI components | `TopicContext`, `ArticleCard`, `ArticleGrid`, `LocationMap`, `Timeline`, `BookDisplay` |

---

## Environment Variables

### Vercel (Frontend)
```env
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=FS313vtpHE8svozXdt7hAs3m0U4rd0dJwV1VW0fWF9cewu79
HUME_SECRET_KEY=4LF8hFTCcMhbl3fbuOO8UGAKpoXdJ91xWjnSUTrCfhsV8GN20A2Xkgs0Y4tPXXbN
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
ZEP_API_KEY=z_...
BETTER_AUTH_SECRET=...
DATABASE_URL=postgresql://...
```

### Railway (Backend)
```env
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
ZEP_API_KEY=z_...
```

---

## MOONSHOT: Librarian Voice Mode (Phase 6)

The original vision includes **the Librarian speaking as a voice agent**. This would create true dual-voice experience:

### Implementation Path

1. **Create separate Hume EVI config for Librarian**
   - Different voice (scholarly, crisp)
   - Same CLM endpoint but with `speaker=librarian` context

2. **Modify CLM endpoint to handle multi-speaker**
   ```python
   # In agent.py CLM endpoint
   if request.speaker == "librarian":
       result = await librarian_agent.run(message, deps=deps)
   else:
       result = await vic_agent.run(message, deps=deps)
   ```

3. **Frontend voice mode toggle**
   - `src/app/settings/page.tsx` - User preference
   - `src/components/voice-input.tsx` - Switch Hume config based on mode

4. **Voice handoff protocol**
   - VIC: "Let me have my librarian look into that..."
   - [Switch to Librarian voice]
   - Librarian: "I found 3 articles about the Royal Aquarium..."
   - [Switch back to VIC voice]
   - VIC: "Ah yes, what a fascinating place it was..."

### Hume EVI Configuration
- **VIC Voice**: Warm, storyteller (current config: `6b57249f-a118-45ce-88ab-b80899bf9864`)
- **Librarian Voice**: TBD - scholarly, efficient, slightly formal

---

## HITL (Human-in-the-Loop) Implementation

### Backend Tools to Add (`librarian.py`)

```python
@librarian_agent.tool
async def confirm_article_relevance(ctx: RunContext[LibrarianDeps], article_id: str, question: str) -> dict:
    """Ask user if this article matches what they're looking for."""
    return {
        "hitl": True,
        "type": "confirm",
        "article_id": article_id,
        "question": question,
        "options": ["Yes, perfect!", "Not quite", "Show me more options"],
    }

@librarian_agent.tool
async def suggest_related_explorations(ctx: RunContext[LibrarianDeps], suggestions: list[str]) -> dict:
    """Offer related topics to explore."""
    return {
        "hitl": True,
        "type": "suggestions",
        "options": suggestions,
    }

@librarian_agent.tool
async def save_user_interest(ctx: RunContext[LibrarianDeps], interest: str) -> dict:
    """Confirm before saving interest to memory."""
    return {
        "hitl": True,
        "type": "save_interest",
        "interest": interest,
        "question": f"Should I remember your interest in {interest}?",
    }
```

### Frontend HITL Hooks (`page.tsx`)

```typescript
import { useHumanInTheLoop } from "@copilotkit/react-core";

// Confirmation hook
useHumanInTheLoop({
  name: "confirm_article_relevance",
  render: ({ result, respond }) => (
    <ConfirmationCard
      question={result.question}
      onConfirm={() => respond({ confirmed: true })}
      onReject={() => respond({ confirmed: false })}
    />
  ),
});

// Suggestions hook
useHumanInTheLoop({
  name: "suggest_related_explorations",
  render: ({ result, respond }) => (
    <SuggestionChips
      options={result.options}
      onSelect={(topic) => respond({ selected: topic })}
    />
  ),
});
```

---

## Known Issues & Fixes Applied

| Issue | Fix | Commit |
|-------|-----|--------|
| VIC text appears before voice | Made CopilotKit Librarian-only | 376a6cf |
| Librarian avatar misaligned | Same flex layout as user messages | 376a6cf |
| hero_image_url not showing | Column is `featured_image_url` | 376a6cf |
| Era not detected (Royal Aquarium) | Added year-based era detection | 376a6cf |
| Timeline/Map not showing | Improved extraction logic | 376a6cf |

---

## Testing Checklist

### Voice Flow
- [ ] "Tell me about Royal Aquarium" → VIC speaks, Librarian shows articles/map/timeline
- [ ] "Thorney Island" → Background changes to featured image
- [ ] "fawny island" → Phonetic correction to "Thorney Island"

### UI Components
- [ ] ArticleCard shows featured image
- [ ] TopicContext has tabs (Articles/Map/Timeline)
- [ ] Librarian avatar aligned with user/VIC messages
- [ ] Dynamic background transitions smoothly

### Memory
- [ ] Returning user recognition ("Welcome back, Dan")
- [ ] Recent interests shown in dashboard

---

## Next Session Priority

1. **Test the deployed changes** - Verify Librarian-only mode works
2. **Implement HITL tools** - Start with `suggest_related_explorations`
3. **Add BookStrip** - Purchase CTA for Vic's books
4. **Plan Librarian Voice Mode** - Research Hume multi-config setup

---

## References

- **Original Plan**: `~/.claude/plans/tranquil-skipping-abelson.md`
- **CopilotKit Docs**: https://docs.copilotkit.ai
- **Pydantic AI Multi-Agent**: https://ai.pydantic.dev/multi-agent-applications/
- **Hume EVI**: https://dev.hume.ai/docs/speech-to-speech-evi
- **Zep Memory**: https://help.getzep.com

---

## Commands

### Local Development
```bash
# Frontend
cd /Users/dankeegan/lost-london-v2
npm run dev

# Backend
cd agent
source .venv/bin/activate
uvicorn src.agent:app --reload --port 8000
```

### Deployment
```bash
# Frontend deploys automatically on push to main (Vercel)
# Backend deploys automatically on push (Railway)
git add -A && git commit -m "message" && git push
```

### Database
```bash
# Test query
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT title, featured_image_url FROM articles WHERE title ILIKE '%royal aquarium%'\`.then(console.log);
"
```
