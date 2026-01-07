"""Database connection and RRF hybrid search for Neon PostgreSQL with pgvector."""

import os
import json
import sys
import asyncpg
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

DATABASE_URL = os.environ.get("DATABASE_URL", "")


class Database:
    """Async database connection manager for Neon PostgreSQL."""

    _pool: Optional[asyncpg.Pool] = None

    @classmethod
    async def get_pool(cls) -> asyncpg.Pool:
        """Get or create connection pool."""
        if cls._pool is None:
            cls._pool = await asyncpg.create_pool(
                DATABASE_URL,
                min_size=1,
                max_size=5,
                command_timeout=30,
            )
        return cls._pool

    @classmethod
    async def close(cls) -> None:
        """Close the connection pool."""
        if cls._pool:
            await cls._pool.close()
            cls._pool = None


@asynccontextmanager
async def get_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """Get a database connection from the pool."""
    pool = await Database.get_pool()
    async with pool.acquire() as conn:
        yield conn


async def search_articles_hybrid(
    query_embedding: list[float],
    query_text: str,
    limit: int = 5,
    similarity_threshold: float = 0.3
) -> list[dict]:
    """
    Hybrid search using Reciprocal Rank Fusion (RRF).

    RRF combines vector and keyword search by rank position, not raw scores.
    Formula: RRF_score = 1/(k + vector_rank) + 1/(k + keyword_rank)
    where k=60 is the standard constant.

    Args:
        query_embedding: Vector embedding of the query
        query_text: Original query text for keyword matching
        limit: Maximum number of results
        similarity_threshold: Minimum similarity score (for filtering)

    Returns:
        List of matching articles with RRF scores
    """
    async with get_connection() as conn:
        embedding_json = json.dumps(query_embedding)

        # RRF with k=60 (industry standard)
        results = await conn.fetch("""
            WITH
            -- Vector search: rank by embedding similarity
            vector_ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) as vector_rank,
                    1 - (embedding <=> $1::vector) as vector_score
                FROM knowledge_chunks
                WHERE 1 - (embedding <=> $1::vector) > 0.3
                LIMIT 50
            ),
            -- Keyword search: rank by text match quality
            keyword_ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (ORDER BY keyword_score DESC) as keyword_rank,
                    keyword_score
                FROM (
                    SELECT id,
                        CASE
                            WHEN LOWER(content) LIKE '%' || $2 || '%' THEN 3
                            WHEN LOWER(title) LIKE '%' || $2 || '%' THEN 2
                            ELSE 0
                        END as keyword_score
                    FROM knowledge_chunks
                    WHERE LOWER(content) LIKE '%' || $2 || '%'
                       OR LOWER(title) LIKE '%' || $2 || '%'
                ) keyword_matches
                WHERE keyword_score > 0
            ),
            -- RRF: Combine ranks using reciprocal rank fusion
            rrf_combined AS (
                SELECT
                    COALESCE(v.id, k.id) as id,
                    COALESCE(1.0 / (60 + v.vector_rank), 0) +
                    COALESCE(1.0 / (60 + k.keyword_rank), 0) as rrf_score,
                    v.vector_score,
                    v.vector_rank,
                    k.keyword_rank
                FROM vector_ranked v
                FULL OUTER JOIN keyword_ranked k ON v.id = k.id
            )
            SELECT
                kc.id::text,
                kc.title,
                kc.content,
                kc.source_type,
                r.rrf_score as score,
                r.vector_score,
                r.vector_rank,
                r.keyword_rank
            FROM rrf_combined r
            JOIN knowledge_chunks kc ON kc.id = r.id
            ORDER BY r.rrf_score DESC
            LIMIT $3
        """, embedding_json, query_text.lower(), limit)

        print(f"[VIC RRF] Query: '{query_text[:30]}...' -> {len(results)} results", file=sys.stderr)
        for r in results[:3]:
            print(f"[VIC RRF]   {r['title'][:40]}... (RRF={r['score']:.4f})", file=sys.stderr)

        return [dict(r) for r in results]


async def get_article_by_slug(slug: str) -> Optional[dict]:
    """Get a full article by its slug for detailed card display."""
    async with get_connection() as conn:
        result = await conn.fetchrow("""
            SELECT id::text, title, content, slug, excerpt, hero_image_url
            FROM articles
            WHERE slug = $1
        """, slug)
        return dict(result) if result else None


async def get_articles_by_era(era_keywords: list[str], limit: int = 5) -> list[dict]:
    """Get articles matching an era (Victorian, Georgian, etc.)."""
    async with get_connection() as conn:
        # Build OR conditions for era keywords
        conditions = " OR ".join([f"LOWER(content) LIKE '%{kw.lower()}%'" for kw in era_keywords])
        query = f"""
            SELECT id::text, title, content, slug, excerpt, hero_image_url
            FROM articles
            WHERE {conditions}
            LIMIT $1
        """
        results = await conn.fetch(query, limit)
        return [dict(r) for r in results]


async def get_user_preferred_name(user_id: str) -> Optional[str]:
    """
    Get user's preferred name from Neon database.
    Checks both user_data table and better-auth user table.
    """
    try:
        async with get_connection() as conn:
            # First check user_data table for preferred_name
            result = await conn.fetchrow("""
                SELECT preferred_name FROM user_data WHERE user_id = $1
            """, user_id)

            if result and result['preferred_name']:
                print(f"[VIC DB] Found preferred_name in user_data: {result['preferred_name']}", file=sys.stderr)
                return result['preferred_name']

            # Fallback: check better-auth user table for name
            result = await conn.fetchrow("""
                SELECT name FROM "user" WHERE id = $1
            """, user_id)

            if result and result['name']:
                # Extract first name
                name = result['name'].split()[0] if result['name'] else None
                if name:
                    print(f"[VIC DB] Found name in user table: {name}", file=sys.stderr)
                    return name

            print(f"[VIC DB] No name found for user {user_id}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"[VIC DB] Error looking up user name: {e}", file=sys.stderr)
        return None
