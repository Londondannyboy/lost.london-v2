# LOST LONDON V2

**Voice-first AI guide to 2,000 years of London's hidden history**

| | |
|---|---|
| **Repository** | `/Users/dankeegan/lost-london-v2` |
| **GitHub** | https://github.com/Londondannyboy/lost.london-v2 |
| **Frontend** | https://lost-london-v2.vercel.app (Vercel) |
| **Backend** | https://lost-london-v2-production.up.railway.app (Railway) |
| **Database** | Neon PostgreSQL (370+ articles) |
| **Full Plan** | `MOONSHOT_RESTART_PLAN.md` |

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

## Architecture

**Dual-Agent System:**
- **VIC** (Hume EVI voice) - Warm storyteller, narrates history verbally
- **London Librarian** (CopilotKit UI) - Surfaces articles, maps, timelines

User speaks → VIC responds with voice → Librarian shows visual research in sidebar.

---

## Key Files

### Backend (`agent/src/`)
- `agent.py` - VIC agent, `delegate_to_librarian` tool, CLM + AG-UI endpoints
- `librarian.py` - Librarian agent with `surface_topic_context`, `surface_map`, etc.
- `database.py` - RRF hybrid search (vector + keyword)
- `tools.py` - 70+ phonetic corrections, era/location extraction

### Frontend (`src/`)
- `app/page.tsx` - Main page, `LibrarianOnlyAssistant`, dynamic backgrounds
- `components/voice-input.tsx` - Hume EVI widget
- `components/generative-ui/TopicContext.tsx` - Combined articles/map/timeline view

---

## Implementation Status

| Phase | Feature | Status |
|-------|---------|--------|
| 1-2 | Core multi-agent (VIC + Librarian) | ✅ Complete |
| 3 | HITL tools (confirm, suggest) | 🔲 Not started |
| 4 | Dynamic backgrounds | ✅ Complete |
| 5 | UI polish (BookStrip, dashboard) | 🔲 Partial |
| 6 | **Librarian Voice** (moonshot) | 🔲 Not started |

---

## Database Notes

- Image column is `featured_image_url` (NOT `hero_image_url`)
- JOIN articles on `title` (not slug)
- RRF search: `1/(60 + vector_rank) + 1/(60 + keyword_rank)`

---

## Environment Variables

```env
# Vercel
AGENT_URL=https://lost-london-v2-production.up.railway.app/agui
HUME_API_KEY=FS313vtpHE8svozXdt7hAs3m0U4rd0dJwV1VW0fWF9cewu79
HUME_SECRET_KEY=4LF8hFTCcMhbl3fbuOO8UGAKpoXdJ91xWjnSUTrCfhsV8GN20A2Xkgs0Y4tPXXbN
NEXT_PUBLIC_HUME_CONFIG_ID=6b57249f-a118-45ce-88ab-b80899bf9864
DATABASE_URL=postgresql://neondb_owner:npg_0HmvsELjo8Gr@ep-ancient-violet-abx9ybhn-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require

# Railway
DATABASE_URL=(same as above)
GROQ_API_KEY=gsk_...
VOYAGE_API_KEY=pa-...
```

---

## Moonshot: Librarian Voice

The ultimate goal is to give the Librarian her own Hume EVI voice. VIC and the Librarian would have a verbal conversation about London history.

See `MOONSHOT_RESTART_PLAN.md` for full implementation details.

---

## Test Queries

1. "Royal Aquarium" → articles + map + Victorian timeline
2. "fawney island" → corrects to "Thorney Island"
3. "Where is Tyburn?" → map
4. "Your books" → book display
