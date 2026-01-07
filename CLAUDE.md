# Lost London V2 - VIC Voice Assistant

## Overview

Rebuilt Lost London voice assistant using a clean architecture:
- **CopilotKit** for chat UI with Generative UI components
- **Pydantic AI** agent with tools for article search
- **Hume EVI** for voice interface
- **Neon PostgreSQL** with pgvector for hybrid search
- **Railway** (backend) + **Vercel** (frontend) deployment

## Architecture

```
┌──────────────────────────────────────────────────┐
│              Frontend (Vercel)                   │
│  CopilotSidebar + VoiceInput + Generative UI    │
└────────────────┬─────────────────┬───────────────┘
                 │ AG-UI           │ CLM/SSE
                 ▼                 ▼
┌──────────────────────────────────────────────────┐
│           Backend (Railway)                      │
│         Single Pydantic AI Agent                 │
│                                                  │
│  Tools: search_lost_london, show_article_card,  │
│         show_map, show_timeline                  │
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

## Repository Structure

```
lost-london-v2/
├── agent/                       # Pydantic AI backend (Railway)
│   ├── src/
│   │   ├── agent.py            # Agent + dual endpoints (~300 lines)
│   │   ├── tools.py            # Search + phonetic corrections (~200 lines)
│   │   ├── database.py         # RRF hybrid search (~120 lines)
│   │   └── models.py           # Pydantic models
│   ├── pyproject.toml
│   ├── Procfile
│   └── .env.example
│
└── frontend/                    # Next.js frontend (Vercel)
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx        # Main: CopilotSidebar + VoiceInput
    │   │   └── api/
    │   │       ├── copilotkit/route.ts
    │   │       └── hume-token/route.ts
    │   └── components/
    │       ├── providers.tsx
    │       ├── voice-input.tsx
    │       └── generative-ui/
    │           ├── ArticleCard.tsx
    │           ├── ArticleGrid.tsx
    │           ├── LocationMap.tsx
    │           └── Timeline.tsx
    └── .env.example
```

## Agent Tools (Generative UI)

| Tool                  | When Called                    | Renders                 |
|-----------------------|--------------------------------|-------------------------|
| search_lost_london    | "tell me about X"              | ArticleGrid             |
| show_article_card     | mentions specific article      | ArticleCard with image  |
| show_map              | "where is X"                   | OpenStreetMap embed     |
| show_timeline         | "Victorian era", dates         | Timeline visualization  |

## Key Features from Original

### RRF Hybrid Search
Reciprocal Rank Fusion combining vector and keyword search (k=60).
Located in `agent/src/database.py`.

### Phonetic Corrections (70+ entries)
Voice transcription error handling for London place names.
Located in `agent/src/tools.py`.

Examples:
- "fawny/fawney" → "thorney" (Thorney Island)
- "tie burn" → "tyburn"
- "aquarim" → "aquarium"

### VIC Persona
Warm London historian speaking in first person.
Key rules:
- ONLY use source material, never training knowledge
- Go into depth (150-250 words)
- End with follow-up question
- Never re-greet or say "Hello"

## Environment Variables

### Railway (Backend)
```
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
```

### Vercel (Frontend)
```
AGENT_URL=https://your-railway-app.up.railway.app/agui
HUME_API_KEY=...
HUME_SECRET_KEY=...
NEXT_PUBLIC_HUME_CONFIG_ID=...
```

## Local Development

### Backend
```bash
cd agent
uv sync
source .venv/bin/activate
source .env.local  # or export vars manually
uvicorn src.agent:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Backend to Railway
1. Create Railway project
2. Link to `agent/` directory
3. Set environment variables
4. Deploy - Railway will use Procfile

### Frontend to Vercel
1. Create Vercel project
2. Link to `frontend/` directory
3. Set environment variables (including AGENT_URL to Railway)
4. Deploy

### Hume EVI Configuration
1. Go to platform.hume.ai
2. Create new EVI configuration
3. Set CLM URL: `https://your-railway-app.up.railway.app/chat/completions`
4. Set CLM auth header if needed
5. Copy Config ID to frontend env

## Test Queries

1. "Tell me about the Royal Aquarium" - Should find article, show card
2. "fawney island" - Should correct to Thorney Island
3. "Where is Tyburn?" - Should show map
4. "Victorian era" - Should show timeline
5. "Rosie" - Easter egg: "Ah, Rosie, my loving wife!"

## Key Simplifications vs Original

| Original Problem                     | V2 Solution                    |
|--------------------------------------|--------------------------------|
| 1600-line agent.py                   | ~300 lines agent.py            |
| Vercel cold starts                   | Railway persistent process     |
| Complex dual-path architecture       | Single agent, two interfaces   |
| In-memory session lost on restart    | CopilotKit state management    |
| CopilotKit disabled                  | CopilotKit is primary UI       |

## Files Copied From Original

| Source                              | Destination                    | What                    |
|-------------------------------------|--------------------------------|-------------------------|
| lost.london-clm/api/database.py     | agent/src/database.py          | RRF hybrid search       |
| lost.london-clm/api/tools.py        | agent/src/tools.py             | Phonetic corrections    |
| lost.london-clm/api/agent_config.py | agent/src/agent.py             | VIC persona prompt      |
| copilotkit-demo/voice-input.tsx     | frontend/src/components/       | Hume voice widget       |

---

## Phase 2: Multi-Agent Architecture (January 2026)

### Overview

Transform from single-agent to **dual-agent architecture**:
- **VIC** (Orchestrator): Primary voice, storyteller, handles user interaction
- **Librarian** (Research): Surfaces articles, maps, timelines, visual aids

Full plan at: `~/.claude/plans/zippy-swinging-nebula.md`

### Current Implementation Status

#### ✅ Already Implemented
- **Zep API routes** (`src/app/api/zep/user/route.ts`) - Full GET/POST with fact extraction
- **BookStrip component** (`src/components/BookStrip.tsx`) - Dismissible bottom banner
- **Dashboard page** (`src/app/dashboard/page.tsx`) - "My History" with Zep facts
- **Header** (`src/components/Header.tsx`) - Book icon + "My History" link
- **CopilotKit integration** - useRenderToolCall hooks for Generative UI
- **VoiceInput** - Forwards to CopilotKit via appendMessage
- **VIC agent with Zep** (`agent/src/agent.py`) - Backend has full Zep integration

#### 🔲 Remaining to Implement
1. **Librarian Agent** - Create `agent/src/librarian.py`
2. **delegate_to_librarian tool** - Add to agent.py
3. **HITL Tools** - Backend tools + frontend hooks
4. **Dynamic Backgrounds** - Topic-based hero backgrounds
5. **Voice Mode Toggle** - VIC narrates vs dual voice

### Multi-Agent Architecture

```
User speaks → Hume EVI (VIC's voice)
    ↓
CLM endpoint → Orchestrator
    ↓
┌─────────────────────────────────────────────────────────┐
│  VIC Agent                                              │
│  "Ah, Thorney Island! Let me check my archives..."     │
│       ↓ delegates                                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Librarian Agent                                 │   │
│  │  Returns: articles, map, timeline               │   │
│  └─────────────────────────────────────────────────┘   │
│  VIC: "My librarian found 3 articles about..."         │
└─────────────────────────────────────────────────────────┘
    ↓
CopilotKit renders Generative UI
```

### Key Patterns

#### Pydantic AI Agent Delegation
```python
@agent.tool
async def delegate_to_librarian(ctx: RunContext[VICDeps], request: str) -> dict:
    result = await librarian_agent.run(
        request,
        deps=ctx.deps,    # Share dependencies (db, zep, state)
        usage=ctx.usage,  # Aggregate usage metrics
    )
    return {"speaker": "librarian", "content": result.output}
```

#### Human-in-the-Loop (HITL)
- `confirm_article_relevance` - Ask if article matches interest
- `suggest_related_explorations` - Offer related topics
- `save_user_interest` - Confirm before storing to Zep
- `report_inaccuracy` - Allow feedback on incorrect info

#### Dynamic Topic Backgrounds
- Search returns `hero_image_url` from articles table
- Frontend updates background based on current topic
- Smooth CSS transitions (1-2 seconds)

### Updated Repository Structure

```
lost-london-v2/
├── agent/                       # Pydantic AI backend (Railway)
│   ├── src/
│   │   ├── agent.py            # VIC agent + Zep (~600 lines)
│   │   ├── librarian.py        # NEW: Librarian agent
│   │   ├── tools.py            # Search + phonetic corrections
│   │   ├── database.py         # RRF hybrid search
│   │   └── models.py           # Pydantic models
│   └── pyproject.toml
│
└── src/                         # Next.js frontend (Vercel)
    ├── app/
    │   ├── page.tsx            # Main: CopilotSidebar + VoiceInput
    │   ├── dashboard/page.tsx  # My History (Zep facts)
    │   ├── articles/page.tsx   # Browse articles
    │   ├── profile/page.tsx    # User profile
    │   └── api/
    │       ├── copilotkit/route.ts
    │       ├── hume-token/route.ts
    │       ├── zep/user/route.ts    # Zep memory API
    │       └── user-profile/route.ts
    └── components/
        ├── Header.tsx          # Book icon, My History link
        ├── Footer.tsx
        ├── BookStrip.tsx       # Book purchase CTA
        ├── voice-input.tsx     # Hume EVI widget
        └── generative-ui/
            ├── ArticleCard.tsx
            ├── ArticleGrid.tsx
            ├── LocationMap.tsx
            └── Timeline.tsx
```

### Environment Variables (Updated)

```env
# Vercel (Frontend)
AGENT_URL=https://your-railway-app.up.railway.app/agui
HUME_API_KEY=...
HUME_SECRET_KEY=...
NEXT_PUBLIC_HUME_CONFIG_ID=...
ZEP_API_KEY=z_...
BETTER_AUTH_SECRET=...

# Railway (Backend)
DATABASE_URL=postgresql://...@neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
ZEP_API_KEY=z_...
```

### Key Learnings

1. **Voice-to-CopilotKit Integration**: Voice messages forward via `appendMessage`, agent runs tools, `useRenderToolCall` renders Generative UI in sidebar

2. **Zep Memory**: Graph search for user facts, automatic fact extraction from messages, returning user recognition

3. **Pydantic AI Multi-Agent**: Use `deps=ctx.deps` and `usage=ctx.usage` for shared state and metrics across delegated agents

4. **AG-UI vs A2A**:
   - AG-UI (to_ag_ui) = Agent-to-UI protocol, used with CopilotKit
   - A2A (to_a2a) = Agent-to-Agent for external services (not needed for internal delegation)

5. **HITL with CopilotKit**: Tools return `hitl: true`, frontend `useHumanInTheLoop` hook renders UI and calls `respond()`

### References

- Pydantic AI Multi-Agent: https://ai.pydantic.dev/multi-agent-applications/
- Pydantic AI A2A: https://ai.pydantic.dev/a2a/
- CopilotKit AG-UI: https://docs.copilotkit.ai
- CopilotKit HITL: https://docs.copilotkit.ai/pydantic-ai/human-in-the-loop
- Hume EVI: https://dev.hume.ai/docs/speech-to-speech-evi
- Zep Memory: https://help.getzep.com
