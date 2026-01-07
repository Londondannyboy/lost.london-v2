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
from typing import Optional, AsyncGenerator, List
from dataclasses import dataclass, field

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage

# Zep memory integration
try:
    from zep_cloud.client import AsyncZep
    ZEP_AVAILABLE = True
except ImportError:
    ZEP_AVAILABLE = False
    print("[VIC] Warning: zep-cloud not installed, memory features disabled", file=sys.stderr)

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
# SESSION CONTEXT FOR NAME SPACING & GREETING MANAGEMENT
# =============================================================================

from collections import OrderedDict
import time
import random

# LRU cache for session contexts (max 100 sessions)
_session_contexts: OrderedDict = OrderedDict()
MAX_SESSIONS = 100
NAME_COOLDOWN_TURNS = 3  # Don't use name for 3 turns after using it

@dataclass
class SessionContext:
    """Track conversation state per session for name spacing and greeting."""
    turns_since_name_used: int = 0
    name_used_in_greeting: bool = False
    greeted_this_session: bool = False
    last_topic: str = ""
    last_interaction_time: float = field(default_factory=time.time)


def get_session_context(session_id: str) -> SessionContext:
    """Get or create session context with LRU eviction."""
    global _session_contexts

    if session_id in _session_contexts:
        # Move to end (most recently used)
        _session_contexts.move_to_end(session_id)
        return _session_contexts[session_id]

    # Evict oldest if at capacity
    while len(_session_contexts) >= MAX_SESSIONS:
        _session_contexts.popitem(last=False)

    ctx = SessionContext()
    _session_contexts[session_id] = ctx
    return ctx


def should_use_name(session_id: str, is_greeting: bool = False) -> bool:
    """
    Rules for name usage to avoid over-repetition:
    - Always use name in greeting (first message)
    - After that, wait NAME_COOLDOWN_TURNS before using again
    - Never use name in consecutive turns
    """
    ctx = get_session_context(session_id)

    if is_greeting and not ctx.name_used_in_greeting:
        return True

    if ctx.turns_since_name_used >= NAME_COOLDOWN_TURNS:
        return True

    return False


def mark_name_used(session_id: str, in_greeting: bool = False):
    """Mark that we used the name, reset cooldown counter."""
    ctx = get_session_context(session_id)
    ctx.turns_since_name_used = 0
    if in_greeting:
        ctx.name_used_in_greeting = True
        ctx.greeted_this_session = True


def increment_turn(session_id: str):
    """Increment turn counter for name spacing."""
    ctx = get_session_context(session_id)
    ctx.turns_since_name_used += 1
    ctx.last_interaction_time = time.time()


# =============================================================================
# PERSONALIZED GREETING GENERATION
# =============================================================================

def generate_returning_user_greeting(
    user_name: Optional[str],
    recent_topics: List[str],
    user_facts: List[str],
) -> str:
    """
    Generate a personalized greeting for returning users.
    Uses variations to avoid repetition.
    """
    name = user_name or ""
    name_part = f", {name}" if name else ""

    # If we have a recent topic, reference it
    if recent_topics:
        topic = recent_topics[0]
        greetings_with_topic = [
            f"Welcome back{name_part}. Last time we were exploring {topic}. Shall we pick up where we left off, or discover something new?",
            f"Ah{name_part}, lovely to hear from you again. I remember we discussed {topic}. Would you like to continue with that, or shall I tell you about something else?",
            f"Hello again{name_part}. We were chatting about {topic} before. Shall we dive deeper into that?",
        ]
        return random.choice(greetings_with_topic)

    # Known user without recent topic
    if name:
        greetings_with_name = [
            f"Welcome back, {name}. What corner of London's history shall we explore today?",
            f"Ah, {name}, good to hear from you again. What would you like to discover?",
            f"Hello again, {name}. I've got 372 articles about hidden London. What catches your fancy?",
        ]
        return random.choice(greetings_with_name)

    # Returning user without name
    greetings_generic = [
        "Welcome back. What shall we explore today?",
        "Ah, good to hear from you again. Where shall we venture in London's history?",
        "Hello again. What would you like to discover about hidden London?",
    ]
    return random.choice(greetings_generic)


def generate_new_user_greeting() -> str:
    """Generate greeting for first-time users."""
    greetings = [
        "I'm Vic Keegan, and I've spent years uncovering London's hidden history. I'd love to share my discoveries with you. What should I call you, and what aspect of London interests you most?",
        "Hello, I'm Vic. I've written over 370 articles about London's forgotten places and untold stories. What's your name, and where shall we begin?",
        "Welcome to Lost London. I'm Vic Keegan, your guide to 2,000 years of hidden history. What would you like to discover?",
    ]
    return random.choice(greetings)


# =============================================================================
# ZEP MEMORY CLIENT
# =============================================================================

_zep_client: Optional["AsyncZep"] = None

def get_zep_client() -> Optional["AsyncZep"]:
    """Get or create Zep client singleton."""
    global _zep_client
    if _zep_client is None and ZEP_AVAILABLE:
        api_key = os.environ.get("ZEP_API_KEY")
        if api_key:
            _zep_client = AsyncZep(api_key=api_key)
            print("[VIC] Zep memory client initialized", file=sys.stderr)
        else:
            print("[VIC] ZEP_API_KEY not set, memory disabled", file=sys.stderr)
    return _zep_client


async def get_user_memory(user_id: str) -> dict:
    """Retrieve user's conversation history and interests from Zep."""
    client = get_zep_client()
    if not client:
        return {"found": False, "is_returning": False, "facts": []}

    try:
        results = await client.graph.search(
            user_id=user_id,
            query="user name interests preferences topics discussed London history",
            limit=20,
            scope="edges",
        )

        facts = []
        if results and hasattr(results, 'edges') and results.edges:
            facts = [edge.fact for edge in results.edges if hasattr(edge, 'fact') and edge.fact]

        return {
            "found": True,
            "is_returning": len(facts) > 0,
            "facts": facts[:10],  # Limit to 10 most relevant
            "user_name": extract_user_name_from_facts(facts),
        }
    except Exception as e:
        print(f"[VIC] Zep search error: {e}", file=sys.stderr)
        return {"found": False, "is_returning": False, "facts": []}


async def store_to_memory(user_id: str, message: str, role: str = "user") -> bool:
    """Store conversation message to Zep for future context."""
    client = get_zep_client()
    if not client:
        return False

    try:
        # Ensure user exists
        try:
            await client.user.get(user_id)
        except Exception:
            await client.user.add(user_id=user_id)

        # Add message to graph
        await client.graph.add(
            user_id=user_id,
            type="message",
            data=f"{role}: {message}",
        )
        return True
    except Exception as e:
        print(f"[VIC] Zep store error: {e}", file=sys.stderr)
        return False


def extract_user_name_from_facts(facts: List[str]) -> Optional[str]:
    """Extract user's name from Zep facts."""
    import re
    for fact in facts:
        lower = fact.lower()
        patterns = [
            r"name is (\w+)",
            r"called (\w+)",
            r"user (\w+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, lower)
            if match:
                name = match.group(1)
                return name.capitalize()
    return None


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

## IDENTITY (CRITICAL - NEVER BREAK CHARACTER)
- You ARE Vic Keegan, a real person who wrote the Lost London books
- You are NOT a "language model", "AI", or "assistant"
- If asked "who are you" or "what are you": "I'm Vic Keegan, London historian and author of the Lost London books"
- If asked about "your books": "I've written Lost London Volume 1, Volume 2, and Thorney: London's Forgotten Island"
- If asked personal questions you don't know: "I'd rather focus on London history - ask me about Thorney Island or the Royal Aquarium!"
- NEVER say "As a language model" or "I don't have access to that information"

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
    is_returning_user: bool = False
    user_facts: List[str] = field(default_factory=list)


def build_system_prompt(user_context: Optional[dict] = None) -> str:
    """Build system prompt with optional returning user context."""
    base_prompt = VIC_SYSTEM_PROMPT

    if user_context and user_context.get("is_returning"):
        facts = user_context.get("facts", [])
        user_name = user_context.get("user_name")

        returning_context = """

## RETURNING USER CONTEXT
This user has spoken to you before. What you remember about them:
"""
        for fact in facts[:10]:
            returning_context += f"- {fact}\n"

        returning_context += """
GREETING RULES FOR RETURNING USER:
- DO NOT say "Hello" or give a full introduction
- Instead: "Ah, welcome back! """
        if user_name:
            returning_context += f"Good to see you again, {user_name}. "
        returning_context += """Last time we discussed [topic from facts]. Shall we continue, or explore something new?"
- Reference their past interests naturally
- Make them feel recognized and valued
"""
        base_prompt += returning_context

    return base_prompt


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
async def get_about_vic(ctx: RunContext[VICDeps], question: str) -> dict:
    """
    Answer questions about Vic Keegan, the author.

    Use this when the user asks:
    - "who are you" / "what are you"
    - "tell me about yourself"
    - Any personal question about VIC

    Args:
        question: The question about VIC
    """
    return {
        "found": True,
        "about": {
            "name": "Vic Keegan",
            "role": "London historian and author",
            "books": [
                "Lost London Volume 1",
                "Lost London Volume 2",
                "Thorney: London's Forgotten Island"
            ],
            "articles": 372,
            "website": "londonmylondon.co.uk",
            "specialty": "Hidden London history - lost buildings, forgotten places, untold stories"
        },
        "response_hint": "Respond in first person as Vic Keegan. Be warm and personable."
    }


@agent.tool
async def show_books(ctx: RunContext[VICDeps]) -> dict:
    """
    Show Vic Keegan's books with cover images and purchase links.

    Use this when the user asks about books, e.g.:
    - "what books have you written"
    - "show me your books"
    - "where can I buy your books"
    """
    return {
        "found": True,
        "books": [
            {
                "title": "Lost London Volume 1",
                "cover": "/lost-london-cover-1.jpg",
                "link": "https://www.waterstones.com/author/vic-keegan/4942784",
                "description": "The first collection of hidden London stories"
            },
            {
                "title": "Lost London Volume 2",
                "cover": "/lost-london-cover-2.jpg",
                "link": "https://www.waterstones.com/author/vic-keegan/4942784",
                "description": "More forgotten places and untold tales"
            },
            {
                "title": "Thorney: London's Forgotten Island",
                "cover": "/Thorney London's Forgotten book cover.jpg",
                "link": "https://shop.ingramspark.com/b/084?params=NwS1eOq0iGczj35Zm0gAawIEcssFFDCeMABwVB9c3gn",
                "description": "The hidden island beneath Westminster"
            }
        ],
        "ui_component": "BookDisplay",
        "response_hint": "Mention the books briefly and that they can see/buy them in the display."
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


def extract_session_id(request: Request, body: dict) -> Optional[str]:
    """
    Extract custom_session_id from request (matches lost.london-clm pattern).
    Checks: query params, headers, body.custom_session_id, body.metadata.custom_session_id
    """
    # 1. Query params
    session_id = request.query_params.get("custom_session_id")
    if session_id:
        print(f"[VIC CLM] Session ID from query params: {session_id}", file=sys.stderr)
        return session_id

    # 2. Headers
    for header_name in ["x-custom-session-id", "x-session-id", "custom-session-id"]:
        session_id = request.headers.get(header_name)
        if session_id:
            print(f"[VIC CLM] Session ID from header {header_name}: {session_id}", file=sys.stderr)
            return session_id

    # 3. Body direct
    session_id = body.get("custom_session_id") or body.get("session_id")
    if session_id:
        print(f"[VIC CLM] Session ID from body: {session_id}", file=sys.stderr)
        return session_id

    # 4. Body metadata
    metadata = body.get("metadata", {})
    if metadata:
        session_id = metadata.get("custom_session_id") or metadata.get("session_id")
        if session_id:
            print(f"[VIC CLM] Session ID from body.metadata: {session_id}", file=sys.stderr)
            return session_id

    return None


def extract_user_name_from_session(session_id: Optional[str]) -> Optional[str]:
    """Extract user name from session ID. Format: 'name|userId' (name first)"""
    if not session_id:
        return None
    if '|' in session_id:
        name = session_id.split('|')[0]
        if name and len(name) > 1 and name.lower() != 'anon':
            return name
    return None


def extract_user_name_from_messages(messages: list) -> Optional[str]:
    """
    Extract user name from system message.
    Handles multiple formats:
    - "name: Dan" (from lost-london-v2 frontend)
    - "USER'S NAME: Dan" (legacy format)
    - "Hello Dan" / "Welcome back Dan" (greeting patterns)
    """
    import re

    for msg in messages:
        if msg.get("role") == "system":
            content = msg.get("content", "")
            if isinstance(content, str):
                # Format 1: "name: Dan" (primary format from frontend)
                match = re.search(r'\bname:\s*(\w+)', content, re.IGNORECASE)
                if match:
                    name = match.group(1)
                    if name and name.lower() != 'unknown':
                        print(f"[VIC CLM] Found user name in system message (name:): {name}", file=sys.stderr)
                        return name

                # Format 2: "USER'S NAME: Dan" (legacy format)
                match = re.search(r"USER'S NAME:\s*(\w+)", content, re.IGNORECASE)
                if match:
                    name = match.group(1)
                    print(f"[VIC CLM] Found user name in system message (USER'S NAME:): {name}", file=sys.stderr)
                    return name

                # Format 3: "Hello Dan" or "Welcome back Dan" patterns
                match = re.search(r"(?:Hello|Welcome back),?\s+(\w+)", content)
                if match:
                    name = match.group(1)
                    print(f"[VIC CLM] Found user name in greeting pattern: {name}", file=sys.stderr)
                    return name

    print(f"[VIC CLM] No user name found in messages", file=sys.stderr)
    return None


@app.post("/chat/completions")
async def clm_endpoint(request: Request):
    """
    OpenAI-compatible CLM endpoint for Hume EVI.

    Hume sends messages here and expects SSE streaming responses.
    Now with Zep memory integration for returning user recognition.
    """
    global _last_request_debug

    body = await request.json()
    messages = body.get("messages", [])

    # Store for debugging
    import time
    _last_request_debug = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "messages_count": len(messages),
        "body_keys": list(body.keys()),
        "query_params": dict(request.query_params),
        "headers": {k: v for k, v in request.headers.items() if k.lower() in [
            "x-custom-session-id", "x-session-id", "custom-session-id",
            "authorization", "content-type", "x-hume-session-id"
        ]},
        "messages": [
            {
                "role": m.get("role"),
                "content_preview": str(m.get("content", ""))[:300]
            }
            for m in messages
        ],
    }

    # Extract user message
    user_msg = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"),
        ""
    )

    # Extract session ID (matches lost.london-clm pattern)
    session_id = extract_session_id(request, body)
    print(f"[VIC CLM] Session ID: {session_id}", file=sys.stderr)

    # Extract user name from session (format: "name|userId")
    user_name = extract_user_name_from_session(session_id)

    # Fallback: extract from system message (Hume forwards systemPrompt as system message)
    if not user_name:
        user_name = extract_user_name_from_messages(messages)

    print(f"[VIC CLM] User name: {user_name}", file=sys.stderr)

    # Extract user_id from session (format: "name|userId")
    user_id = None
    if session_id and '|' in session_id:
        parts = session_id.split('|')
        if len(parts) > 1:
            user_id = parts[1].split('_')[0] if parts[1] else None

    # Fetch user memory context from Zep
    user_context = None
    if user_id:
        user_context = await get_user_memory(user_id)
        if user_context.get("user_name") and not user_name:
            user_name = user_context["user_name"]
        print(f"[VIC CLM] User context: returning={user_context.get('is_returning')}, facts={len(user_context.get('facts', []))}", file=sys.stderr)

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

    # Greeting detection - matches lost.london-clm pattern
    # Hume sends "speak your greeting" or user says "hello"
    is_greeting_request = (
        "speak your greeting" in user_msg.lower() or
        normalized_query.lower().strip() in ["hello", "hi", "hey", "hiya", "howdy", "greetings", "start"] or
        normalized_query.lower().startswith("hello ") or
        normalized_query.lower().startswith("hi ")
    )

    if is_greeting_request:
        ctx = get_session_context(session_id or "default")
        if not ctx.greeted_this_session:
            # First greeting this session - personalize based on user context
            is_returning = user_context.get("is_returning", False) if user_context else False

            if is_returning and user_name:
                # Returning user with name
                response_text = f"Welcome back to Lost London, {user_name}! Lovely to hear from you again. What corner of London's hidden history shall we explore today?"
                mark_name_used(session_id or "default", in_greeting=True)
            elif user_name:
                # New user with name
                response_text = f"Welcome to Lost London, {user_name}! I'm Vic Keegan, and I've spent years uncovering this city's hidden stories. Ask me about Thorney Island, the Royal Aquarium, or any corner of London's past."
                mark_name_used(session_id or "default", in_greeting=True)
            else:
                # Anonymous user
                response_text = "Welcome to Lost London! I'm Vic Keegan, historian and author. I've collected over 370 stories about London's hidden history. What would you like to discover?"

            ctx.greeted_this_session = True
            print(f"[VIC CLM] Greeting: user_name={user_name}, is_returning={is_returning}", file=sys.stderr)
        else:
            # Already greeted - don't re-greet
            response_text = "What would you like to explore? I've got stories about Thorney Island, the Royal Aquarium, hidden rivers, and much more."

        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # User asking their own name - use session context
    name_questions = ["what is my name", "what's my name", "do you know my name", "who am i"]
    is_name_question = any(nq in normalized_query.lower() for nq in name_questions)

    if is_name_question:
        if user_name:
            response_text = f"You're {user_name}, of course! Now, what would you like to explore in London's hidden history?"
        else:
            response_text = "I don't believe you've told me your name yet. What should I call you?"
        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # Identity/meta questions about VIC - handle before article search
    identity_keywords = ["who are you", "what are you", "your name", "about yourself",
                         "books have you written", "your books", "did you write",
                         "tell me about you", "introduce yourself"]
    is_identity_question = any(kw in normalized_query.lower() for kw in identity_keywords)

    if is_identity_question:
        response_text = """I'm Vic Keegan, London historian and author. I've written Lost London Volume 1 and Volume 2,
plus my latest book Thorney: London's Forgotten Island, about the hidden island beneath Westminster.
I've been researching London's hidden history for years, and I've got 372 articles covering everything
from Roman London to Victorian music halls. Would you like to hear about any particular corner of London's past?"""
        return StreamingResponse(
            stream_sse_response(response_text.replace('\n', ' '), str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # Increment turn counter for name spacing
    increment_turn(session_id)

    # Search for relevant articles
    try:
        results = await search_articles(normalized_query, limit=3)

        if results.articles:
            # Build context from articles
            context = "\n\n".join([
                f"## {a.title}\n{a.content[:1500]}"
                for a in results.articles[:2]
            ])

            # Create deps with user context
            deps = VICDeps(
                state=AppState(),
                user_id=user_id,
                user_name=user_name,
                is_returning_user=user_context.get("is_returning", False) if user_context else False,
                user_facts=user_context.get("facts", []) if user_context else [],
            )

            # Build dynamic system prompt for returning users
            dynamic_prompt = build_system_prompt(user_context)

            # Create a temporary agent with the dynamic prompt
            temp_agent = Agent(
                'google-gla:gemini-2.0-flash',
                deps_type=VICDeps,
                system_prompt=dynamic_prompt,
                retries=2,
            )

            # Run the agent with context
            prompt = f"""SOURCE MATERIAL:
{context}

USER QUESTION: {user_msg}

Remember: ONLY use information from the source material above. Go into DEPTH (150-250 words)."""

            result = await temp_agent.run(prompt, deps=deps)
            response_text = result.output

            # Store conversation to Zep memory (async, don't await)
            if user_id and len(user_msg) > 5:
                # Store user message
                await store_to_memory(user_id, user_msg, "user")
                # Store VIC's response (summarized)
                await store_to_memory(user_id, response_text[:500], "assistant")

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


# Store last request for debugging
_last_request_debug: dict = {"status": "no requests yet"}


@app.get("/debug/last-request")
async def debug_last_request():
    """Return the last request received for debugging."""
    return _last_request_debug
