# LOST LONDON V2 - Comprehensive Restart Plan

**Project:** Lost London V2 - AI Voice Guide to London's Hidden History
**Repository:** `/Users/dankeegan/lost-london-v2`
**GitHub:** https://github.com/Londondannyboy/lost.london-v2
**Last Updated:** January 2026
**Last Commit:** `6b89094` - Librarian-only CopilotKit + dynamic backgrounds

---

## PROJECT OVERVIEW

**Lost London V2** is a dual-agent voice-first assistant for exploring 2,000 years of London's hidden history. Based on 370+ articles by Vic Keegan from londonmylondon.co.uk.

### The Vision

Two AI agents working together:
- **VIC** (Voice): Warm storyteller who narrates London's history via Hume EVI voice
- **London Librarian** (UI): Scholarly researcher who surfaces articles, maps, timelines in CopilotKit

The user speaks to VIC, who tells stories verbally. The Librarian appears in the sidebar with visual research materials. This solves the core UX problem: voice and text saying different things at different times becomes *intentional* with two distinct agents.

### Moonshot Goal

**Give the Librarian her own voice** - a second Hume EVI configuration with a scholarly, crisp voice. VIC and the Librarian would have a verbal conversation about London history, with the user listening in.

---

## DEPLOYED SERVICES

| Service | URL | Platform |
|---------|-----|----------|
| Frontend | https://lost-london-v2.vercel.app | Vercel |
| Backend (AG-UI) | https://lost-london-v2-production.up.railway.app/agui | Railway |
| Backend (CLM) | https://lost-london-v2-production.up.railway.app/chat/completions | Railway |
| Database | ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech | Neon |
| Voice (VIC) | platform.hume.ai config `6b57249f-a118-45ce-88ab-b80899bf9864` | Hume EVI |

---

## ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    USER                                      │
│              (speaks to VIC)                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌─────────────────┐     ┌─────────────────────────────┐
│   Hume EVI      │     │     CopilotKit Sidebar      │
│   (VIC Voice)   │     │   (Librarian UI only)       │
│                 │     │                             │
│ CLM Endpoint    │     │  - ArticleCards             │
│ /chat/          │     │  - LocationMap              │
│ completions     │     │  - Timeline                 │
└────────┬────────┘     │  - TopicContext             │
         │              └──────────────┬──────────────┘
         │                             │
         │              AG-UI Endpoint │
         │              /agui          │
         │                             │
         └──────────────┬──────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                  RAILWAY BACKEND                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 VIC AGENT                            │   │
│  │  (Pydantic AI - Orchestrator)                       │   │
│  │                                                      │   │
│  │  Tools:                                              │   │
│  │   - delegate_to_librarian(request) ──────┐          │   │
│  │   - show_books()                         │          │   │
│  │   - get_my_profile()                     │          │   │
│  └──────────────────────────────────────────┼──────────┘   │
│                                              │              │
│  ┌───────────────────────────────────────────▼──────────┐  │
│  │              LIBRARIAN AGENT                         │  │
│  │  (Pydantic AI - Research)                           │  │
│  │                                                      │  │
│  │  Tools:                                              │  │
│  │   - surface_topic_context(topic)                    │  │
│  │   - surface_articles(query)                         │  │
│  │   - surface_map(location)                           │  │
│  │   - surface_timeline(era)                           │  │
│  │   - surface_books()                                 │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEON DATABASE                             │
│                                                             │
│  Tables:                                                    │
│   - articles (370+ articles, featured_image_url)           │
│   - knowledge_chunks (embeddings for vector search)        │
│   - user_data (preferred_name, user preferences)           │
│   - user (better-auth user accounts)                       │
│                                                             │
│  Search: RRF Hybrid (vector + keyword, k=60)               │
│  Embeddings: Voyage AI (voyage-2)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## ALL SOURCE FILES

### Backend (`/Users/dankeegan/lost-london-v2/agent/src/`)

| File | Lines | Purpose |
|------|-------|---------|
| `agent.py` | ~1500 | VIC orchestrator agent, CLM + AG-UI endpoints, `delegate_to_librarian` tool |
| `librarian.py` | ~407 | Librarian agent with research tools (`surface_topic_context`, etc.) |
| `database.py` | ~200 | Neon PostgreSQL connection, RRF hybrid search, user lookup |
| `tools.py` | ~272 | Article search, phonetic corrections (70+), era/location extraction |
| `models.py` | ~127 | Pydantic models: Article, SearchResults, SpeakerSegment, LibrarianDelegation |

### Frontend (`/Users/dankeegan/lost-london-v2/src/`)

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main page: CopilotSidebar + VoiceInput + Hero section |
| `app/layout.tsx` | Root layout with CopilotKit provider |
| `app/dashboard/page.tsx` | User history, Zep facts display |
| `app/articles/page.tsx` | Browse all articles |
| `app/article/[slug]/page.tsx` | Individual article view |
| `app/profile/page.tsx` | User profile settings |
| `app/auth/[path]/page.tsx` | Better-auth login/signup |

### API Routes (`/Users/dankeegan/lost-london-v2/src/app/api/`)

| File | Purpose |
|------|---------|
| `copilotkit/route.ts` | AG-UI proxy to Railway backend |
| `hume-token/route.ts` | Generate Hume access tokens |
| `zep/user/route.ts` | Zep memory API (GET facts, POST messages) |
| `user-profile/route.ts` | User preferred name CRUD |
| `articles/route.ts` | Article listing API |
| `articles/[slug]/route.ts` | Single article API |
| `search/route.ts` | Article search API |

### Components (`/Users/dankeegan/lost-london-v2/src/components/`)

| File | Purpose |
|------|---------|
| `voice-input.tsx` | Hume EVI widget - voice recording + CLM forwarding |
| `LibrarianAvatar.tsx` | Librarian visual indicator + message wrapper |
| `ChatMessages.tsx` | Custom user/assistant message components |
| `VicAvatar.tsx` | VIC avatar component |
| `Header.tsx` | Navigation header |
| `Footer.tsx` | Footer with links |
| `BookStrip.tsx` | Book purchase CTA banner |
| `InterestGraph.tsx` | Knowledge graph visualization |
| `CopilotWrapper.tsx` | CopilotKit provider wrapper |

### Generative UI (`/Users/dankeegan/lost-london-v2/src/components/generative-ui/`)

| File | Purpose |
|------|---------|
| `TopicContext.tsx` | Combined view: articles + map + timeline with tabs |
| `ArticleCard.tsx` | Single article card with image, hover effects |
| `ArticleGrid.tsx` | Grid of article cards |
| `LocationMap.tsx` | OpenStreetMap embed for locations |
| `Timeline.tsx` | Historical timeline visualization |
| `BookDisplay.tsx` | VIC's books display |

### Public Assets (`/Users/dankeegan/lost-london-v2/public/`)

| File | Purpose |
|------|---------|
| `vic-avatar.jpg` | VIC's avatar image |
| `London Librarian Avatar 1.png` | Librarian avatar image |
| `London Map with River.jpg` | Default hero background |
| `lost-london-cover-1.jpg` | Book cover 1 |
| `lost-london-cover-2.jpg` | Book cover 2 |
| `Thorney London's Forgotten book cover.jpg` | Thorney Island book cover |

---

## ENVIRONMENT VARIABLES

### Vercel (Frontend)
```env
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=FS313vtpHE8svozXdt7hAs3m0U4rd0dJwV1VW0fWF9cewu79
HUME_SECRET_KEY=4LF8hFTCcMhbl3fbuOO8UGAKpoXdJ91xWjnSUTrCfhsV8GN20A2Xkgs0Y4tPXXbN
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
ZEP_API_KEY=z_...
BETTER_AUTH_SECRET=...
```

### Railway (Backend)
```env
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
ZEP_API_KEY=z_...
```

---

## IMPLEMENTATION STATUS

### PHASE 1-2: Core Multi-Agent ✅ COMPLETE

| Feature | Status | Location |
|---------|--------|----------|
| Librarian Agent | ✅ | `agent/src/librarian.py` |
| `delegate_to_librarian` tool | ✅ | `agent/src/agent.py:714` |
| VIC delegates for all topics | ✅ | System prompt in `agent.py` |
| LibrarianAvatar component | ✅ | `src/components/LibrarianAvatar.tsx` |
| TopicContext (combined UI) | ✅ | `src/components/generative-ui/TopicContext.tsx` |
| Librarian-only CopilotKit | ✅ | `LibrarianOnlyAssistant` in `page.tsx` |
| VIC text suppressed | ✅ | Returns `null` when no tool UI |
| Dynamic hero backgrounds | ✅ | `BackgroundContext` in `page.tsx` |
| Era detection from dates | ✅ | `extract_era_from_content` in `tools.py` |
| Featured image from DB | ✅ | `featured_image_url` column in queries |

### PHASE 3: HITL Tools 🔲 NOT STARTED

Human-in-the-Loop tools for user confirmation:

```python
# To add in librarian.py
@librarian_agent.tool
async def confirm_article_relevance(ctx, article_id: str, question: str) -> dict:
    """Ask user if this article matches what they're looking for."""
    return {"hitl": True, "type": "confirm", "article_id": article_id, "question": question}

@librarian_agent.tool
async def suggest_related_explorations(ctx, suggestions: list[str]) -> dict:
    """Offer related topics to explore."""
    return {"hitl": True, "type": "suggestions", "options": suggestions}

@librarian_agent.tool
async def save_user_interest(ctx, interest: str) -> dict:
    """Confirm before saving interest to Zep memory."""
    return {"hitl": True, "type": "save_interest", "interest": interest}
```

Frontend hooks needed in `page.tsx`:
```typescript
import { useHumanInTheLoop } from "@copilotkit/react-core";

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
```

### PHASE 4: Dynamic Backgrounds ✅ COMPLETE

- `topicBackground` state in `page.tsx`
- `BackgroundContext` provider
- `BackgroundUpdater` component sets background when `hero_image` found
- Smooth CSS transitions

### PHASE 5: UI Polish 🔲 PARTIAL

| Feature | Status |
|---------|--------|
| BookStrip component | ✅ Created |
| Header book icon | 🔲 Not implemented |
| Dashboard knowledge graph | 🔲 Not implemented |

### PHASE 6: Librarian Voice Mode 🔲 NOT STARTED (MOONSHOT)

**The Ultimate Goal:** Give the Librarian her own voice.

Implementation path:

1. **Create Librarian Hume EVI config**
   - Go to platform.hume.ai
   - Create new configuration with scholarly, crisp voice
   - Set CLM URL to same Railway endpoint
   - Note the config ID

2. **Modify CLM endpoint** (`agent/src/agent.py`)
   ```python
   @app.post("/chat/completions")
   async def clm_endpoint(request: CLMRequest):
       speaker = request.headers.get("X-Speaker", "vic")

       if speaker == "librarian":
           result = await librarian_agent.run(message, deps=deps)
       else:
           result = await vic_agent.run(message, deps=deps)

       return CLMResponse(content=result.output, speaker=speaker)
   ```

3. **Add voice toggle** (`src/app/settings/page.tsx`)
   ```typescript
   // User preference: "vic_only" | "dual_voice"
   const [voiceMode, setVoiceMode] = useState<VoiceMode>("vic_only");
   ```

4. **Modify voice-input.tsx**
   ```typescript
   // Switch Hume config based on current speaker
   const humeConfigId = speaker === "librarian"
     ? LIBRARIAN_CONFIG_ID
     : VIC_CONFIG_ID;
   ```

5. **Voice handoff protocol**
   - VIC: "Let me have my librarian look into that..."
   - [Audio handoff to Librarian voice]
   - Librarian: "I found 3 articles about the Royal Aquarium..."
   - [Audio handoff back to VIC voice]
   - VIC: "Ah yes, what a fascinating place it was..."

---

## KEY CODE PATTERNS

### 1. Dual-Agent Delegation (agent.py)

```python
@agent.tool
async def delegate_to_librarian(ctx: RunContext[VICDeps], request: str) -> dict:
    """
    Delegate to the London Librarian for visual research materials.
    """
    librarian_deps = LibrarianDeps(
        user_id=ctx.deps.user_id,
        user_name=ctx.deps.user_name,
    )

    result = await librarian_agent.run(request, deps=librarian_deps)

    return {
        "speaker": "librarian",
        "content": result.output,
        "ui_component": result.data.get("ui_component"),
        "ui_data": result.data,
        "found": result.data.get("found", True),
    }
```

### 2. Librarian-Only CopilotKit (page.tsx)

```typescript
function LibrarianOnlyAssistant({ message }) {
  const generativeUI = message?.generativeUI?.();

  // Only show tool UI (Librarian output)
  // VIC's text is suppressed - his voice handles it
  if (generativeUI) {
    return (
      <div className="flex gap-3 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
            <img src="/London Librarian Avatar 1.png" alt="London Librarian" />
          </div>
        </div>
        <div className="flex-1">
          <span className="text-sm font-medium text-amber-700">London Librarian</span>
          <div className="bg-amber-50/50 rounded-lg p-3">
            {generativeUI}
          </div>
        </div>
      </div>
    );
  }

  return null; // VIC's text suppressed
}
```

### 3. Dynamic Background (page.tsx)

```typescript
const BackgroundContext = createContext<{ setBackground: (url: string | null) => void }>({
  setBackground: () => {}
});

function BackgroundUpdater({ imageUrl }: { imageUrl: string }) {
  const { setBackground } = useContext(BackgroundContext);
  useEffect(() => {
    if (imageUrl) setBackground(imageUrl);
  }, [imageUrl, setBackground]);
  return null;
}

// In delegate_to_librarian render:
{uiData?.hero_image && <BackgroundUpdater imageUrl={uiData.hero_image} />}
```

### 4. Era Detection from Dates (tools.py)

```python
def extract_era_from_content(content: str) -> Optional[str]:
    # First check explicit keywords
    ERA_KEYWORDS = {
        "victorian": "Victorian Era (1837-1901)",
        "georgian": "Georgian Era (1714-1830)",
        # ...
    }

    for keyword, era in ERA_KEYWORDS.items():
        if keyword in content.lower():
            return era

    # Detect years and map to eras
    years = re.findall(r'\b(1[0-9]{3})\b', content)
    if years:
        avg_year = sum(int(y) for y in years) // len(years)
        if 1837 <= avg_year <= 1901:
            return "Victorian Era (1837-1901)"
        # ...
```

### 5. RRF Hybrid Search (database.py)

```python
# Reciprocal Rank Fusion: combines vector and keyword search
# RRF_score = 1/(60 + vector_rank) + 1/(60 + keyword_rank)

SELECT
    kc.id::text,
    kc.title,
    kc.content,
    r.rrf_score as score,
    a.featured_image_url as hero_image_url
FROM rrf_combined r
JOIN knowledge_chunks kc ON kc.id = r.id
LEFT JOIN articles a ON a.title = kc.title
ORDER BY r.rrf_score DESC
LIMIT $3
```

---

## DATABASE SCHEMA

### articles
```sql
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    content TEXT,
    excerpt TEXT,
    featured_image_url TEXT,  -- Note: NOT hero_image_url
    latitude FLOAT,
    longitude FLOAT,
    historical_era TEXT,
    year_from INT,
    year_to INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### knowledge_chunks
```sql
CREATE TABLE knowledge_chunks (
    id SERIAL PRIMARY KEY,
    source_type TEXT,
    source_id TEXT,
    title TEXT,
    content TEXT,
    chunk_index INT,
    embedding vector(1024),  -- Voyage AI voyage-2
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### user_data
```sql
CREATE TABLE user_data (
    id SERIAL PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    preferred_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TEST QUERIES

1. **Royal Aquarium** - Should show articles + map + Victorian timeline + featured image
2. **"fawney island"** - Phonetic correction to "Thorney Island"
3. **"Where is Tyburn?"** - Map of Tyburn gallows near Marble Arch
4. **"Victorian era"** - Timeline visualization
5. **"Your books"** - VIC's published books display

---

## LOCAL DEVELOPMENT

```bash
# Frontend
cd /Users/dankeegan/lost-london-v2
npm run dev
# → http://localhost:3000

# Backend
cd /Users/dankeegan/lost-london-v2/agent
source .venv/bin/activate
uvicorn src.agent:app --reload --port 8000
# → http://localhost:8000
```

## DEPLOYMENT

Both deploy automatically on push to main:
```bash
git add -A && git commit -m "message" && git push
# Frontend: Vercel auto-deploys
# Backend: Railway auto-deploys
```

---

## NEXT SESSION PRIORITIES

1. **Test deployed changes** - Verify Librarian-only mode works in production
2. **Implement HITL tools** - Start with `suggest_related_explorations`
3. **Add BookStrip to page** - Purchase CTA for VIC's books
4. **Research Librarian Voice** - Investigate Hume multi-config setup for dual voice

---

## REFERENCES

| Document | Location | Purpose |
|----------|----------|---------|
| This plan | `/Users/dankeegan/lost-london-v2/MOONSHOT_RESTART_PLAN.md` | Full restart context |
| Quick reference | `/Users/dankeegan/lost-london-v2/CLAUDE.md` | Brief overview |
| CopilotKit Docs | https://docs.copilotkit.ai | AG-UI, HITL hooks |
| Pydantic AI | https://ai.pydantic.dev/multi-agent-applications/ | Agent delegation |
| Hume EVI | https://dev.hume.ai/docs/speech-to-speech-evi | Voice configuration |
| Zep Memory | https://help.getzep.com | User memory API |

---

## KNOWN ISSUES FIXED

| Issue | Fix | Date |
|-------|-----|------|
| VIC text before voice | Made CopilotKit Librarian-only | Jan 2026 |
| `hero_image_url` column doesn't exist | Column is `featured_image_url` | Jan 2026 |
| Era not detected for Royal Aquarium | Added year-based detection | Jan 2026 |
| Librarian avatar misaligned | Same flex layout as user messages | Jan 2026 |
| Articles JOIN not working | Changed to JOIN on `title` | Jan 2026 |
