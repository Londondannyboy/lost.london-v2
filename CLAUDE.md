# Lost London V2 - VIC Voice Assistant

## Overview

Dual-agent voice-first London history assistant:
- **VIC** (Hume EVI voice): Storyteller - warm, elaborate narration
- **London Librarian** (CopilotKit UI): Researcher - concise facts, visual components

**Stack:**
- **Frontend**: Next.js 16 + CopilotKit + Hume EVI (Vercel)
- **Backend**: Pydantic AI agents + FastAPI (Railway)
- **Database**: Neon PostgreSQL + pgvector (370+ articles)
- **Memory**: Zep for user context

---

## Architecture

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
│               └─ surface_map / surface_timeline │
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

## Repository Structure

```
lost-london-v2/
├── agent/                       # Pydantic AI backend (Railway)
│   ├── src/
│   │   ├── agent.py            # VIC agent + CLM/AG-UI endpoints
│   │   ├── librarian.py        # Librarian agent + tools
│   │   ├── tools.py            # Search + phonetic corrections
│   │   ├── database.py         # RRF hybrid search
│   │   └── models.py           # Pydantic models
│   ├── pyproject.toml
│   └── Procfile
│
└── src/                         # Next.js frontend (Vercel)
    ├── app/
    │   ├── page.tsx            # Main: CopilotSidebar + VoiceInput
    │   ├── dashboard/          # User history
    │   └── api/
    │       ├── copilotkit/route.ts
    │       ├── hume-token/route.ts
    │       └── zep/user/route.ts
    └── components/
        ├── voice-input.tsx     # Hume EVI widget
        ├── LibrarianAvatar.tsx # Librarian indicator
        ├── ChatMessages.tsx    # Custom message components
        └── generative-ui/
            ├── TopicContext.tsx    # Combined articles/map/timeline
            ├── ArticleCard.tsx
            ├── ArticleGrid.tsx
            ├── LocationMap.tsx
            ├── Timeline.tsx
            └── BookDisplay.tsx
```

---

## Key Implementation Details

### Dual-Agent Pattern

```python
# agent.py - VIC delegates to Librarian
@agent.tool
async def delegate_to_librarian(ctx: RunContext[VICDeps], request: str) -> dict:
    result = await librarian_agent.run(request, deps=librarian_deps)
    return {
        "speaker": "librarian",
        "ui_component": result.data.get("ui_component"),
        "ui_data": result.data,
    }
```

### Librarian-Only CopilotKit

The CopilotKit sidebar shows ONLY Librarian output. VIC's text is suppressed - his voice handles storytelling.

```typescript
// page.tsx - Suppress VIC text, show only tool UI
function LibrarianOnlyAssistant({ message }) {
  const generativeUI = message?.generativeUI?.();
  if (generativeUI) {
    return (
      <div className="flex gap-3 mb-4">
        <LibrarianAvatar />
        <div className="flex-1">{generativeUI}</div>
      </div>
    );
  }
  return null; // VIC's text suppressed
}
```

### Dynamic Backgrounds

When Librarian finds an article with `featured_image_url`, the hero section background updates:

```typescript
// page.tsx
const [topicBackground, setTopicBackground] = useState<string | null>(null);

// In delegate_to_librarian render
{uiData?.hero_image && <BackgroundUpdater imageUrl={uiData.hero_image} />}
```

### Era Detection

Extracts historical era from article content - first by keywords, then by years:

```python
# tools.py
def extract_era_from_content(content: str) -> Optional[str]:
    # Check keywords first (victorian, georgian, etc.)
    # Then detect years and map to eras (1837-1901 = Victorian)
```

### RRF Hybrid Search

Reciprocal Rank Fusion combining vector (Voyage) and keyword search:

```python
# database.py
# RRF_score = 1/(60 + vector_rank) + 1/(60 + keyword_rank)
```

### Phonetic Corrections

70+ corrections for voice transcription errors:
- "fawny/fawney" → "thorney" (Thorney Island)
- "tie burn" → "tyburn"
- "aquarim" → "aquarium"

---

## Environment Variables

### Vercel (Frontend)
```
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=...
HUME_SECRET_KEY=...
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
ZEP_API_KEY=z_...
DATABASE_URL=postgresql://...
```

### Railway (Backend)
```
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
ZEP_API_KEY=z_...
```

---

## Implementation Status

### Phase 1-2: Core Multi-Agent ✅
- [x] Librarian Agent (`librarian.py`)
- [x] `delegate_to_librarian` tool
- [x] LibrarianAvatar component
- [x] TopicContext (combined UI)
- [x] Librarian-only CopilotKit (VIC text suppressed)
- [x] Dynamic backgrounds from article images
- [x] Era detection from dates
- [x] Featured image from database

### Phase 3-6: Remaining
- [ ] HITL Tools (confirm relevance, suggest explorations)
- [ ] Zep memory for confirmed interests
- [ ] BookStrip (purchase CTA banner)
- [ ] Dashboard knowledge graph
- [ ] **Librarian Voice Mode** (separate Hume voice)
- [ ] Dual Voice toggle (VIC + Librarian)

---

## Moonshot: Librarian Voice Mode

The vision includes the Librarian speaking as a voice agent:

1. **Create separate Hume EVI config** - Different voice (scholarly, crisp)
2. **Modify CLM endpoint** - Handle `speaker=librarian` context
3. **Frontend voice toggle** - User preference in settings
4. **Voice handoff protocol** - VIC → Librarian → VIC transitions

See `MOONSHOT_RESTART_PLAN.md` for full details.

---

## Local Development

```bash
# Frontend
npm run dev

# Backend
cd agent && source .venv/bin/activate
uvicorn src.agent:app --reload --port 8000
```

## Deployment

Both deploy automatically on push to main:
- **Frontend**: Vercel (auto-deploy)
- **Backend**: Railway (auto-deploy)

---

## Test Queries

1. "Tell me about the Royal Aquarium" - Articles + map + Victorian timeline
2. "fawney island" - Phonetic correction to Thorney Island
3. "Where is Tyburn?" - Map of Tyburn gallows
4. "Victorian era" - Timeline visualization
5. "Your books" - Book purchase display

---

## References

- **Moonshot Plan**: `MOONSHOT_RESTART_PLAN.md`
- **Original Plan**: `~/.claude/plans/tranquil-skipping-abelson.md`
- **CopilotKit Docs**: https://docs.copilotkit.ai
- **Pydantic AI**: https://ai.pydantic.dev/multi-agent-applications/
- **Hume EVI**: https://dev.hume.ai/docs/speech-to-speech-evi
- **Zep Memory**: https://help.getzep.com
