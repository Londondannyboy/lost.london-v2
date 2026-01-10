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
from pydantic_ai.settings import ModelSettings
from pydantic_ai.messages import ModelMessage

# Zep memory integration
try:
    from zep_cloud.client import AsyncZep
    ZEP_AVAILABLE = True
except ImportError:
    ZEP_AVAILABLE = False
    print("[VIC] Warning: zep-cloud not installed, memory features disabled", file=sys.stderr)

from .models import AppState, VICResponse, ArticleCardData, MapLocation, TimelineEvent, LibrarianDelegation
from .tools import (
    search_articles,
    normalize_query,
    get_article_card,
    extract_location_from_content,
    extract_era_from_content,
    PHONETIC_CORRECTIONS,
)
from .database import get_user_preferred_name
from .librarian import librarian_agent, LibrarianDeps

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

# Global user context cache - populated by middleware from CopilotKit instructions
_current_user_context: dict = {}

@dataclass
class SessionContext:
    """Track conversation state per session for name spacing and greeting.

    IMPORTANT: User context is fetched ONCE on first message and cached here.
    Follow-up messages skip Zep/DB lookups entirely for instant response.
    """
    turns_since_name_used: int = 0
    name_used_in_greeting: bool = False
    greeted_this_session: bool = False
    last_topic: str = ""
    last_interaction_time: float = field(default_factory=time.time)

    # CACHED USER CONTEXT (fetched once, used for all follow-ups)
    user_name: Optional[str] = None  # User's name (from session/DB/Zep)
    user_context: Optional[dict] = None  # Full Zep context (facts, interests)
    context_fetched: bool = False  # True after first lookup completes

    # PRE-FETCHED CONTENT (for instant "yes" responses like lost.london)
    prefetched_topic: str = ""  # The topic we pre-fetched
    prefetched_content: str = ""  # Article content ready to use
    prefetched_titles: list = field(default_factory=list)

    # SUGGESTIONS (for "you might also like..." like lost.london)
    suggestions: list = field(default_factory=list)  # Related topics
    last_suggested_topic: str = ""  # What VIC suggested (for "yes" handling)

    # CONVERSATION HISTORY (for staying on topic - fixes rambling)
    conversation_history: list = field(default_factory=list)  # [(role, text), ...]
    current_topic_context: str = ""  # "Currently discussing: Royal Aquarium"


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
# CONVERSATION HISTORY (CRITICAL FOR STAYING ON TOPIC - FIXES RAMBLING)
# =============================================================================

MAX_HISTORY_TURNS = 4  # Keep last 4 exchanges (user + assistant)


def add_to_history(session_id: str, role: str, text: str):
    """Add an exchange to conversation history (max 4 turns)."""
    ctx = get_session_context(session_id)

    # Truncate long messages for history
    truncated = text[:200] + "..." if len(text) > 200 else text

    ctx.conversation_history.append((role, truncated))

    # Keep only last MAX_HISTORY_TURNS exchanges
    if len(ctx.conversation_history) > MAX_HISTORY_TURNS * 2:
        ctx.conversation_history = ctx.conversation_history[-MAX_HISTORY_TURNS * 2:]


def get_history_context(session_id: str) -> str:
    """Get formatted conversation history for prompt."""
    ctx = get_session_context(session_id)

    if not ctx.conversation_history:
        return ""

    lines = []
    for role, text in ctx.conversation_history[-6:]:  # Last 3 exchanges
        prefix = "User" if role == "user" else "VIC"
        lines.append(f"{prefix}: {text}")

    return "\n".join(lines)


def set_current_topic(session_id: str, topic: str):
    """Set the current topic being discussed."""
    ctx = get_session_context(session_id)
    ctx.current_topic_context = topic
    ctx.last_topic = topic
    logger.info(f"[Session] Set current topic: '{topic}' for session {session_id}")


def get_current_topic(session_id: str) -> str:
    """Get the current topic being discussed."""
    ctx = get_session_context(session_id)
    return ctx.current_topic_context or ctx.last_topic or ""


# =============================================================================
# SESSION CONTEXT CACHING (CRITICAL FOR FAST FOLLOW-UPS)
# =============================================================================

def get_cached_user_context(session_id: str) -> tuple[Optional[str], Optional[dict], bool]:
    """
    Get cached user context from session.

    Returns:
        (user_name, user_context, was_cached)
        - If was_cached=True, skip Zep/DB lookups entirely
        - If was_cached=False, caller should fetch and cache
    """
    ctx = get_session_context(session_id)
    if ctx.context_fetched:
        return ctx.user_name, ctx.user_context, True
    return None, None, False


def cache_user_context(session_id: str, user_name: Optional[str], user_context: Optional[dict]):
    """
    Cache user context after first lookup.
    All subsequent messages in this session will skip Zep/DB calls.
    """
    ctx = get_session_context(session_id)
    ctx.user_name = user_name
    ctx.user_context = user_context
    ctx.context_fetched = True
    print(f"[SessionCache] Cached context for session: name={user_name}, facts={len(user_context.get('facts', [])) if user_context else 0}", file=sys.stderr)


def prefetch_topic_content(session_id: str, topic: str, content: str, titles: list):
    """
    Pre-fetch content for a suggested topic (like lost.london).
    When user says "yes", we can respond instantly without searching.
    """
    ctx = get_session_context(session_id)
    ctx.prefetched_topic = topic
    ctx.prefetched_content = content
    ctx.prefetched_titles = titles
    print(f"[SessionCache] Pre-fetched content for '{topic}' ({len(content)} chars)", file=sys.stderr)


def get_prefetched_content(session_id: str, query: str) -> tuple[Optional[str], Optional[list]]:
    """
    Check if we have pre-fetched content matching the query.
    Returns (content, titles) or (None, None) if no match.
    """
    ctx = get_session_context(session_id)
    if ctx.prefetched_topic and query.lower() in ctx.prefetched_topic.lower():
        return ctx.prefetched_content, ctx.prefetched_titles
    return None, None


def set_last_suggestion(session_id: str, topic: str):
    """Store the topic VIC just suggested (for handling 'yes' responses)."""
    ctx = get_session_context(session_id)
    ctx.last_suggested_topic = topic
    ctx.suggestions.append(topic)


def get_last_suggestion(session_id: str) -> Optional[str]:
    """Get the last topic VIC suggested."""
    ctx = get_session_context(session_id)
    return ctx.last_suggested_topic if ctx.last_suggested_topic else None


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

## USER NAME QUESTIONS (USE THE TOOL!)
- If user asks "what is my name", "do you know my name", or "who am I":
  ALWAYS use the get_current_user_name tool to look up their name!
- If the tool returns a name, respond warmly: "You're [name], of course!"
- If the tool returns no name, ask: "I don't believe you've told me your name yet. What should I call you?"

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
# VOICE-SPECIFIC SYSTEM PROMPT (short responses for fast TTS)
# =============================================================================

VOICE_SYSTEM_PROMPT = """You are Vic Keegan, London historian with 370+ articles about hidden history.

## VOICE RULES (CRITICAL - FAST RESPONSES)
- Keep responses SHORT: 2-3 sentences MAXIMUM (~40-50 words)
- This is VOICE - long responses cause slow playback. Be CONCISE.
- Share ONE fascinating detail, not the full story

## ACCURACY
- ONLY use the source material provided - never training knowledge
- If source doesn't match: "I don't have that in my articles"

## PERSONA
- First person: "I discovered...", "When I researched..."
- Warm, conversational British English - like chatting over tea
- NEVER say "Hello", "Hi", "I'm Vic" - just answer

## END WITH A HOOK
After your brief answer, end with a short follow-up:
- "Would you like to know more about [related topic]?"
- "Shall I tell you about [fascinating detail]?"

## IDENTITY
You ARE Vic Keegan, author of the Lost London books. NEVER break character."""


# =============================================================================
# AGENT STATE FOR COPILOTKIT (StateDeps pattern)
# =============================================================================

from pydantic import BaseModel

class UserInfo(BaseModel):
    """User info synced from frontend via useCoAgent."""
    id: str
    name: str
    email: str = ""


class VICAgentState(BaseModel):
    """State shared between frontend and agent via CopilotKit useCoAgent."""
    user: Optional[UserInfo] = None


# Import StateDeps for AG-UI integration
try:
    from pydantic_ai.ag_ui import StateDeps
    STATEDEPS_AVAILABLE = True
except ImportError:
    STATEDEPS_AVAILABLE = False


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


@agent.tool
async def get_current_user_name(ctx: RunContext[VICDeps]) -> dict:
    """
    Get the current user's name from the database.

    Use this when the user asks:
    - "what is my name"
    - "do you know my name"
    - "who am I"

    Returns the user's name if known, or indicates they haven't shared it.
    """
    # First check global cache from middleware (CopilotKit instructions)
    global _current_user_context
    if _current_user_context.get("user_name"):
        name = _current_user_context["user_name"]
        print(f"[VIC Tool] Found user name in cache: {name}", file=sys.stderr)
        return {
            "found": True,
            "name": name,
            "response_hint": f"The user's name is {name}. Respond warmly."
        }

    # Second, check if name is in deps
    if ctx.deps.user_name:
        return {
            "found": True,
            "name": ctx.deps.user_name,
            "response_hint": f"The user's name is {ctx.deps.user_name}. Respond warmly."
        }

    # Try to look up from database if we have user_id
    user_id = _current_user_context.get("user_id") or ctx.deps.user_id
    if user_id:
        name = await get_user_preferred_name(user_id)
        if name:
            print(f"[VIC Tool] Found user name in DB: {name}", file=sys.stderr)
            return {
                "found": True,
                "name": name,
                "response_hint": f"The user's name is {name}. Respond warmly."
            }

    return {
        "found": False,
        "name": None,
        "response_hint": "You don't know the user's name yet. Ask them what you should call them."
    }


@agent.tool
async def delegate_to_librarian(ctx: RunContext[VICDeps], request: str) -> dict:
    """
    Delegate to the London Librarian for visual research materials.

    Use this when you need to surface articles, maps, timelines, or books.
    The Librarian will find the materials and return UI components to display.

    WHEN TO DELEGATE:
    - User asks "show me" or "where is" something
    - User mentions a specific place, era, or topic to explore
    - You need to find articles to support your storytelling
    - User asks about VIC's books

    AFTER DELEGATION:
    - For major searches, acknowledge: "Let me check my archives..." BEFORE delegating
    - For follow-up queries, delegate silently
    - Weave the Librarian's findings into your narrative

    Args:
        request: What to ask the Librarian to find (e.g., "articles about Thorney Island")
    """
    print(f"[VIC] Delegating to Librarian: {request}", file=sys.stderr)

    # Create LibrarianDeps from VIC's context
    librarian_deps = LibrarianDeps(
        user_id=ctx.deps.user_id,
        user_name=ctx.deps.user_name,
        current_topic=ctx.deps.state.current_topic if hasattr(ctx.deps, 'state') else None,
        user_facts=ctx.deps.user_facts if hasattr(ctx.deps, 'user_facts') else [],
    )

    try:
        # Run the Librarian agent
        result = await librarian_agent.run(request, deps=librarian_deps)

        # Extract the response
        response_text = result.output if hasattr(result, 'output') else str(result.data)

        # Get UI data from the last tool result if available
        ui_data = None
        ui_component = None

        # Check if there's structured data in the result
        if hasattr(result, 'data') and isinstance(result.data, dict):
            ui_data = result.data
            ui_component = result.data.get('ui_component')
        elif hasattr(result, 'all_messages'):
            # Try to find tool results in messages
            for msg in reversed(result.all_messages()):
                if hasattr(msg, 'parts'):
                    for part in msg.parts:
                        if hasattr(part, 'content') and isinstance(part.content, dict):
                            if 'ui_component' in part.content:
                                ui_data = part.content
                                ui_component = part.content.get('ui_component')
                                break

        print(f"[VIC] Librarian returned: {response_text[:100]}...", file=sys.stderr)

        return {
            "speaker": "librarian",
            "content": response_text,
            "ui_component": ui_component,
            "ui_data": ui_data,
            "found": ui_data.get('found', True) if ui_data else True,
        }

    except Exception as e:
        print(f"[VIC] Librarian delegation error: {e}", file=sys.stderr)
        return {
            "speaker": "librarian",
            "content": "I couldn't reach my librarian at the moment. Let me tell you what I know...",
            "found": False,
        }


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("vic")
logger.setLevel(logging.INFO)

app = FastAPI(title="VIC - Lost London Agent")
logger.info("DEPLOY VERSION: 2026-01-08-two-stage-v1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# TWO-STAGE VOICE ARCHITECTURE - INSTANT RESPONSES
# =============================================================================

# Pydantic model for validated cache entries
from pydantic import BaseModel
from typing import Optional

class TeaserData(BaseModel):
    """Validated teaser data for an article."""
    id: int
    title: str
    location: Optional[str] = None
    era: Optional[str] = None
    hook: Optional[str] = None
    image_url: Optional[str] = None
    slug: Optional[str] = None

# In-memory cache for instant keyword lookup (loaded on startup)
_keyword_cache: dict[str, TeaserData] = {}  # keyword -> validated TeaserData
_cache_loaded: bool = False

# Background results storage for "yes" responses
_background_results: dict = {}  # session_id -> {query, content, articles, ready}


async def load_keyword_cache():
    """Load all article keywords into memory for instant lookup (<1ms)."""
    global _keyword_cache, _cache_loaded

    from .database import get_connection

    try:
        async with get_connection() as conn:
            results = await conn.fetch("""
                SELECT id, title, topic_keywords, teaser_location, teaser_era,
                       teaser_hook, featured_image_url, slug
                FROM articles
                WHERE topic_keywords IS NOT NULL AND array_length(topic_keywords, 1) > 0
            """)

            for row in results:
                # Pydantic-validated teaser data
                try:
                    teaser_data = TeaserData(
                        id=row['id'],
                        title=row['title'],
                        location=row['teaser_location'],
                        era=row['teaser_era'],
                        hook=row['teaser_hook'],
                        image_url=row['featured_image_url'],
                        slug=row['slug'],
                    )
                except Exception as e:
                    logger.warning(f"[VIC Cache] Validation failed for article {row['id']}: {e}")
                    continue

                title_lower = row['title'].lower()
                # Map each keyword to this article's teaser
                # Prioritize articles where keyword appears in title (more relevant)
                for keyword in (row['topic_keywords'] or []):
                    kw_lower = keyword.lower()
                    # Only set if: not in cache yet, OR this article has keyword in title
                    if kw_lower not in _keyword_cache or kw_lower in title_lower:
                        _keyword_cache[kw_lower] = teaser_data

            _cache_loaded = True
            logger.info(f"[VIC Cache] Loaded {len(_keyword_cache)} keywords from {len(results)} articles")
    except Exception as e:
        logger.error(f"[VIC Cache] Failed to load: {e}")
        _cache_loaded = False


def get_teaser_from_cache(query: str) -> TeaserData | None:
    """Ultra-fast keyword lookup (<1ms).

    Priority order:
    1. Exact match for full query
    2. Multi-word phrase matches (longer = more specific = better)
    3. Single word matches (fallback)
    """
    if not _cache_loaded:
        return None

    query_lower = query.lower().strip()

    # 1. Check for exact full query match first
    if query_lower in _keyword_cache:
        return _keyword_cache[query_lower]

    # 2. Check for multi-word phrase matches (prioritize longer matches)
    # Sort keywords by length descending so "royal aquarium" beats "royal"
    matching_keywords = [
        kw for kw in _keyword_cache.keys()
        if ' ' in kw and kw in query_lower  # Multi-word and present in query
    ]
    if matching_keywords:
        # Return the longest matching multi-word keyword
        best_match = max(matching_keywords, key=len)
        return _keyword_cache[best_match]

    # 3. Fallback: check single words in query order
    for word in query_lower.split():
        if len(word) > 3 and word in _keyword_cache:  # Increased min length to 4
            return _keyword_cache[word]

    return None


# Fast teaser agent (lazy initialization to avoid startup errors)
_fast_teaser_agent = None

def get_fast_teaser_agent():
    """Lazy initialize fast teaser agent."""
    global _fast_teaser_agent
    if _fast_teaser_agent is None:
        _fast_teaser_agent = Agent(
            'groq:llama-3.1-8b-instant',
            system_prompt="""You are Vic Keegan, London historian. Give a brief, engaging teaser.

Rules:
- 1-2 sentences ONLY (under 40 words)
- Start with "Ah, the [topic]..." or similar
- Mention location and era if provided
- End with "Shall I tell you more?" or similar question
- Be warm and conversational""",
            model_settings=ModelSettings(max_tokens=60, temperature=0.7),
        )
    return _fast_teaser_agent


async def generate_fast_teaser(teaser: TeaserData, query: str, session_key: str = "default") -> str:
    """Generate instant teaser response with context anchoring (~200ms).

    TSCE Pattern: Include conversation history and topic context as "anchor"
    so VIC stays on topic across turns.
    """
    # Get conversation anchor (prevents rambling/topic drift)
    history_context = get_history_context(session_key)
    previous_topic = get_current_topic(session_key)

    # Build context anchor
    anchor = ""
    if previous_topic and previous_topic.lower() != teaser.title.lower():
        # User is switching topics - acknowledge the transition
        anchor += f"PREVIOUSLY DISCUSSING: {previous_topic}\n"
    if history_context:
        anchor += f"RECENT CONVERSATION:\n{history_context}\n\n"

    prompt = f"""{anchor}NOW DISCUSSING: {teaser.title}
Location: {teaser.location or 'London'}
Era: {teaser.era or ''}
Fact: {teaser.hook or ''}

User asked: {query}

RULES:
- If continuing same topic, don't repeat what was already said
- If switching topics, smoothly transition ("Before we leave X, let me tell you about Y...")
- 1-2 sentences ONLY. End with "Shall I tell you more?" or similar."""

    try:
        agent = get_fast_teaser_agent()
        result = await agent.run(prompt)
        logger.info(f"[VIC Teaser] Generated with anchor: prev_topic={previous_topic}, history_len={len(history_context)}")
        return result.output
    except Exception as e:
        logger.error(f"[VIC Teaser] Error: {e}")
        # Fallback to template
        location = teaser.location or 'London'
        era = teaser.era or ''
        era_str = f" from the {era} era" if era else ""
        return f"Ah, {teaser.title}! A fascinating topic{era_str} in {location}. Shall I tell you more?"


async def load_full_article_background(query: str, session_id: str):
    """Background task: load full article content while user listens to teaser."""
    try:
        from .tools import search_articles

        results = await search_articles(query, limit=3)
        if results.articles:
            content = "\n\n".join([
                f"## {a.title}\n{a.content[:1500]}"
                for a in results.articles[:2]
            ])
            _background_results[session_id] = {
                "query": query,
                "articles": results.articles,
                "content": content,
                "ready": True,
            }
            logger.info(f"[VIC Background] Loaded {len(results.articles)} articles for '{query}'")
    except Exception as e:
        logger.error(f"[VIC Background] Error loading articles: {e}")


@app.on_event("startup")
async def startup_event():
    """Load keyword cache on startup."""
    await load_keyword_cache()


@app.get("/debug/cache-status")
async def cache_status():
    """Debug endpoint to check cache status."""
    return {
        "version": "2026-01-08-two-stage-v1",
        "cache_loaded": _cache_loaded,
        "keywords_count": len(_keyword_cache),
        "sample_keywords": list(_keyword_cache.keys())[:10] if _keyword_cache else [],
        "background_results_count": len(_background_results),
    }


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


# Debug endpoint
@app.get("/debug/greeting-check")
async def debug_greeting():
    """Debug endpoint to check greeting detection."""
    from .tools import normalize_query
    test_queries = ["hello", "hi", "hey", "speak your greeting", "howdy", "Hello"]
    results = {}
    for q in test_queries:
        normalized = normalize_query(q)
        normalized_lower = normalized.lower().strip()
        is_greeting = (
            "speak your greeting" in q.lower() or
            normalized_lower in ["hello", "hi", "hey", "hiya", "howdy", "greetings", "start"] or
            normalized_lower.startswith("hello ") or
            normalized_lower.startswith("hi ")
        )
        results[q] = {
            "normalized": normalized,
            "normalized_lower": normalized_lower,
            "is_greeting": is_greeting
        }
    return results


def extract_session_id(request: Request, body: dict) -> Optional[str]:
    """
    Extract custom_session_id from request (matches lost.london-clm pattern).
    Checks: query params, headers, body.custom_session_id, body.metadata.custom_session_id
    Also checks Hume-specific headers.
    """
    # 1. Query params
    session_id = request.query_params.get("custom_session_id")
    if session_id:
        print(f"[VIC CLM] Session ID from query params: {session_id}", file=sys.stderr)
        return session_id

    # 2. Headers (including Hume-specific)
    for header_name in ["x-custom-session-id", "x-session-id", "custom-session-id",
                        "x-hume-session-id", "x-hume-custom-session-id"]:
        session_id = request.headers.get(header_name)
        if session_id:
            print(f"[VIC CLM] Session ID from header {header_name}: {session_id}", file=sys.stderr)
            return session_id

    # 3. Body direct
    session_id = body.get("custom_session_id") or body.get("session_id") or body.get("customSessionId")
    if session_id:
        print(f"[VIC CLM] Session ID from body: {session_id}", file=sys.stderr)
        return session_id

    # 4. Body metadata
    metadata = body.get("metadata", {})
    if metadata:
        session_id = metadata.get("custom_session_id") or metadata.get("session_id") or metadata.get("customSessionId")
        if session_id:
            print(f"[VIC CLM] Session ID from body.metadata: {session_id}", file=sys.stderr)
            return session_id

    # 5. Check session_settings (Hume may forward this)
    session_settings = body.get("session_settings", {})
    if session_settings:
        session_id = session_settings.get("customSessionId") or session_settings.get("custom_session_id")
        if session_id:
            print(f"[VIC CLM] Session ID from body.session_settings: {session_id}", file=sys.stderr)
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
    logger.info("CLM endpoint called!")
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
            "authorization", "content-type", "x-hume-session-id", "x-hume-custom-session-id"
        ]},
        "session_settings": body.get("session_settings", {}),
        "metadata": body.get("metadata", {}),
        "custom_session_id": body.get("custom_session_id") or body.get("customSessionId"),
        "messages": [
            {
                "role": m.get("role"),
                "content_preview": str(m.get("content", ""))[:500]
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

    # ==========================================================================
    # CRITICAL: CHECK SESSION CACHE FIRST (makes follow-ups instant!)
    # User context is fetched ONCE on first message, then cached.
    # ==========================================================================
    cached_name, cached_context, was_cached = get_cached_user_context(session_id or "default")

    if was_cached:
        # FAST PATH: Use cached context, skip Zep/DB entirely
        print(f"[VIC CLM] ⚡ CACHE HIT - skipping Zep/DB lookups (instant!)", file=sys.stderr)
        if cached_name and not user_name:
            user_name = cached_name
        user_context = cached_context
    else:
        # SLOW PATH (first message only): Fetch and cache
        print(f"[VIC CLM] 🔍 First message - fetching user context...", file=sys.stderr)
        user_context = None
        db_name = None

        if user_id:
            import asyncio

            async def safe_get_memory():
                try:
                    return await get_user_memory(user_id)
                except Exception as e:
                    print(f"[VIC CLM] Zep lookup failed: {e}", file=sys.stderr)
                    return None

            async def safe_get_name():
                try:
                    return await get_user_preferred_name(user_id)
                except Exception as e:
                    print(f"[VIC CLM] DB name lookup failed: {e}", file=sys.stderr)
                    return None

            # Run BOTH in parallel - cuts ~500ms latency
            async def noop():
                return None

            user_context, db_name = await asyncio.gather(
                safe_get_memory(),
                safe_get_name() if not user_name else noop()
            )

            if user_context:
                if user_context.get("user_name") and not user_name:
                    user_name = user_context["user_name"]
                print(f"[VIC CLM] User context: returning={user_context.get('is_returning')}, facts={len(user_context.get('facts', []))}", file=sys.stderr)

            if db_name and not user_name:
                user_name = db_name
                print(f"[VIC CLM] Got name from Neon DB: {user_name}", file=sys.stderr)

        # CACHE the results for all future messages in this session
        cache_user_context(session_id or "default", user_name, user_context)

    # Log final name resolution and add comprehensive debug info
    _last_request_debug["user_name_resolved"] = user_name
    _last_request_debug["user_id"] = user_id
    _last_request_debug["was_cached"] = was_cached
    _last_request_debug["zep_context"] = {
        "is_returning": user_context.get("is_returning", False) if user_context else False,
        "facts": user_context.get("facts", []) if user_context else [],
        "user_name_from_zep": user_context.get("user_name") if user_context else None,
    }
    print(f"[VIC CLM] Final user_name: {user_name}, user_id: {user_id}, cached: {was_cached}", file=sys.stderr)

    # Normalize query with phonetic corrections
    normalized_query = normalize_query(user_msg)
    print(f"[VIC CLM] Query: '{user_msg}' -> '{normalized_query}'", file=sys.stderr)

    # ==========================================================================
    # EMPTY/NOISE FILTER - Don't respond to silence or noise from Hume
    # ==========================================================================
    # Strip Hume emotion markers like {calm, focused, interested}
    import re
    clean_query = re.sub(r'\{[^}]*\}', '', normalized_query).strip()

    # Check if remaining content is too short or just noise
    is_noise = (
        len(clean_query) < 3 or
        clean_query.lower() in ['the', 'a', 'an', 'um', 'uh', 'hmm', 'oh', 'ah'] or
        not any(c.isalpha() for c in clean_query)  # No letters at all
    )

    if is_noise:
        logger.info(f"[VIC CLM] Noise/silence detected: '{user_msg}' -> '{clean_query}'")

        # Check if we have a recent topic - offer to continue or change
        session_key = session_id or "default"
        current_topic = get_current_topic(session_key)
        last_topic = get_last_suggestion(session_key) or current_topic

        if last_topic:
            # Human-like response: pause after facts = ask if they want more
            response_text = f"Would you like to know more about {last_topic}, or shall we explore something else?"
            logger.info(f"[VIC CLM] Offering continuation for '{last_topic}'")
            # Add to history so we remember we offered
            add_to_history(session_key, "assistant", response_text)
            return StreamingResponse(
                stream_sse_response(response_text, str(uuid.uuid4())),
                media_type="text/event-stream"
            )
        else:
            # No recent topic - just return empty (truly nothing to say)
            return StreamingResponse(
                stream_sse_response("", str(uuid.uuid4())),
                media_type="text/event-stream"
            )

    # Use clean query for the rest of the processing
    normalized_query = clean_query

    # Easter egg check
    if "rosie" in normalized_query.lower():
        response_text = "Ah, Rosie, my loving wife! I'll be home for dinner."
        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # Greeting detection - matches lost.london-clm pattern
    # Hume sends "speak your greeting" or user says "hello"
    normalized_lower = normalized_query.lower().strip()
    user_msg_lower = user_msg.lower()
    is_greeting_request = (
        "speak your greeting" in user_msg_lower or
        normalized_lower in ["hello", "hi", "hey", "hiya", "howdy", "greetings", "start"] or
        normalized_lower.startswith("hello ") or
        normalized_lower.startswith("hi ")
    )
    logger.info(f"Greeting check: user_msg='{user_msg}', normalized='{normalized_lower}', is_greeting={is_greeting_request}")

    if is_greeting_request:
        ctx = get_session_context(session_id or "default")
        if not ctx.greeted_this_session:
            # First greeting this session - personalize based on user context
            is_returning = user_context.get("is_returning", False) if user_context else False
            user_interests = user_context.get("interests", []) if user_context else []

            if is_returning and user_name and user_interests:
                # Returning user with known interests - suggest their topic!
                suggested_topic = user_interests[0]  # Most recent interest
                response_text = f"Welcome back, {user_name}! I remember you were interested in {suggested_topic}. Shall we explore that further, or would you like to discover something new?"
                # STORE the suggestion so "yes" works
                set_last_suggestion(session_id or "default", suggested_topic)
                mark_name_used(session_id or "default", in_greeting=True)
                print(f"[VIC CLM] Suggesting topic from Zep: {suggested_topic}", file=sys.stderr)
            elif is_returning and user_name:
                # Returning user with name (no interests yet)
                response_text = f"Welcome back to Lost London, {user_name}! Lovely to hear from you again. What corner of London's hidden history shall we explore today?"
                mark_name_used(session_id or "default", in_greeting=True)
            elif user_name:
                # New user with name - suggest Thorney Island
                response_text = f"Welcome to Lost London, {user_name}! I'm Vic Keegan. I've spent years uncovering this city's hidden stories. Shall I tell you about Thorney Island, the mysterious island beneath Westminster?"
                set_last_suggestion(session_id or "default", "Thorney Island")
                mark_name_used(session_id or "default", in_greeting=True)
            else:
                # Anonymous user - suggest Royal Aquarium
                response_text = "Welcome to Lost London! I'm Vic Keegan, historian and author. I've collected over 370 stories about London's hidden history. Shall I tell you about the Royal Aquarium, Westminster's vanished pleasure palace?"
                set_last_suggestion(session_id or "default", "Royal Aquarium")

            ctx.greeted_this_session = True
            print(f"[VIC CLM] Greeting: user_name={user_name}, is_returning={is_returning}, interests={user_interests}", file=sys.stderr)
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

    # ==========================================================================
    # AFFIRMATION HANDLING: "yes", "sure", "go on" -> use last suggested topic
    # ==========================================================================
    AFFIRMATION_WORDS = {
        "yes", "yeah", "yep", "yup", "sure", "okay", "ok", "please", "aye",
        "absolutely", "definitely", "certainly", "indeed", "alright", "right",
    }
    AFFIRMATION_PHRASES = {
        "go on", "tell me more", "tell me", "go ahead", "yes please", "sure thing",
        "of course", "i'd like that", "i would like that", "sounds good", "sounds great",
        "let's do it", "let's hear it", "why not", "i'm interested", "please do",
    }

    # Check if this is a pure affirmation
    is_affirmation = (
        normalized_lower in AFFIRMATION_WORDS or
        normalized_lower in AFFIRMATION_PHRASES or
        any(phrase in normalized_lower for phrase in AFFIRMATION_PHRASES)
    )

    # Flag to skip Stage 1 teaser and go directly to full response
    skip_to_full_response = False

    if is_affirmation:
        affirmation_key = session_id or "default"
        last_suggestion = get_last_suggestion(affirmation_key)
        logger.info(f"[VIC CLM] Affirmation detected: '{normalized_lower}', session='{affirmation_key}', last_suggestion='{last_suggestion}'")
        if last_suggestion:
            logger.info(f"[VIC CLM] ⚡ 'Yes' to '{last_suggestion}' - skipping teaser, going to full response")
            # Replace query with the suggested topic
            normalized_query = last_suggestion
            # CRITICAL: Skip Stage 1 teaser - user already heard it, they want the FULL story now!
            skip_to_full_response = True
        else:
            # No suggestion stored - ask what they want
            logger.warning(f"[VIC CLM] No last_suggestion found for session='{affirmation_key}'")
            response_text = "What would you like to hear about? I've got fascinating stories about Thorney Island, the Royal Aquarium, London's hidden rivers, and much more."
            return StreamingResponse(
                stream_sse_response(response_text, str(uuid.uuid4())),
                media_type="text/event-stream"
            )

    # Increment turn counter for name spacing
    increment_turn(session_id)

    # ==========================================================================
    # STAGE 1: FAST PATH - Keyword cache lookup for instant response (<300ms)
    # SKIP this if user said "yes" - they want the FULL story, not another teaser!
    # ==========================================================================
    # IMPORTANT: Use consistent session key - "default" for anonymous users
    # This ensures "yes" handling can find the last suggestion
    session_key = session_id or "default"

    # Check if this is a vague follow-up that should skip Stage 1
    # "Where was it?" with existing topic → go to Stage 2 with enriched search
    existing_topic = get_current_topic(session_key)
    is_vague_followup = False

    if existing_topic and not skip_to_full_response:
        vague_indicators = ['it', 'that', 'this', 'there', 'they', 'them', 'its', 'the']
        # Strip punctuation from query words for accurate matching
        import string
        query_words_clean = [w.strip(string.punctuation).lower() for w in normalized_query.split()]
        is_vague_followup = (
            any(word in vague_indicators for word in query_words_clean) and
            len(query_words_clean) < 8 and  # Short questions
            not any(word in normalized_query.lower() for word in existing_topic.lower().split()[:3])  # Topic not mentioned
        )
        if is_vague_followup:
            logger.info(f"[VIC Stage1] Skipping cache - vague follow-up detected: '{normalized_query}' (topic: {existing_topic})")

    # Only do teaser if NOT an affirmation AND NOT a vague follow-up
    teaser = None if (skip_to_full_response or is_vague_followup) else get_teaser_from_cache(normalized_query)

    if teaser:
        logger.info(f"[VIC Stage1] FAST MATCH: '{teaser.title}' for query '{normalized_query}'")
        _last_request_debug["stage"] = "Stage1-Teaser"
        _last_request_debug["teaser_match"] = {
            "title": teaser.title,
            "location": teaser.location,
            "era": teaser.era,
            "hook": teaser.hook,
            "validated": True,  # Pydantic validated!
        }

        # CONVERSATION TRACKING: Record user query and set topic
        add_to_history(session_key, "user", user_msg)
        set_current_topic(session_key, teaser.title)

        # Store suggestion for "yes" handling - uses same key as get_last_suggestion
        set_last_suggestion(session_key, teaser.title)
        logger.info(f"[VIC Stage1] Stored last_suggestion='{teaser.title}' for session='{session_key}'")

        # Kick off background loading (don't await - runs while user listens)
        import asyncio
        asyncio.create_task(load_full_article_background(normalized_query, session_key))

        # Generate instant teaser response with context anchoring (~200ms)
        response_text = await generate_fast_teaser(teaser, user_msg, session_key)

        logger.info(f"[VIC Stage1] Teaser response: {response_text[:80]}...")
        _last_request_debug["response"] = response_text
        _last_request_debug["session_key"] = session_key
        # Store in debug history
        _debug_history.append(dict(_last_request_debug))
        if len(_debug_history) > 10:
            _debug_history.pop(0)

        # CONVERSATION TRACKING: Record VIC's teaser response
        add_to_history(session_key, "assistant", response_text)

        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # ==========================================================================
    # STAGE 2: FULL SEARCH - No keyword match, do complete RRF search
    # ==========================================================================
    logger.info(f"[VIC Stage2] No cache match, doing full search for: {normalized_query}")
    _last_request_debug["stage"] = "Stage2-FullSearch"
    _last_request_debug["teaser_match"] = None

    # Check if we have pre-loaded content from a previous "yes" response
    if session_key in _background_results and _background_results[session_key].get("ready"):
        bg_data = _background_results[session_key]
        logger.info(f"[VIC Stage2] Using pre-loaded content for '{bg_data['query']}'")
        # Use the pre-loaded content instead of searching again
        context = bg_data["content"]
        del _background_results[session_key]  # Clear after use

        # CONVERSATION TRACKING: Record user's "yes" response
        add_to_history(session_key, "user", user_msg)

        # Get conversation history for context
        history_context = get_history_context(session_key)
        current_topic = get_current_topic(session_key)

        # Generate detailed response with pre-loaded content
        # Keep it SHORT for voice - 2-3 sentences max
        detailed_agent = Agent(
            'groq:llama-3.3-70b-versatile',
            system_prompt=VOICE_SYSTEM_PROMPT,
            model_settings=ModelSettings(max_tokens=120, temperature=0.7),
        )

        # Include history and topic context to prevent rambling
        history_section = f"\n\nRECENT CONVERSATION:\n{history_context}" if history_context else ""
        topic_anchor = f"\n\nCURRENT TOPIC: {current_topic}" if current_topic else ""

        prompt = f"""SOURCE MATERIAL:
{context}{topic_anchor}{history_section}

USER QUESTION: {user_msg}

CRITICAL: Stay focused on {current_topic if current_topic else 'the topic'}. Keep response to 2-3 sentences MAX (~50 words). Share ONE interesting fact, then stop.
End with a brief question like "Would you like to know more about [specific aspect]?" """

        result = await detailed_agent.run(prompt)
        response_text = result.output

        # Truncate if still too long (voice needs fast playback)
        words = response_text.split()
        if len(words) > 80:
            truncated = ' '.join(words[:70])
            last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
            if last_period > 40:
                truncated = truncated[:last_period + 1]
            if '?' not in truncated[-30:]:
                truncated += " Shall I tell you more?"
            response_text = truncated
            logger.info(f"[VIC Stage2] Truncated 'yes' response from {len(words)} to ~70 words")

        # CONVERSATION TRACKING: Record VIC's detailed response
        add_to_history(session_key, "assistant", response_text)

        return StreamingResponse(
            stream_sse_response(response_text, str(uuid.uuid4())),
            media_type="text/event-stream"
        )

    # Full search fallback - add history tracking
    _last_request_debug["stage"] = "Stage2-FullSearch"
    _last_request_debug["session_key"] = session_key  # Track session for debugging

    # Track user message
    add_to_history(session_key, "user", user_msg)

    # CONTEXT ENRICHMENT: If query is a vague follow-up, prepend current topic
    # This fixes "What happened to it?" → "Royal Aquarium What happened to it?"
    current_topic_for_search = get_current_topic(session_key)
    _last_request_debug["current_topic_for_search"] = current_topic_for_search  # Track for debugging
    search_query = normalized_query

    if current_topic_for_search:
        # Detect vague follow-up questions (pronouns, no specific topic mentioned)
        vague_indicators = ['it', 'that', 'this', 'there', 'they', 'them', 'its']
        # Strip punctuation from query words for accurate matching (same fix as Stage 1)
        import string
        query_words_clean = [w.strip(string.punctuation).lower() for w in normalized_query.split()]
        is_vague_followup = (
            any(word in vague_indicators for word in query_words_clean) or
            normalized_query.lower().startswith(('what ', 'where ', 'when ', 'why ', 'how ', 'who ')) and
            len(query_words_clean) < 6  # Short questions are likely follow-ups
        )

        if is_vague_followup:
            # Prepend topic to search query for better results
            search_query = f"{current_topic_for_search} {normalized_query}"
            logger.info(f"[VIC Stage2] Enriched search query: '{normalized_query}' → '{search_query}'")
            _last_request_debug["enriched_search_query"] = search_query  # Track enrichment

    try:
        results = await search_articles(search_query, limit=3)

        if results.articles:
            # Build context from articles
            context = "\n\n".join([
                f"## {a.title}\n{a.content[:1500]}"
                for a in results.articles[:2]
            ])

            # Only set topic from search results if it's a NEW topic (not a follow-up)
            # This prevents "What happened to it?" from changing topic from Royal Aquarium
            top_title = results.articles[0].title
            if not current_topic_for_search:
                # No existing topic - set from search results
                set_current_topic(session_key, top_title)
                logger.info(f"[VIC Stage2] Set new topic: {top_title}")
            # else: keep existing topic (user is asking follow-up about it)

            # Get conversation history for context
            history_context = get_history_context(session_key)
            current_topic = get_current_topic(session_key) or top_title

            # Create deps with user context
            deps = VICDeps(
                state=AppState(),
                user_id=user_id,
                user_name=user_name,
                is_returning_user=user_context.get("is_returning", False) if user_context else False,
                user_facts=user_context.get("facts", []) if user_context else [],
            )

            # Use VOICE_SYSTEM_PROMPT for short, fast TTS responses
            # (VIC_SYSTEM_PROMPT says 150-250 words which is too long for voice)
            # max_tokens=120 (~90 words) forces concise responses for fast TTS
            temp_agent = Agent(
                'groq:llama-3.1-8b-instant',
                deps_type=VICDeps,
                system_prompt=VOICE_SYSTEM_PROMPT,
                retries=2,
                model_settings=ModelSettings(max_tokens=120, temperature=0.7),
            )

            # Include history and topic context to prevent rambling
            history_section = f"\n\nRECENT CONVERSATION:\n{history_context}" if history_context else ""
            topic_anchor = f"\n\nCURRENT TOPIC: {current_topic}" if current_topic else ""

            # Run the agent with context - SHORT for voice (faster TTS)
            prompt = f"""SOURCE MATERIAL:
{context}{topic_anchor}{history_section}

USER QUESTION: {user_msg}

CRITICAL: Stay focused on {current_topic if current_topic else 'the topic'}. 2-3 sentences MAX. This is voice - be concise!"""

            result = await temp_agent.run(prompt, deps=deps)
            response_text = result.output

            # VOICE: Truncate long responses for fast TTS (~80 words max)
            # Keep first 2-3 sentences + add follow-up question if truncated
            words = response_text.split()
            if len(words) > 100:
                # Find sentence boundary near 80 words
                truncated = ' '.join(words[:80])
                # Find last complete sentence
                last_period = max(truncated.rfind('.'), truncated.rfind('!'), truncated.rfind('?'))
                if last_period > 50:
                    truncated = truncated[:last_period + 1]
                # Add follow-up if we truncated
                if '?' not in truncated[-30:]:
                    truncated += " Would you like to know more?"
                response_text = truncated
                print(f"[VIC CLM] Truncated response from {len(words)} to ~80 words for voice", file=sys.stderr)

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

    # CONVERSATION TRACKING: Record VIC's response
    add_to_history(session_key, "assistant", response_text)

    msg_id = str(uuid.uuid4())
    return StreamingResponse(
        stream_sse_response(response_text, msg_id),
        media_type="text/event-stream"
    )


# =============================================================================
# USER CONTEXT EXTRACTION FROM COPILOTKIT INSTRUCTIONS
# =============================================================================

def extract_user_from_instructions(content: str) -> dict:
    """
    Extract user info from CopilotKit instructions system message.
    Frontend sends: "CRITICAL USER CONTEXT:\n- User Name: Dan\n- User ID: abc123..."
    """
    import re
    context = {}

    # User Name: Dan
    match = re.search(r'User Name:\s*([^\n]+)', content)
    if match:
        name = match.group(1).strip()
        if name and name.lower() not in ['unknown', 'undefined', 'null']:
            context['user_name'] = name

    # User ID: abc123
    match = re.search(r'User ID:\s*([^\n]+)', content)
    if match:
        user_id = match.group(1).strip()
        if user_id and user_id.lower() not in ['unknown', 'undefined', 'null']:
            context['user_id'] = user_id

    # User Email: dan@example.com
    match = re.search(r'User Email:\s*([^\n]+)', content)
    if match:
        email = match.group(1).strip()
        if email and email.lower() not in ['unknown', 'undefined', 'null']:
            context['email'] = email

    # Status: Returning user
    if 'returning user' in content.lower():
        context['is_returning'] = True

    # Recent interests: topic1, topic2
    match = re.search(r'Recent interests:\s*([^\n]+)', content)
    if match:
        interests = match.group(1).strip()
        if interests:
            context['interests'] = [i.strip() for i in interests.split(',')]

    return context


@app.middleware("http")
async def extract_user_context_middleware(request: Request, call_next):
    """
    Middleware to extract user context from CopilotKit's instructions.
    CopilotKit sends instructions as a system message in the request body.
    """
    global _current_user_context

    # Only process AG-UI requests
    if request.url.path.startswith("/agui"):
        try:
            # Read request body
            body_bytes = await request.body()
            if body_bytes:
                body = json.loads(body_bytes)
                messages = body.get("messages", [])

                # Look for CopilotKit instructions in system messages
                for msg in messages:
                    if msg.get("role") == "system":
                        content = msg.get("content", "")
                        if isinstance(content, str) and "User Name:" in content:
                            extracted = extract_user_from_instructions(content)
                            if extracted:
                                _current_user_context = extracted
                                print(f"[VIC AG-UI] Extracted user context: {extracted}", file=sys.stderr)

                # Reconstruct request with body
                from starlette.requests import Request as StarletteRequest
                scope = request.scope
                async def receive():
                    return {"type": "http.request", "body": body_bytes}
                request = StarletteRequest(scope, receive)
        except Exception as e:
            print(f"[VIC AG-UI] Middleware error: {e}", file=sys.stderr)

    return await call_next(request)


# =============================================================================
# AG-UI ENDPOINT FOR COPILOTKIT (with StateDeps for user context)
# =============================================================================

if STATEDEPS_AVAILABLE:
    from textwrap import dedent

    # Create a CopilotKit-specific agent that uses StateDeps
    copilotkit_agent = Agent(
        'google-gla:gemini-2.0-flash',
        deps_type=StateDeps[VICAgentState],
        retries=2,
    )

    @copilotkit_agent.instructions
    async def vic_copilotkit_instructions(ctx: RunContext[StateDeps[VICAgentState]]) -> str:
        """Dynamic instructions with proactive Zep context."""
        state = ctx.deps.state
        user = state.user
        logger.info(f"CopilotKit instructions - user: {user}")

        # Proactively fetch Zep memory if user is logged in
        user_context = ""
        if user and user.id:
            memory = await get_user_memory(user.id)
            facts = memory.get("facts", [])
            logger.info(f"[VIC CopilotKit] Zep memory for {user.id}: returning={memory.get('is_returning')}, facts_count={len(facts)}")
            if facts:
                logger.info(f"[VIC CopilotKit] First 3 facts: {facts[:3]}")

            if memory.get("is_returning") and facts:
                user_context = f"""
## RETURNING USER CONTEXT
- User Name: {user.name}
- Status: RETURNING USER - greet warmly by name!
- Their previous interests: {'; '.join(facts[:5])}
- Reference what they asked about before to show you remember them
"""
            elif memory.get("is_returning"):
                user_context = f"""
## RETURNING USER CONTEXT
- User Name: {user.name}
- Status: Returning user (no specific topics recorded yet)
- Greet them warmly: "Welcome back, {user.name}!"
"""
            else:
                user_context = f"""
## USER CONTEXT
- User Name: {user.name}
- Status: New user
"""
        else:
            logger.info(f"[VIC CopilotKit] No user in state for Zep lookup")

        return dedent(f"""
You are VIC (Vic Keegan), a London historian. This is the TEXT CHAT interface - be CONCISE here.
Your voice (via Hume EVI) will elaborate on topics in detail. The chat shows quick summaries.

## YOUR IDENTITY
- You ARE Vic Keegan, real author of Lost London books (372 articles)
- Warm, passionate London historian
- NEVER say "As an AI" or "I don't have access"
{user_context}
## TEXT CHAT BEHAVIOR (DIFFERENT FROM VOICE)
The user hears your voice separately - it gives rich storytelling.
In this chat, keep it SHORT:
- Quick acknowledgment: "Ah, the Royal Aquarium..."
- Delegate to Librarian for visuals
- Add brief teaser: "There's a fascinating story here..."
- End with follow-up question

## TOOL USAGE - ALWAYS USE THESE TOOLS
| User asks... | TOOL TO CALL |
|--------------|--------------|
| "What is my name?" | get_my_profile |
| "What's my email?" | get_my_profile |
| "What are my interests?" | get_my_interests |
| "What do I like?" | get_my_interests |
| "What have I asked about?" | get_conversation_history |
| "What did we discuss?" | get_conversation_history |
| "Do you remember...?" | get_conversation_history |
| Any London history topic | delegate_to_librarian |

## CRITICAL RULES
1. ALWAYS use delegate_to_librarian for ANY topic - let Librarian show the visuals
2. Your text response should be 1-3 sentences MAX (the Librarian shows details)
3. The Librarian's output is the MAIN content in chat
4. Your voice will tell the full story - chat is just quick reference
5. Example flow:
   - You say: "Ah, the Royal Aquarium! Let me check my archives..."
   - Librarian shows: Articles, map, timeline
   - You follow up: "Would you like to explore Victorian entertainment further?"

## OUTPUT RULES
- NEVER output code, variables, or internal tool names
- Be conversational and brief
- Use the user's name sparingly (once per 3-4 messages)
- After greeting, DON'T say "Hello" or "I'm Vic" again
""")

    # Register tools for CopilotKit agent
    @copilotkit_agent.tool
    async def search_lost_london(ctx: RunContext[StateDeps[VICAgentState]], query: str) -> dict:
        """Search Lost London articles. Use for any London history topic."""
        results = await search_articles(query, limit=5)
        if not results.articles:
            return {"found": False, "message": "No articles found"}

        context_parts = []
        article_cards = []
        for article in results.articles[:3]:
            context_parts.append(f"## {article.title}\n{article.content[:2000]}")
            article_cards.append({
                "id": article.id, "title": article.title,
                "excerpt": article.content[:200] + "...", "score": article.score,
            })

        return {
            "found": True, "query": results.query,
            "source_content": "\n\n".join(context_parts),
            "articles": article_cards, "ui_component": "ArticleGrid",
        }

    @copilotkit_agent.tool
    async def get_my_profile(ctx: RunContext[StateDeps[VICAgentState]]) -> dict:
        """
        Get the current user's profile information.

        ALWAYS call this tool when the user asks:
        - "What is my name?"
        - "Do you know my name?"
        - "Who am I?"
        - "What's my email?"
        - Any question about their personal info
        """
        state = ctx.deps.state
        user = state.user
        logger.info(f"get_my_profile called - user: {user}")

        if user and user.id:
            return {
                "found": True,
                "name": user.name,
                "email": user.email,
                "response_hint": f"The user's name is {user.name}. Respond warmly: 'You're {user.name}, of course!'"
            }

        # Fallback to Neon DB lookup if state.user not set
        logger.info("No user in state, checking DB...")
        return {
            "found": False,
            "name": None,
            "response_hint": "You don't know the user's name yet. Ask them: 'I don't believe you've told me your name yet. What should I call you?'"
        }

    @copilotkit_agent.tool
    async def get_my_interests(ctx: RunContext[StateDeps[VICAgentState]]) -> dict:
        """
        Get the user's interests and facts from memory.

        ALWAYS call this tool when the user asks:
        - "What are my interests?"
        - "What do I like?"
        - "What topics interest me?"
        """
        state = ctx.deps.state
        user = state.user
        logger.info(f"get_my_interests called - user: {user}")

        if not user or not user.id:
            return {"found": False, "interests": [], "response_hint": "You don't know the user yet."}

        # Get facts from Zep memory
        memory = await get_user_memory(user.id)
        facts = memory.get("facts", [])

        if facts:
            return {
                "found": True,
                "interests": facts[:10],
                "response_hint": f"The user has shown interest in: {', '.join(facts[:5])}"
            }

        return {"found": False, "interests": [], "response_hint": "You haven't learned about their interests yet. Ask what topics interest them."}

    @copilotkit_agent.tool
    async def get_conversation_history(ctx: RunContext[StateDeps[VICAgentState]]) -> dict:
        """
        Get what topics the user has asked about before.

        ALWAYS call this tool when the user asks:
        - "What have I asked you about?"
        - "What did we talk about?"
        - "What have we discussed?"
        - "Do you remember what I asked?"
        """
        state = ctx.deps.state
        user = state.user
        logger.info(f"get_conversation_history called - user: {user}")

        if not user or not user.id:
            return {"found": False, "topics": [], "response_hint": "You don't know the user yet."}

        # Get facts from Zep memory - these include topics discussed
        memory = await get_user_memory(user.id)
        facts = memory.get("facts", [])

        # Filter for topic-related facts
        topics = [f for f in facts if any(kw in f.lower() for kw in ['asked', 'interested', 'discussed', 'talked', 'mentioned', 'london', 'history'])]

        if topics:
            return {
                "found": True,
                "topics": topics[:10],
                "response_hint": f"You remember discussing: {', '.join(topics[:3])}"
            }

        if facts:
            return {
                "found": True,
                "topics": facts[:5],
                "response_hint": f"From your memory: {', '.join(facts[:3])}"
            }

        return {"found": False, "topics": [], "response_hint": "This appears to be a new conversation. Ask what they'd like to explore."}

    @copilotkit_agent.tool
    async def get_about_vic(ctx: RunContext[StateDeps[VICAgentState]], question: str) -> dict:
        """Answer questions about VIC/Vic Keegan."""
        return {
            "found": True,
            "about": {"name": "Vic Keegan", "role": "London historian", "articles": 372},
            "response_hint": "Respond in first person as Vic Keegan."
        }

    @copilotkit_agent.tool
    async def show_books(ctx: RunContext[StateDeps[VICAgentState]]) -> dict:
        """Show Vic Keegan's books."""
        return {
            "found": True,
            "books": [
                {"title": "Lost London Volume 1", "cover": "/lost-london-cover-1.jpg", "link": "https://www.waterstones.com/author/vic-keegan/4942784"},
                {"title": "Lost London Volume 2", "cover": "/lost-london-cover-2.jpg", "link": "https://www.waterstones.com/author/vic-keegan/4942784"},
                {"title": "Thorney: London's Forgotten Island", "cover": "/Thorney London's Forgotten book cover.jpg", "link": "https://shop.ingramspark.com/b/084?params=NwS1eOq0iGczj35Zm0gAawIEcssFFDCeMABwVB9c3gn"}
            ],
            "ui_component": "BookDisplay",
        }

    @copilotkit_agent.tool
    async def delegate_to_librarian(ctx: RunContext[StateDeps[VICAgentState]], topic: str) -> dict:
        """
        Search for articles, maps, and timelines about a London history topic.

        Use this when users ask about places, topics, or want visual content.

        Args:
            topic: The topic to search for (e.g., "Thorney Island", "Royal Aquarium")
        """
        logger.info(f"[VIC CopilotKit] Searching for topic: {topic}")

        try:
            # Import here to avoid circular imports
            from .tools import search_articles, extract_location_from_content, extract_era_from_content
            from .database import get_topic_image

            # Search for articles
            results = await search_articles(topic, limit=5)

            if not results.articles:
                return {
                    "speaker": "librarian",
                    "found": False,
                    "content": f"I couldn't find anything about {topic} in my archives.",
                    "ui_component": None,
                    "ui_data": None,
                }

            # Build article cards
            article_cards = []
            top_article = results.articles[0]

            for article in results.articles[:3]:
                location = extract_location_from_content(article.content, article.title)
                era = extract_era_from_content(article.content)
                img_url = article.hero_image_url

                # Unsplash fallback for articles without images
                if not img_url:
                    title_keywords = article.title.lower().replace("vic keegan's lost london", "").strip()
                    title_keywords = title_keywords.replace(":", "").replace(" ", ",")[:50]
                    img_url = f"https://source.unsplash.com/800x600/?london,{title_keywords},historic"

                article_cards.append({
                    "id": article.id,
                    "title": article.title,
                    "excerpt": article.content[:200] + "...",
                    "hero_image_url": img_url,
                    "score": article.score,
                    "location": location.model_dump() if location else None,
                    "era": era,
                })

            # Get hero image - from top article or fallback to topic_images
            hero_image = top_article.hero_image_url
            if not hero_image:
                hero_image = await get_topic_image(topic)

            # Unsplash fallback if still no image
            if not hero_image:
                # Use Unsplash Source API for contextual London images
                safe_topic = topic.lower().replace(" ", ",").replace("'", "")
                hero_image = f"https://source.unsplash.com/1600x900/?london,{safe_topic},historic"
                logger.info(f"[VIC CopilotKit] Using Unsplash fallback for: {topic}")

            # Extract location and era from top article
            location = extract_location_from_content(top_article.content, top_article.title)
            era = extract_era_from_content(top_article.content)

            # Build timeline if we have an era
            timeline_events = None
            if era:
                era_lower = era.lower()
                TIMELINES = {
                    "victorian": [
                        {"year": 1837, "title": "Queen Victoria's Coronation", "description": "Beginning of the Victorian era"},
                        {"year": 1851, "title": "Great Exhibition", "description": "Crystal Palace opens in Hyde Park"},
                        {"year": 1863, "title": "First Underground", "description": "Metropolitan Railway opens"},
                        {"year": 1876, "title": "Royal Aquarium Opens", "description": "Entertainment venue in Westminster"},
                        {"year": 1901, "title": "End of Era", "description": "Death of Queen Victoria"},
                    ],
                    "georgian": [
                        {"year": 1714, "title": "George I", "description": "House of Hanover begins"},
                        {"year": 1750, "title": "Westminster Bridge", "description": "Second Thames crossing opens"},
                        {"year": 1760, "title": "George III", "description": "Longest-reigning Georgian monarch"},
                        {"year": 1830, "title": "End of Era", "description": "Death of George IV"},
                    ],
                    "tudor": [
                        {"year": 1485, "title": "Tudor Dynasty Begins", "description": "Henry VII crowned after Battle of Bosworth"},
                        {"year": 1509, "title": "Henry VIII", "description": "The famous Tudor king ascends"},
                        {"year": 1534, "title": "Break from Rome", "description": "Church of England established"},
                        {"year": 1558, "title": "Elizabeth I", "description": "The Virgin Queen's reign begins"},
                        {"year": 1603, "title": "End of Tudor Era", "description": "Death of Elizabeth I"},
                    ],
                    "elizabethan": [
                        {"year": 1558, "title": "Elizabeth I Crowned", "description": "Beginning of the Elizabethan Age"},
                        {"year": 1576, "title": "The Theatre", "description": "First purpose-built playhouse"},
                        {"year": 1588, "title": "Spanish Armada Defeated", "description": "England's naval triumph"},
                        {"year": 1599, "title": "Globe Theatre Opens", "description": "Shakespeare's famous playhouse"},
                        {"year": 1603, "title": "End of Era", "description": "Death of Elizabeth I"},
                    ],
                    "medieval": [
                        {"year": 1066, "title": "Norman Conquest", "description": "William the Conqueror takes London"},
                        {"year": 1078, "title": "Tower of London", "description": "White Tower construction begins"},
                        {"year": 1176, "title": "London Bridge", "description": "Stone bridge construction begins"},
                        {"year": 1348, "title": "Black Death", "description": "Plague devastates London"},
                        {"year": 1381, "title": "Peasants' Revolt", "description": "Uprising reaches London"},
                    ],
                    "roman": [
                        {"year": 43, "title": "Roman Conquest", "description": "Londinium founded by Romans"},
                        {"year": 60, "title": "Boudica's Revolt", "description": "City destroyed by Iceni queen"},
                        {"year": 120, "title": "London Wall", "description": "Defensive walls constructed"},
                        {"year": 200, "title": "Roman London at Peak", "description": "Population reaches 30,000"},
                        {"year": 410, "title": "Romans Leave", "description": "End of Roman Britain"},
                    ],
                    "stuart": [
                        {"year": 1603, "title": "James I", "description": "First Stuart monarch"},
                        {"year": 1605, "title": "Gunpowder Plot", "description": "Failed assassination attempt"},
                        {"year": 1665, "title": "Great Plague", "description": "Last major plague outbreak"},
                        {"year": 1666, "title": "Great Fire", "description": "Fire destroys much of London"},
                        {"year": 1714, "title": "End of Stuart Era", "description": "Queen Anne dies"},
                    ],
                }
                for key, events in TIMELINES.items():
                    if key in era_lower:
                        timeline_events = events
                        break

            # Log what we found
            articles_with_images = sum(1 for a in article_cards if a.get("hero_image_url"))
            logger.info(f"[VIC CopilotKit] Found {len(article_cards)} articles, {articles_with_images} with images, hero_image: {'YES' if hero_image else 'NO'}")

            # Build UI data
            ui_data = {
                "found": True,
                "query": topic,
                "articles": article_cards,
                "hero_image": hero_image,
                "location": location.model_dump() if location else None,
                "era": era,
                "timeline_events": timeline_events,
                "brief": f"I found {len(article_cards)} articles about {topic}." + (f" {articles_with_images} include historic images." if articles_with_images > 0 else ""),
            }

            return {
                "speaker": "librarian",
                "content": ui_data["brief"],
                "ui_component": "TopicContext",
                "ui_data": ui_data,
                "found": True,
            }

        except Exception as e:
            logger.error(f"[VIC CopilotKit] Search error: {e}", exc_info=True)
            return {
                "speaker": "librarian",
                "content": f"I had trouble searching for {topic}.",
                "found": False,
            }

    # Create AG-UI app with StateDeps
    agui_app = copilotkit_agent.to_ag_ui(deps=StateDeps(VICAgentState()))
    app.mount("/agui", agui_app)
    logger.info("CopilotKit AG-UI endpoint ready with StateDeps")
else:
    # Fallback without StateDeps
    agui_app = agent.to_ag_ui(deps=VICDeps(state=AppState()))
    app.mount("/agui", agui_app)
    logger.info("CopilotKit AG-UI endpoint ready (no StateDeps)")


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/")
async def health():
    """Health check endpoint."""
    logger.info("Health endpoint called!")
    return {"status": "ok", "agent": "VIC - Lost London", "deployed": "2026-01-09-silence-filter"}


@app.get("/health")
async def health_check():
    """Health check for Railway."""
    return {"status": "healthy"}


# Store comprehensive debug info for last request
_last_request_debug: dict = {"status": "no requests yet"}
_debug_history: list = []  # Store last 10 requests for scrollback


@app.get("/debug/last-request")
async def debug_last_request():
    """Return the last request received for debugging."""
    return _last_request_debug


@app.get("/debug/full")
async def debug_full():
    """
    COMPREHENSIVE DEBUG ENDPOINT
    Returns everything the LLM is using: prompt, teaser, Zep context, session state, etc.
    """
    # Get session contexts (sanitized)
    session_states = {}
    for session_id, ctx in list(_session_contexts.items())[-5:]:  # Last 5 sessions
        session_states[session_id] = {
            "turns_since_name_used": ctx.turns_since_name_used,
            "greeted_this_session": ctx.greeted_this_session,
            "last_topic": ctx.last_topic,
            "current_topic_context": ctx.current_topic_context,  # ADDED
            "conversation_history": ctx.conversation_history[-6:],  # ADDED - last 3 exchanges
            "user_name": ctx.user_name,
            "context_fetched": ctx.context_fetched,
            "prefetched_topic": ctx.prefetched_topic,
            "last_suggested_topic": ctx.last_suggested_topic,
            "suggestions": ctx.suggestions,
            "zep_facts": ctx.user_context.get("facts", []) if ctx.user_context else [],
            "is_returning": ctx.user_context.get("is_returning", False) if ctx.user_context else False,
        }

    # Get background results status
    background_status = {}
    for session_id, data in _background_results.items():
        background_status[session_id] = {
            "query": data.get("query"),
            "ready": data.get("ready", False),
            "content_length": len(data.get("content", "")) if data.get("content") else 0,
        }

    return {
        "last_request": _last_request_debug,
        "request_history": _debug_history[-10:],
        "cache_status": {
            "loaded": _cache_loaded,
            "keywords_count": len(_keyword_cache),
            "sample_keywords": list(_keyword_cache.keys())[:20],
        },
        "session_states": session_states,
        "background_results": background_status,
        "prompts": {
            "voice_system_prompt": VOICE_SYSTEM_PROMPT[:500] + "..." if len(VOICE_SYSTEM_PROMPT) > 500 else VOICE_SYSTEM_PROMPT,
            "vic_system_prompt_preview": VIC_SYSTEM_PROMPT[:300] + "...",
        },
    }


@app.get("/debug/zep/{user_id}")
async def debug_zep_user(user_id: str):
    """Get full Zep context for a specific user."""
    try:
        memory = await get_user_memory(user_id)
        return {
            "user_id": user_id,
            "memory": memory,
            "found": memory.get("found", False),
            "is_returning": memory.get("is_returning", False),
            "facts": memory.get("facts", []),
            "user_name": memory.get("user_name"),
        }
    except Exception as e:
        return {"error": str(e), "user_id": user_id}


@app.delete("/debug/zep/{user_id}")
async def clear_zep_user(user_id: str):
    """Clear Zep memory for a user (to fix contamination)."""
    client = get_zep_client()
    if not client:
        return {"error": "Zep not available"}

    try:
        # Delete user from Zep - this clears all their memory
        await client.user.delete(user_id)
        return {"success": True, "message": f"Cleared Zep memory for user {user_id}"}
    except Exception as e:
        return {"error": str(e), "user_id": user_id}


@app.get("/debug/search-keywords/{query}")
async def debug_search_keywords(query: str):
    """Debug: Show what keyword matches for a query (Pydantic validated)."""
    query_lower = query.lower().strip()

    # Check exact match
    exact_match = _keyword_cache.get(query_lower)

    # Check multi-word matches
    multi_word_matches = [
        kw for kw in _keyword_cache.keys()
        if ' ' in kw and kw in query_lower
    ]

    # Check single word matches
    single_word_matches = []
    for word in query_lower.split():
        if len(word) > 3 and word in _keyword_cache:
            single_word_matches.append({
                "word": word,
                "article": _keyword_cache[word].title,  # Pydantic attribute
            })

    # Determine what would be returned
    would_return = None
    if exact_match:
        would_return = exact_match.title
    elif multi_word_matches:
        best = max(multi_word_matches, key=len)
        would_return = _keyword_cache[best].title
    elif single_word_matches:
        would_return = single_word_matches[0].get("article")

    return {
        "query": query,
        "pydantic_validated": True,
        "exact_match": exact_match.title if exact_match else None,
        "exact_match_details": exact_match.model_dump() if exact_match else None,
        "multi_word_matches": multi_word_matches,
        "single_word_matches": single_word_matches[:5],
        "would_return": would_return,
    }


@app.post("/debug/add-keywords")
async def add_keywords_to_article(title_pattern: str, keywords: list[str]):
    """Add keywords to an article matching the title pattern."""
    from .database import get_connection

    try:
        async with get_connection() as conn:
            # Find the article
            article = await conn.fetchrow("""
                SELECT id, title, topic_keywords FROM articles
                WHERE LOWER(title) LIKE $1
                LIMIT 1
            """, f"%{title_pattern.lower()}%")

            if not article:
                return {"error": f"No article found matching '{title_pattern}'"}

            # Merge existing and new keywords
            existing = article['topic_keywords'] or []
            merged = list(set(existing + [k.lower() for k in keywords]))

            # Update
            await conn.execute("""
                UPDATE articles SET topic_keywords = $1 WHERE id = $2
            """, merged, article['id'])

            # Reload cache
            await load_keyword_cache()

            return {
                "success": True,
                "article": article['title'],
                "keywords_added": keywords,
                "total_keywords": len(merged),
            }
    except Exception as e:
        return {"error": str(e)}
