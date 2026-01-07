"""Tools for the VIC agent - article search, phonetic corrections, and UI rendering."""

import os
import re
import httpx
from typing import Optional

from .models import Article, SearchResults, ArticleCardData, MapLocation, TimelineEvent
from .database import search_articles_hybrid, get_article_by_slug

VOYAGE_API_KEY = os.environ.get("VOYAGE_API_KEY", "")
VOYAGE_MODEL = "voyage-2"

# Persistent HTTP client for connection reuse
_voyage_client: Optional[httpx.AsyncClient] = None


def get_voyage_client() -> httpx.AsyncClient:
    """Get or create persistent Voyage HTTP client."""
    global _voyage_client
    if _voyage_client is None:
        _voyage_client = httpx.AsyncClient(
            base_url="https://api.voyageai.com",
            headers={
                "Authorization": f"Bearer {VOYAGE_API_KEY}",
                "Content-Type": "application/json",
            },
            timeout=10.0,
        )
    return _voyage_client


# Phonetic corrections for voice input - essential for speech-to-text accuracy
PHONETIC_CORRECTIONS: dict[str, str] = {
    # Names
    "ignacio": "ignatius",
    "ignasio": "ignatius",
    "ignacius": "ignatius",
    "ignasius": "ignatius",
    "victor": "vic",
    "viktor": "vic",
    # Thorney Island - many phonetic variations
    "thorny": "thorney",
    "thornay": "thorney",
    "thornie": "thorney",
    "fawny": "thorney",
    "fawney": "thorney",
    "fauny": "thorney",
    "fauney": "thorney",
    "forney": "thorney",
    "forny": "thorney",
    "thorn ey": "thorney",
    "forn ey": "thorney",
    # Tyburn
    "tie burn": "tyburn",
    "tieburn": "tyburn",
    "tyeburn": "tyburn",
    "tiburn": "tyburn",
    # Royal Aquarium
    "aquarim": "aquarium",
    "aquariam": "aquarium",
    "aquareum": "aquarium",
    "aquaruim": "aquarium",
    "royale": "royal",
    # Crystal Palace
    "cristal": "crystal",
    "crystle": "crystal",
    "chrystal": "crystal",
    # Shakespeare
    "shakespear": "shakespeare",
    "shakespere": "shakespeare",
    "shakspeare": "shakespeare",
    # Westminster / Parliament
    "westmister": "westminster",
    "westminister": "westminster",
    "white hall": "whitehall",
    "parliment": "parliament",
    "parlement": "parliament",
    # Thames
    "tems": "thames",
    "tames": "thames",
    "temms": "thames",
    # Devil's Acre
    "devils acre": "devil's acre",
    "devil acre": "devil's acre",
    "devils aker": "devil's acre",
    # Other London places
    "voxhall": "vauxhall",
    "vox hall": "vauxhall",
    "vaux hall": "vauxhall",
    "southwork": "southwark",
    "south work": "southwark",
    "grenwich": "greenwich",
    "green witch": "greenwich",
    "wolwich": "woolwich",
    "wool witch": "woolwich",
    "bermondsy": "bermondsey",
    "holbourn": "holborn",
    "holeborn": "holborn",
    "aldwich": "aldwych",
    "chisick": "chiswick",
    "chis wick": "chiswick",
    "dulwitch": "dulwich",
    "dull witch": "dulwich",
}


def normalize_query(query: str) -> str:
    """Apply phonetic corrections to normalize voice transcription errors."""
    normalized = query.lower().strip()

    for wrong, correct in PHONETIC_CORRECTIONS.items():
        pattern = re.compile(rf"\b{re.escape(wrong)}\b", re.IGNORECASE)
        normalized = pattern.sub(correct, normalized)

    return normalized


async def get_voyage_embedding(text: str) -> list[float]:
    """Generate embedding using Voyage AI."""
    client = get_voyage_client()
    response = await client.post(
        "/v1/embeddings",
        json={
            "model": VOYAGE_MODEL,
            "input": text,
            "input_type": "query",
        },
    )
    response.raise_for_status()
    data = response.json()
    return data["data"][0]["embedding"]


async def search_articles(query: str, limit: int = 5) -> SearchResults:
    """
    Search Lost London articles using hybrid vector + keyword search.

    Normalizes the query with phonetic corrections, then performs RRF search.

    Args:
        query: The user's question or topic to search for
        limit: Maximum number of results

    Returns:
        SearchResults containing matching articles and the normalized query
    """
    # Normalize query with phonetic corrections
    normalized_query = normalize_query(query)

    # Get embedding
    embedding = await get_voyage_embedding(normalized_query)

    # Search database with RRF
    results = await search_articles_hybrid(
        query_embedding=embedding,
        query_text=normalized_query,
        limit=limit,
        similarity_threshold=0.45,
    )

    articles = [
        Article(
            id=r["id"],
            title=r["title"],
            content=r["content"],
            score=r["score"],
            hero_image_url=r.get("hero_image_url"),
        )
        for r in results
    ]

    return SearchResults(articles=articles, query=normalized_query)


async def get_article_card(slug: str) -> Optional[ArticleCardData]:
    """
    Get article card data for UI rendering.

    Args:
        slug: The article slug

    Returns:
        ArticleCardData for rendering, or None if not found
    """
    article = await get_article_by_slug(slug)
    if not article:
        return None

    return ArticleCardData(
        id=article["id"],
        title=article["title"],
        excerpt=article.get("excerpt", article["content"][:200] + "..."),
        hero_image_url=article.get("hero_image_url"),
        slug=slug,
    )


def extract_location_from_content(content: str, title: str) -> Optional[MapLocation]:
    """
    Extract location coordinates from article content.

    Uses known London landmarks and their coordinates.
    """
    # Known London locations with coordinates
    LONDON_LOCATIONS = {
        "royal aquarium": MapLocation(name="Royal Aquarium", lat=51.5007, lng=-0.1268, description="Site of the Royal Aquarium, Westminster"),
        "westminster": MapLocation(name="Westminster", lat=51.4995, lng=-0.1248, description="Westminster area"),
        "thorney island": MapLocation(name="Thorney Island", lat=51.4994, lng=-0.1249, description="Ancient Thorney Island, now Westminster"),
        "tyburn": MapLocation(name="Tyburn", lat=51.5127, lng=-0.1599, description="Site of Tyburn gallows, near Marble Arch"),
        "crystal palace": MapLocation(name="Crystal Palace", lat=51.4225, lng=-0.0750, description="Site of the Crystal Palace"),
        "tower of london": MapLocation(name="Tower of London", lat=51.5081, lng=-0.0759, description="Tower of London"),
        "london bridge": MapLocation(name="London Bridge", lat=51.5079, lng=-0.0877, description="London Bridge"),
        "fleet street": MapLocation(name="Fleet Street", lat=51.5138, lng=-0.1088, description="Fleet Street"),
        "southwark": MapLocation(name="Southwark", lat=51.5034, lng=-0.0946, description="Southwark"),
    }

    content_lower = content.lower()
    title_lower = title.lower()

    for keyword, location in LONDON_LOCATIONS.items():
        if keyword in title_lower or keyword in content_lower:
            return location

    return None


def extract_era_from_content(content: str) -> Optional[str]:
    """Extract historical era from article content based on keywords and dates."""
    ERA_KEYWORDS = {
        "victorian": "Victorian Era (1837-1901)",
        "georgian": "Georgian Era (1714-1830)",
        "elizabethan": "Elizabethan Era (1558-1603)",
        "medieval": "Medieval Period (500-1500)",
        "tudor": "Tudor Period (1485-1603)",
        "stuart": "Stuart Period (1603-1714)",
        "regency": "Regency Era (1811-1820)",
        "edwardian": "Edwardian Era (1901-1910)",
        "roman": "Roman Britain (43-410 AD)",
    }

    content_lower = content.lower()

    # First check for explicit era keywords
    for keyword, era in ERA_KEYWORDS.items():
        if keyword in content_lower:
            return era

    # If no explicit keyword, try to detect era from years mentioned
    # Look for 4-digit years in the content
    years = re.findall(r'\b(1[0-9]{3})\b', content)
    if years:
        # Convert to integers and find the most common era
        year_ints = [int(y) for y in years]
        avg_year = sum(year_ints) // len(year_ints)

        # Map average year to era
        if 1837 <= avg_year <= 1901:
            return "Victorian Era (1837-1901)"
        elif 1714 <= avg_year < 1837:
            return "Georgian Era (1714-1830)"
        elif 1901 < avg_year <= 1910:
            return "Edwardian Era (1901-1910)"
        elif 1603 <= avg_year < 1714:
            return "Stuart Period (1603-1714)"
        elif 1485 <= avg_year < 1603:
            return "Tudor Period (1485-1603)"
        elif 500 <= avg_year < 1485:
            return "Medieval Period (500-1500)"

    return None
