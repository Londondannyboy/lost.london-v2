# LOST LONDON V2

**Voice-first AI guide to 2,000 years of London's hidden history**

| | |
|---|---|
| **Repository** | `/Users/dankeegan/lost-london-v2` |
| **GitHub** | https://github.com/Londondannyboy/lost.london-v2 |
| **Frontend** | https://lost-london-v2-copilot.vercel.app (Vercel) |
| **Backend** | https://lost-london-v2-production.up.railway.app (Railway) |
| **Database** | Neon PostgreSQL (372 articles, 371 images) |
| **Latest Plan** | `RESTART_PLAN_JAN_2026.md` |

---

## Quick Start

```bash
# Frontend
npm run dev  # → localhost:3000

# Backend
cd agent && source .venv/bin/activate
uvicorn src.agent:app --reload --port 8000
```

---

## Architecture (Jan 2026)

```
User speaks → Hume EVI → /chat/completions (CLM) → Groq → VIC response
                                                      ↓
                                              delegate_to_librarian tool
                                                      ↓
                                              search_articles() direct call
                                                      ↓
                                              Returns: articles, hero_image,
                                              timeline_events, location
```

**Key Change:** Librarian is no longer a separate agent. `delegate_to_librarian` now directly calls search functions for faster, more reliable results.

---

## Key Files

### Backend (`agent/src/`)
| File | Purpose |
|------|---------|
| `agent.py` | VIC agent, CLM endpoint, `delegate_to_librarian` tool (line 1497) |
| `database.py` | RRF hybrid search, `get_topic_image()`, `get_user_preferred_name()` |
| `tools.py` | 70+ phonetic corrections, `search_articles()`, era/location extraction |
| `librarian.py` | (Legacy) Librarian agent - not used in current flow |

### Frontend (`src/`)
| File | Purpose |
|------|---------|
| `app/page.tsx` | Main page, `useRenderToolCall` for delegate_to_librarian, BackgroundUpdater |
| `components/voice-input.tsx` | VIC avatar as clickable voice trigger |
| `components/generative-ui/TopicContext.tsx` | Articles + Map + Timeline tabs |
| `components/generative-ui/ArticleCard.tsx` | Individual article card display |

---

## Implementation Status (Jan 2026)

| Feature | Status | Notes |
|---------|--------|-------|
| VIC Avatar Clickable | ✅ | Click avatar to start voice |
| topic_images Table | ✅ | 371 images with phonetic keywords |
| Simplified delegate_to_librarian | ✅ | Direct search, no agent overhead |
| Zep Memory Quality | ✅ | Stores structured topic entities |
| Book Sections Removed | ✅ | Cleaner homepage |
| Dynamic Background | ⚠️ | Code exists, needs testing |
| Timeline Display | ⚠️ | Data returned, UI may not render |
| Images in ArticleCards | ⚠️ | Data returned, verify rendering |
| Voice Latency | ❌ | CLM → Groq → Hume adds delay |

---

## Known Issues

### 1. Voice Response Latency
- **Cause:** Flow is Hume EVI → CLM → Groq → back to Hume
- **Why CopilotKit is faster:** Direct AG-UI → Groq, no voice processing
- **Fix options:**
  - Stream responses (Hume supports this, needs config)
  - Use faster model (Groq is already fast)
  - Cache common queries

### 2. Timeline Not Displaying
- **Cause:** delegate_to_librarian returns `timeline_events`, but TopicContext may not show tab
- **Check:** `hasTimeline = timeline_events && timeline_events.length > 0`
- **File:** `src/components/generative-ui/TopicContext.tsx`

### 3. Images Not Showing
- **Cause:** ArticleCard receives `hero_image_url` but may not render
- **Check:** Browser console for `[Librarian UI]` logs
- **File:** `src/components/generative-ui/ArticleCard.tsx`

### 4. Empty Librarian Messages
- **Cause:** Tool returns null/empty in some cases
- **Check:** `SmartAssistantMessage` only shows if `hasValidGenerativeUI`
- **File:** `src/app/page.tsx` (line 42-121)

---

## Database

### Tables
- `articles` - 372 articles with `featured_image_url`
- `knowledge_chunks` - Chunked content with embeddings
- `topic_images` - 371 images with phonetic keyword arrays
- `user_data` - User preferences
- `user_queries` - Query history for returning users

### Image Lookup
```sql
-- Direct lookup with phonetic variants
SELECT image_url FROM topic_images
WHERE 'fawny' = ANY(topic_keywords);
-- Returns Thorney Island image

-- RRF search JOIN (in database.py)
SELECT ... COALESCE(a.featured_image_url, a2.featured_image_url, a3.featured_image_url) as hero_image_url
FROM knowledge_chunks kc
LEFT JOIN articles a ON a.title = kc.title
LEFT JOIN articles a2 ON ...partial match...
LEFT JOIN articles a3 ON ...section match...
```

---

## Environment Variables

### Vercel
```
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=FS313vtpHE8svozXdt7hAs3m0U4rd0dJwV1VW0fWF9cewu79
HUME_SECRET_KEY=4LF8hFTCcMhbl3fbuOO8UGAKpoXdJ91xWjnSUTrCfhsV8GN20A2Xkgs0Y4tPXXbN
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
ZEP_API_KEY=(set in Vercel dashboard)
```

### Railway
```
DATABASE_URL=(same)
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-kKxfzUFWxdwKYa0n1t-NAmjBqM-3v5xWkiAaVIWF-XU
GOOGLE_API_KEY=(for Gemini if using Librarian agent)
ZEP_API_KEY=(for memory)
```

---

## Test Queries

1. **"Royal Aquarium"** → articles + Victorian timeline + background change
2. **"fawney island"** → phonetic correction → Thorney Island
3. **"Where is Tyburn?"** → map display
4. **Click VIC avatar** → voice starts, greeting by name if returning user

---

## Next Steps (Priority Order)

1. **Fix Timeline Display** - Verify TopicContext shows timeline tab
2. **Fix Images in ArticleCards** - Check hero_image_url flow
3. **Fix Background Change** - Verify BackgroundUpdater receives image
4. **Improve Article Styling** - Full width, white bg, readable font
5. **Voice Streaming** - Configure Hume for chunked responses
6. **Returning User Greeting** - Ensure VIC uses Zep facts

---

## Debugging

```bash
# Check Railway logs
railway logs --service lost-london-v2

# Test CLM endpoint
curl -X POST 'https://lost-london-v2-production.up.railway.app/chat/completions' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Royal Aquarium"}]}'

# Test topic_images
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon('DATABASE_URL_HERE');
sql\`SELECT * FROM topic_images WHERE 'aquarium' = ANY(topic_keywords)\`.then(console.log);
"
```

---

## File Line References

| Feature | File | Line |
|---------|------|------|
| VIC Avatar Voice | `src/components/voice-input.tsx` | 133-206 |
| Background Updater | `src/app/page.tsx` | 128-137 |
| Topic Extraction | `src/app/page.tsx` | 143-196 |
| Zep Storage | `src/app/api/zep/user/route.ts` | 76-188 |
| delegate_to_librarian | `agent/src/agent.py` | 1497-1607 |
| TopicContext | `src/components/generative-ui/TopicContext.tsx` | all |
| ArticleCard | `src/components/generative-ui/ArticleCard.tsx` | all |
| topic_images lookup | `agent/src/database.py` | 210-250 |
