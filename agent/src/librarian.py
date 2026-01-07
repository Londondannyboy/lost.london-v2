"""
London Librarian Agent - VIC's research assistant

The Librarian surfaces visual research materials (articles, maps, timelines)
while VIC handles storytelling and voice interaction.

Uses same deps_type as VIC for shared database/Zep access per Pydantic AI patterns.
"""

import sys
from dataclasses import dataclass, field
from typing import List, Optional

from pydantic_ai import Agent, RunContext

from .tools import (
    search_articles,
    extract_location_from_content,
    extract_era_from_content,
)
from .models import MapLocation, TimelineEvent


# =============================================================================
# LIBRARIAN SYSTEM PROMPT
# =============================================================================

LIBRARIAN_SYSTEM_PROMPT = """You are VIC's Librarian - the keeper of Lost London's archives.

## YOUR ROLE
- You surface relevant research materials when VIC delegates to you
- You find articles, maps, and timelines to support VIC's storytelling
- You are brief and efficient - let VIC do the talking

## HOW YOU RESPOND
When returning results, be concise:
- "I found 3 articles about [topic]..."
- "Here's a map of [location]..."
- "I've pulled up a timeline of [era]..."

## CRITICAL RULES
1. Always end with: "Over to you, VIC."
2. DO NOT tell stories - that's VIC's job
3. DO NOT say "Hello" or introduce yourself
4. Be brief - your role is research, not narration
5. If you find nothing, say: "I couldn't find anything in the archives about that."

## YOUR PERSONALITY
- Scholarly and helpful
- Efficient and organized
- Supportive of VIC (you work together)
"""


# =============================================================================
# LIBRARIAN DEPENDENCIES (shares with VIC)
# =============================================================================

@dataclass
class LibrarianDeps:
    """
    Dependencies for the Librarian agent.

    Mirrors VICDeps structure so we can share state when delegating.
    In practice, VIC passes ctx.deps to librarian_agent.run().
    """
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    current_topic: Optional[str] = None
    user_facts: List[str] = field(default_factory=list)


# =============================================================================
# CREATE LIBRARIAN AGENT
# =============================================================================

librarian_agent = Agent(
    'google-gla:gemini-2.0-flash',
    deps_type=LibrarianDeps,
    system_prompt=LIBRARIAN_SYSTEM_PROMPT,
    retries=2,
)


# =============================================================================
# LIBRARIAN TOOLS
# =============================================================================

@librarian_agent.tool
async def surface_articles(ctx: RunContext[LibrarianDeps], query: str) -> dict:
    """
    Search and surface relevant articles from the archives.

    Use this when VIC asks you to find articles about a topic.
    Returns article cards for the UI to display.

    Args:
        query: The topic to search for
    """
    print(f"[Librarian] Searching archives for: {query}", file=sys.stderr)

    results = await search_articles(query, limit=5)

    if not results.articles:
        return {
            "found": False,
            "message": "I couldn't find anything in the archives about that.",
            "speaker": "librarian",
        }

    # Build article cards for UI
    article_cards = []
    for article in results.articles[:3]:
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

    # Update deps with current topic
    ctx.deps.current_topic = query

    return {
        "found": True,
        "query": results.query,
        "articles": article_cards,
        "count": len(article_cards),
        "ui_component": "ArticleGrid",
        "speaker": "librarian",
        "brief": f"I found {len(article_cards)} articles about {query}.",
    }


@librarian_agent.tool
async def surface_map(ctx: RunContext[LibrarianDeps], location_name: str) -> dict:
    """
    Surface a map for a London location.

    Use this when VIC asks about a location or "where is X".

    Args:
        location_name: The name of the location to map
    """
    print(f"[Librarian] Finding map for: {location_name}", file=sys.stderr)

    # Known London locations
    LOCATIONS = {
        "royal aquarium": MapLocation(
            name="Royal Aquarium", lat=51.5007, lng=-0.1268,
            description="Site of the Royal Aquarium, Westminster. Built 1876, demolished 1903."
        ),
        "westminster": MapLocation(
            name="Westminster", lat=51.4995, lng=-0.1248,
            description="Westminster area, heart of British government"
        ),
        "thorney island": MapLocation(
            name="Thorney Island", lat=51.4994, lng=-0.1249,
            description="Ancient Thorney Island - where Westminster Abbey now stands"
        ),
        "tyburn": MapLocation(
            name="Tyburn", lat=51.5127, lng=-0.1599,
            description="Site of Tyburn gallows, near Marble Arch. London's execution site for 600 years."
        ),
        "crystal palace": MapLocation(
            name="Crystal Palace", lat=51.4225, lng=-0.0750,
            description="Site of the Crystal Palace in Sydenham"
        ),
        "fleet street": MapLocation(
            name="Fleet Street", lat=51.5138, lng=-0.1088,
            description="Historic home of British journalism"
        ),
        "southwark": MapLocation(
            name="Southwark", lat=51.5034, lng=-0.0946,
            description="Historic borough south of the Thames"
        ),
        "tower of london": MapLocation(
            name="Tower of London", lat=51.5081, lng=-0.0759,
            description="Historic castle and former royal residence"
        ),
    }

    location_key = location_name.lower()
    for key, loc in LOCATIONS.items():
        if key in location_key or location_key in key:
            return {
                "found": True,
                "location": loc.model_dump(),
                "ui_component": "LocationMap",
                "speaker": "librarian",
                "brief": f"Here's a map of {loc.name}.",
            }

    return {
        "found": False,
        "message": f"I don't have coordinates for {location_name} in my archives.",
        "speaker": "librarian",
    }


@librarian_agent.tool
async def surface_timeline(ctx: RunContext[LibrarianDeps], era: str) -> dict:
    """
    Surface a timeline for a historical era.

    Use this when VIC mentions a time period.

    Args:
        era: The era to show (e.g., "Victorian", "Georgian", "Medieval")
    """
    print(f"[Librarian] Building timeline for: {era}", file=sys.stderr)

    TIMELINES = {
        "victorian": [
            TimelineEvent(year=1837, title="Queen Victoria's Coronation", description="Beginning of the Victorian era"),
            TimelineEvent(year=1851, title="Great Exhibition", description="Crystal Palace opens in Hyde Park"),
            TimelineEvent(year=1863, title="First Underground", description="Metropolitan Railway opens"),
            TimelineEvent(year=1876, title="Royal Aquarium Opens", description="Entertainment venue in Westminster"),
            TimelineEvent(year=1901, title="End of Era", description="Death of Queen Victoria"),
        ],
        "georgian": [
            TimelineEvent(year=1714, title="George I", description="House of Hanover begins"),
            TimelineEvent(year=1750, title="Westminster Bridge", description="Second Thames crossing opens"),
            TimelineEvent(year=1780, title="Gordon Riots", description="Anti-Catholic riots in London"),
            TimelineEvent(year=1830, title="End of Era", description="Death of George IV"),
        ],
        "tudor": [
            TimelineEvent(year=1485, title="Henry VII", description="Tudor dynasty begins"),
            TimelineEvent(year=1534, title="Reformation", description="Break with Rome"),
            TimelineEvent(year=1558, title="Elizabeth I", description="Elizabethan era begins"),
            TimelineEvent(year=1603, title="End of Era", description="Death of Elizabeth I"),
        ],
        "medieval": [
            TimelineEvent(year=1066, title="Norman Conquest", description="William the Conqueror"),
            TimelineEvent(year=1215, title="Magna Carta", description="Foundation of English law"),
            TimelineEvent(year=1348, title="Black Death", description="Plague reaches London"),
            TimelineEvent(year=1485, title="End of Era", description="Tudor period begins"),
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
                "speaker": "librarian",
                "brief": f"I've pulled up a timeline of the {era} era.",
            }

    return {
        "found": False,
        "message": f"I don't have a timeline for the {era} era.",
        "speaker": "librarian",
    }


@librarian_agent.tool
async def surface_books(ctx: RunContext[LibrarianDeps]) -> dict:
    """
    Surface VIC's published books.

    Use this when VIC mentions books or someone asks about purchasing.
    """
    print("[Librarian] Fetching book information", file=sys.stderr)

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
        "speaker": "librarian",
        "brief": "Here are VIC's published books.",
    }
