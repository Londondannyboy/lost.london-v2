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
