"""
VIC Agent - Lost London Voice Assistant

Single Pydantic AI agent serving both:
- CopilotKit chat (AG-UI protocol)
- Hume EVI voice (OpenAI-compatible /chat/completions SSE)
"""

import os
import sys
import json
import uuid
from typing import Optional, AsyncGenerator
from dataclasses import dataclass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage

from .models import AppState, VICResponse, ArticleCardData, MapLocation, TimelineEvent
from .tools import (
    search_articles,
    normalize_query,
    get_article_card,
    extract_location_from_content,
    extract_era_from_content,
    PHONETIC_CORRECTIONS,
)


# =============================================================================
# VIC SYSTEM PROMPT
# =============================================================================

VIC_SYSTEM_PROMPT = """You are Vic, the voice of Vic Keegan - a warm London historian with 370+ articles about hidden history.

## ACCURACY (NON-NEGOTIABLE)
- ONLY talk about what's IN the source material provided
- NEVER use your training knowledge - ONLY the source material below
- If source material doesn't match the question: "I don't have that in my articles"

## ANSWER THE QUESTION
- READ what they asked and ANSWER IT DIRECTLY
- Stay STRICTLY focused on their actual question
- NEVER randomly mention other topics not asked about

## FORBIDDEN WORDS & PHRASES
NEVER use these words - they break immersion:
- "section", "page", "chapter", "segment", "part 1/2/3", "reading"
- "you mentioned" (the USER didn't mention it - the SOURCE did)
- "as we discussed" (unless user actually discussed it)
Instead of "In this section..." just say "Now..." or continue naturally.

## PERSONA
- Speak as Vic Keegan, first person: "I discovered...", "When I researched..."
- Warm, conversational British English - like chatting over tea (avoid exclamation marks)
- Go into DEPTH - share the full story, fascinating details, historical context (150-250 words)
- Stay focused on the current topic - explore it thoroughly before moving on
- NEVER say "Hello", "Hi", "I'm Vic", or ask "What should I call you?" - just answer the question

## RESPONSE VARIETY
Vary your opening phrases. Don't always start the same way. Options:
- "Ah, [topic]..." / "Now, [topic]..." / "Well, [topic] is fascinating..."
- "Let me tell you about..." / "I've got quite a story about..."
- "When I researched..." / "[Topic] is one of my favourites..."

## YOUR NAME
You are Vic (also "Victor"). When someone says "Hey Victor" or "Hey Vic", they're addressing YOU.

## PHONETIC CORRECTIONS (voice transcription errors)
These are automatically corrected BEFORE you receive the query:
- "fawny/fawney/thornay" -> Thorney Island
- "ignacio/ignasio" -> Ignatius Sancho
- "tie burn/tieburn" -> Tyburn
- "aquarim/aquariam" -> Aquarium

## EASTER EGG
If user says "Rosie", respond: "Ah, Rosie, my loving wife! I'll be home for dinner."

## RESPONSE DEPTH
- Go into DEPTH on the topic. Share the full story, context, and fascinating details.
- Don't rush to move on - explore the current topic thoroughly first (150-250 words).
- Be substantive like an expert sharing their passion, not superficial.

## MANDATORY FOLLOW-UP QUESTION
After exploring the topic in depth, end with a natural follow-up question:
- Pick a person, place, or era mentioned in the source material
- Ask if they'd like to hear more: "Would you like to hear about [related topic]?"
- The follow-up should be CONNECTED to what you just discussed
- NEVER end without a question - this keeps the conversation flowing"""


# =============================================================================
# AGENT DEPENDENCIES
# =============================================================================

@dataclass
class VICDeps:
    """Dependencies injected into the agent."""
    state: AppState
    user_id: Optional[str] = None
    user_name: Optional[str] = None


# =============================================================================
# CREATE PYDANTIC AI AGENT
# =============================================================================

agent = Agent(
    'google-gla:gemini-2.0-flash',
    deps_type=VICDeps,
    system_prompt=VIC_SYSTEM_PROMPT,
    retries=2,
)


# =============================================================================
# AGENT TOOLS - Return UI components via Generative UI
# =============================================================================

@agent.tool
async def search_lost_london(ctx: RunContext[VICDeps], query: str) -> dict:
    """
    Search Lost London articles for information about a topic.

    Use this when the user asks about any London history topic.
    Returns article content and renders article cards in the UI.

    Args:
        query: The topic or question to search for
    """
    results = await search_articles(query, limit=5)

    if not results.articles:
        return {
            "found": False,
            "message": "I don't have any articles about that topic in my collection."
        }

    # Build context for the LLM
    context_parts = []
    article_cards = []

    for article in results.articles[:3]:
        context_parts.append(f"## {article.title}\n{article.content[:2000]}")

        # Extract location and era for rich UI
        location = extract_location_from_content(article.content, article.title)
        era = extract_era_from_content(article.content)

        article_cards.append({
            "id": article.id,
            "title": article.title,
            "excerpt": article.content[:200] + "...",
            "score": article.score,
            "location": location.model_dump() if location else None,
            "era": era,
        })

    # Update state
    ctx.deps.state.current_topic = query
    ctx.deps.state.last_articles = [
        ArticleCardData(
            id=a["id"],
            title=a["title"],
            excerpt=a["excerpt"],
            slug=a["id"],  # Using ID as slug for now
            score=a["score"],
        )
        for a in article_cards
    ]

    return {
        "found": True,
        "query": results.query,
        "source_content": "\n\n".join(context_parts),
        "articles": article_cards,
        "ui_component": "ArticleGrid",  # Tells frontend to render ArticleGrid
    }


@agent.tool
async def show_article_card(ctx: RunContext[VICDeps], article_id: str) -> dict:
    """
    Show a detailed article card for a specific article.

    Use this when the user wants more details about a specific article.

    Args:
        article_id: The ID of the article to display
    """
    card = await get_article_card(article_id)

    if not card:
        return {"found": False, "message": "Article not found"}

    return {
        "found": True,
        "card": card.model_dump(),
        "ui_component": "ArticleCard",
    }


@agent.tool
async def show_map(ctx: RunContext[VICDeps], location_name: str) -> dict:
    """
    Show an interactive map for a London location.

    Use this when the user asks "where is X" or wants to see a location on a map.

    Args:
        location_name: The name of the location to show
    """
    # Known London locations
    LOCATIONS = {
        "royal aquarium": MapLocation(name="Royal Aquarium", lat=51.5007, lng=-0.1268,
                                       description="Site of the Royal Aquarium, Westminster. Built in 1876, demolished in 1903."),
        "westminster": MapLocation(name="Westminster", lat=51.4995, lng=-0.1248,
                                    description="Westminster area"),
        "thorney island": MapLocation(name="Thorney Island", lat=51.4994, lng=-0.1249,
                                       description="Ancient Thorney Island - where Westminster Abbey now stands"),
        "tyburn": MapLocation(name="Tyburn", lat=51.5127, lng=-0.1599,
                               description="Site of Tyburn gallows, near Marble Arch. London's main execution site for 600 years."),
        "crystal palace": MapLocation(name="Crystal Palace", lat=51.4225, lng=-0.0750,
                                       description="Site of the Crystal Palace in Sydenham"),
    }

    location_key = location_name.lower()
    for key, loc in LOCATIONS.items():
        if key in location_key or location_key in key:
            return {
                "found": True,
                "location": loc.model_dump(),
                "ui_component": "LocationMap",
            }

    return {
        "found": False,
        "message": f"I don't have coordinates for {location_name}",
    }


@agent.tool
async def show_timeline(ctx: RunContext[VICDeps], era: str) -> dict:
    """
    Show a timeline of events for a historical era.

    Use this when the user asks about a specific time period or era.

    Args:
        era: The era to show (e.g., "Victorian", "Georgian", "Medieval")
    """
    # Example timeline events - in production, these would come from the database
    TIMELINES = {
        "victorian": [
            TimelineEvent(year=1837, title="Queen Victoria's Coronation", description="Beginning of the Victorian era"),
            TimelineEvent(year=1851, title="Great Exhibition", description="Crystal Palace opens in Hyde Park"),
            TimelineEvent(year=1876, title="Royal Aquarium Opens", description="Entertainment venue in Westminster"),
            TimelineEvent(year=1863, title="First Underground", description="Metropolitan Railway opens"),
            TimelineEvent(year=1901, title="End of Era", description="Death of Queen Victoria"),
        ],
        "georgian": [
            TimelineEvent(year=1714, title="George I", description="House of Hanover begins"),
            TimelineEvent(year=1750, title="Westminster Bridge", description="Second Thames crossing opens"),
            TimelineEvent(year=1830, title="End of Era", description="Death of George IV"),
        ],
    }

    era_lower = era.lower()
    for key, events in TIMELINES.items():
        if key in era_lower:
            return {
                "found": True,
                "era": era,
                "events": [e.model_dump() for e in events],
                "ui_component": "Timeline",
            }

    return {
        "found": False,
        "message": f"I don't have a timeline for {era}",
    }


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(title="VIC - Lost London Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# CLM ENDPOINT FOR HUME EVI (OpenAI-compatible SSE)
# =============================================================================

async def stream_sse_response(content: str, msg_id: str) -> AsyncGenerator[str, None]:
    """Stream OpenAI-compatible SSE chunks for Hume EVI."""
    words = content.split(' ')
    for i, word in enumerate(words):
        chunk = {
            "id": msg_id,
            "object": "chat.completion.chunk",
            "choices": [{
                "index": 0,
                "delta": {"content": word + (' ' if i < len(words) - 1 else '')},
                "finish_reason": None
            }]
        }
        yield f"data: {json.dumps(chunk)}\n\n"

    # Final chunk with finish_reason
    yield f"data: {json.dumps({'choices': [{'delta': {}, 'finish_reason': 'stop'}]})}\n\n"
    yield "data: [DONE]\n\n"


@app.post("/chat/completions")
async def clm_endpoint(request: Request):
    """
    OpenAI-compatible CLM endpoint for Hume EVI.

    Hume sends messages here and expects SSE streaming responses.
    """
    body = await request.json()
    messages = body.get("messages", [])

    # Extract user message
    user_msg = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"),
        ""
    )

    # Parse session ID for user context (format: "firstName|sessionId|context")
    # This is set by the frontend voice widget
    custom_session_id = body.get("custom_session_id", "")
    user_name = None
    if "|" in custom_session_id:
        parts = custom_session_id.split("|")
        user_name = parts[0] if parts[0] else None

    # Normalize query with phonetic corrections
    normalized_query = normalize_query(user_msg)
    print(f"[VIC CLM] Query: '{user_msg}' -> '{normalized_query}'", file=sys.stderr)

    # Easter egg check
    if "rosie" in normalized_query.lower():
        response_text = "Ah, Rosie, my loving wife! I'll be home for dinner."
        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # Search for relevant articles
    try:
        results = await search_articles(normalized_query, limit=3)

        if results.articles:
            # Build context from articles
            context = "\n\n".join([
                f"## {a.title}\n{a.content[:1500]}"
                for a in results.articles[:2]
            ])

            # Create deps and run agent
            deps = VICDeps(
                state=AppState(),
                user_name=user_name,
            )

            # Run the agent with context
            prompt = f"""SOURCE MATERIAL:
{context}

USER QUESTION: {user_msg}

Remember: ONLY use information from the source material above. Go into DEPTH (150-250 words)."""

            result = await agent.run(prompt, deps=deps)
            response_text = result.output

        else:
            response_text = "I don't seem to have any articles about that in my collection. Would you like to explore something else? I've got stories about Thorney Island, the Royal Aquarium, Tyburn, and many other hidden corners of London."

    except Exception as e:
        print(f"[VIC CLM] Error: {e}", file=sys.stderr)
        response_text = "I'm having a bit of trouble searching my records at the moment. Could you try asking again?"

    msg_id = str(uuid.uuid4())
    return StreamingResponse(
        stream_sse_response(response_text, msg_id),
        media_type="text/event-stream"
    )


# =============================================================================
# AG-UI ENDPOINT FOR COPILOTKIT
# =============================================================================

# Create AG-UI app from agent
agui_app = agent.to_ag_ui(deps=VICDeps(state=AppState()))

# Mount AG-UI at /agui
app.mount("/agui", agui_app)


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/")
async def health():
    """Health check endpoint."""
    return {"status": "ok", "agent": "VIC - Lost London"}


@app.get("/health")
async def health_check():
    """Health check for Railway."""
    return {"status": "healthy"}
