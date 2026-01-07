# Lost London V2 - Comprehensive Restart Plan

**Date:** January 7, 2026
**Status:** Core features implemented, testing needed
**Live URLs:**
- Frontend: https://lost-london-v2-copilot.vercel.app
- Backend: https://lost-london-v2-production.up.railway.app

---

## What Was Done This Session

### 1. VIC Avatar Clickable ✅
- **File:** `src/components/voice-input.tsx`
- Merged voice button into VIC's avatar image
- Visual states: idle (border glow), listening (green ring), speaking (amber pulse)
- Removed duplicate avatar from page.tsx

### 2. Zep Memory Quality ✅
- **File:** `src/app/api/zep/user/route.ts`
- New actions: `topic_interest`, `user_profile`
- Topics stored as structured entities, not raw messages
- User profile stored on login for returning user recognition
- **File:** `src/app/page.tsx`
- `extractTopicFromQuery()` extracts topics from user queries
- `storeTopicToZep()` stores structured topic entities

### 3. topic_images Table ✅
- **Database:** 371 images with phonetic keyword arrays
- Lookup: `WHERE 'fawny' = ANY(topic_keywords)` → Thorney Island image
- Used as fallback when articles don't have images

### 4. Simplified delegate_to_librarian ✅
- **File:** `agent/src/agent.py` (line ~1497)
- Removed complex Librarian agent delegation
- Now directly calls `search_articles()` and builds UI data inline
- Returns: articles, hero_image, location, era, timeline_events

### 5. Book Sections Removed ✅
- **File:** `src/app/page.tsx`
- Removed "Featured Book" and "Own the Books" sections

---

## Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
├─────────────────────────────────────────────────────────────────┤
│  VoiceInput (Hume EVI)  →  handleVoiceMessage  →  CopilotKit   │
│         ↓                                              ↓        │
│  User speaks "Royal     →  appendMessage      →  useRenderTool │
│  Aquarium"                                      Call renders    │
│                                                 TopicContext    │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND (Railway)                        │
├─────────────────────────────────────────────────────────────────┤
│  /chat/completions (CLM)  ←──  Hume EVI sends user speech       │
│         │                                                       │
│         ▼                                                       │
│  VIC Agent (Groq)  ───────→  delegate_to_librarian tool         │
│                                      │                          │
│                                      ▼                          │
│                              search_articles()                  │
│                              get_topic_image()                  │
│                                      │                          │
│                                      ▼                          │
│                              Returns UI data:                   │
│                              - articles[]                       │
│                              - hero_image                       │
│                              - timeline_events                  │
│                              - location                         │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    /agui (CopilotKit AG-UI)                     │
├─────────────────────────────────────────────────────────────────┤
│  copilotkit_agent with:                                         │
│  - delegate_to_librarian (searches, returns TopicContext)       │
│  - show_books (returns BookDisplay)                             │
│                                                                 │
│  Tool returns rendered via useRenderToolCall in frontend        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Known Issues to Test

### 1. Images in CopilotKit
- **Test:** Ask "Royal Aquarium" via CopilotKit text input
- **Expected:** ArticleCards show images, hero background changes
- **Files:** `src/app/page.tsx` (useRenderToolCall for delegate_to_librarian)

### 2. Timeline Display
- **Test:** Ask about Victorian topic (Royal Aquarium, Crystal Palace)
- **Expected:** Timeline tab appears with Victorian events
- **Files:** `src/components/generative-ui/TopicContext.tsx`

### 3. Background Image Change
- **Test:** Ask about any topic with known image
- **Expected:** Hero section background fades to topic image
- **Files:** `src/app/page.tsx` (BackgroundUpdater component)

### 4. VIC Greeting Returning Users
- **Test:** Log in, refresh, click VIC avatar
- **Expected:** VIC greets by name ("Welcome back, Dan!")
- **Files:** `src/components/voice-input.tsx` (buildSystemPrompt)

---

## Next Phase: Moonshot Features

### Phase 1: Voice Polish (Priority)
1. **VIC greeting consistency** - Ensure VIC ALWAYS greets returning users by name
2. **Response speed** - CLM is slow (~5s), investigate caching or model switch
3. **Voice cut-off fix** - Configure Hume EVI VAD in platform.hume.ai

### Phase 2: CopilotKit Quality
1. **Line spacing in messages** - Add paragraph breaks in VIC's text responses
2. **Empty Librarian fix** - Ensure Librarian only shows when it has content
3. **Image display verification** - End-to-end test of hero_image flow

### Phase 3: Memory & Personalization
1. **Zep graph visualization** - Show user's topic connections in dashboard
2. **Returning user memory** - VIC references past conversations
3. **Topic recommendations** - "You might also like..." based on interests

### Phase 4: Content Features
1. **Article detail view** - Click article card → full article modal
2. **Map interactivity** - Click location → pan to spot on map
3. **Timeline navigation** - Click event → show related articles

---

## Environment Variables

### Vercel
```
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=FS313vtpHE8svozXdt7hAs3m0U4rd0dJwV1VW0fWF9cewu79
HUME_SECRET_KEY=4LF8hFTCcMhbl3fbuOO8UGAKpoXdJ91xWjnSUTrCfhsV8GN20A2Xkgs0Y4tPXXbN
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require
ZEP_API_KEY=(check Vercel dashboard)
```

### Railway
```
DATABASE_URL=(same as above)
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-kKxfzUFWxdwKYa0n1t-NAmjBqM-3v5xWkiAaVIWF-XU
GOOGLE_API_KEY=(for Gemini - Librarian)
ZEP_API_KEY=(for memory)
```

---

## Test Commands

```bash
# Test topic_images lookup
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon('postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require');
sql\`SELECT topic_keywords[1], image_url FROM topic_images WHERE 'royal aquarium' = ANY(topic_keywords)\`.then(console.log);
"

# Test CLM endpoint
curl -X POST 'https://lost-london-v2-production.up.railway.app/chat/completions' \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Royal Aquarium"}]}'

# Check Railway health
curl https://lost-london-v2-production.up.railway.app/

# Check Vercel health
curl -I https://lost-london-v2-copilot.vercel.app
```

---

## Key Files Reference

| Feature | File | Line |
|---------|------|------|
| VIC Avatar/Voice | `src/components/voice-input.tsx` | 133-206 |
| Background Update | `src/app/page.tsx` | 128-137 |
| Topic Extraction | `src/app/page.tsx` | 143-196 |
| Zep Topic Storage | `src/app/api/zep/user/route.ts` | 106-137 |
| delegate_to_librarian | `agent/src/agent.py` | 1497-1607 |
| TopicContext UI | `src/components/generative-ui/TopicContext.tsx` | all |
| topic_images lookup | `agent/src/database.py` | 210-250 |

---

## Immediate Next Steps

1. **Test live site** - https://lost-london-v2-copilot.vercel.app
   - Click VIC avatar → speak "Royal Aquarium"
   - Check: images, timeline, background change

2. **Check browser console** for:
   - `[Librarian UI] Result:` - shows what frontend receives
   - `[BackgroundUpdater] Setting background to:` - confirms image URL

3. **Check Railway logs** for:
   - `[VIC CopilotKit] Found X articles, Y with images, hero_image: YES/NO`

4. **If issues persist:**
   - Add more console.log in TopicContext.tsx
   - Check if uiData.hero_image is being passed
