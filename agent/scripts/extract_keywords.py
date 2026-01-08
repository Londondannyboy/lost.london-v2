"""
One-time script to extract keywords for all articles.
Run this to populate topic_keywords, teaser_location, teaser_era, teaser_hook.

Usage:
    cd agent
    source .venv/bin/activate
    source .env.local
    python scripts/extract_keywords.py
"""

import asyncio
import json
import os
import sys
from typing import Optional

import asyncpg
from pydantic_ai import Agent
from pydantic_ai.settings import ModelSettings

# Groq model for fast extraction
EXTRACTION_MODEL = 'groq:llama-3.1-8b-instant'

# Phonetic variants from topic_images (for reference)
PHONETIC_VARIANTS = {
    "thorney": ["thorny", "fawny", "fawney", "fourney", "thorney island"],
    "tyburn": ["tie burn", "tieburn", "tybourne"],
    "ignatius sancho": ["ignacio", "ignasio", "sancho"],
    "aquarium": ["aquarim", "aquariam", "royal aquarium"],
}


async def extract_keywords_for_article(title: str, content: str) -> dict:
    """Extract search keywords, location, era, and hook using LLM."""

    agent = Agent(
        EXTRACTION_MODEL,
        system_prompt="You extract metadata from London history articles. Return valid JSON only.",
        model_settings=ModelSettings(max_tokens=300, temperature=0.3),
    )

    prompt = f"""Extract metadata for this London history article.

TITLE: {title}

CONTENT (first 800 chars):
{content[:800]}

Return JSON with these fields:
{{
    "keywords": ["5-8 lowercase search keywords including topic name, alternate spellings, phonetic variants"],
    "location": "London area (Westminster, East End, City of London, Southwark, etc.) or null",
    "era": "Historical era (Victorian, Georgian, Tudor, Medieval, Roman, etc.) or null",
    "hook": "One engaging sentence about the most interesting fact (under 100 chars)"
}}

Example:
{{
    "keywords": ["royal aquarium", "aquarium", "aquarim", "westminster", "victorian", "crystal palace"],
    "location": "Westminster",
    "era": "Victorian",
    "hook": "Built to rival Crystal Palace, lasted only 27 years"
}}

Return ONLY valid JSON, no other text."""

    try:
        result = await agent.run(prompt)
        output = result.output.strip()

        # Try to parse JSON from the response
        if output.startswith('```'):
            # Remove markdown code blocks
            output = output.split('```')[1]
            if output.startswith('json'):
                output = output[4:]

        data = json.loads(output)
        return {
            "keywords": data.get("keywords", []),
            "location": data.get("location"),
            "era": data.get("era"),
            "hook": data.get("hook", "")[:100],  # Limit hook length
        }
    except Exception as e:
        print(f"  Error extracting for '{title[:50]}': {e}")
        # Fallback: extract keywords from title
        title_words = [w.lower() for w in title.split() if len(w) > 3]
        return {
            "keywords": title_words[:5],
            "location": None,
            "era": None,
            "hook": None,
        }


async def main():
    """Main extraction loop."""

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL not set. Run: source .env.local")
        sys.exit(1)

    groq_key = os.environ.get('GROQ_API_KEY')
    if not groq_key:
        print("ERROR: GROQ_API_KEY not set. Run: source .env.local")
        sys.exit(1)

    print("Connecting to database...")
    conn = await asyncpg.connect(database_url)

    # Check if columns exist, create if not
    print("Checking/creating columns...")
    try:
        await conn.execute("""
            ALTER TABLE articles ADD COLUMN IF NOT EXISTS topic_keywords TEXT[];
            ALTER TABLE articles ADD COLUMN IF NOT EXISTS teaser_location TEXT;
            ALTER TABLE articles ADD COLUMN IF NOT EXISTS teaser_era TEXT;
            ALTER TABLE articles ADD COLUMN IF NOT EXISTS teaser_hook TEXT;
        """)

        # Create GIN index for fast keyword lookup
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_articles_topic_keywords
            ON articles USING GIN(topic_keywords);
        """)
        print("Columns and index ready.")
    except Exception as e:
        print(f"Column creation error (may already exist): {e}")

    # Fetch articles that don't have keywords yet
    print("Fetching articles without keywords...")
    articles = await conn.fetch("""
        SELECT id, title, content
        FROM articles
        WHERE topic_keywords IS NULL OR array_length(topic_keywords, 1) IS NULL
        ORDER BY id
    """)

    print(f"Found {len(articles)} articles to process.")

    if len(articles) == 0:
        print("All articles already have keywords. Done!")
        await conn.close()
        return

    # Process in batches to avoid rate limits
    batch_size = 10
    processed = 0

    for i in range(0, len(articles), batch_size):
        batch = articles[i:i + batch_size]
        print(f"\nProcessing batch {i//batch_size + 1} ({len(batch)} articles)...")

        for article in batch:
            title = article['title']
            content = article['content'] or ""
            article_id = article['id']

            print(f"  Extracting: {title[:50]}...")

            metadata = await extract_keywords_for_article(title, content)

            # Add any known phonetic variants
            keywords = list(set(metadata['keywords']))
            for kw in keywords[:]:
                for base, variants in PHONETIC_VARIANTS.items():
                    if base in kw.lower():
                        keywords.extend(variants)

            keywords = list(set(keywords))[:10]  # Limit to 10 keywords

            # Update database
            await conn.execute("""
                UPDATE articles
                SET topic_keywords = $1,
                    teaser_location = $2,
                    teaser_era = $3,
                    teaser_hook = $4
                WHERE id = $5
            """, keywords, metadata['location'], metadata['era'], metadata['hook'], article_id)

            processed += 1
            print(f"    Keywords: {keywords[:5]}...")

        # Small delay between batches to avoid rate limits
        if i + batch_size < len(articles):
            print("  Waiting 2s before next batch...")
            await asyncio.sleep(2)

    print(f"\n✓ Processed {processed} articles.")

    # Verify
    count = await conn.fetchval("""
        SELECT COUNT(*) FROM articles WHERE topic_keywords IS NOT NULL
    """)
    print(f"✓ {count} articles now have keywords.")

    await conn.close()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
