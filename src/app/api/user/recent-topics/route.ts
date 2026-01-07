import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

/**
 * GET /api/user/recent-topics
 *
 * Returns user's recent topics from database (more reliable than Zep inference).
 * Used for returning user greeting personalization.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ topics: [], visitCount: 0, isReturning: false });
    }

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ topics: [], visitCount: 0, isReturning: false });
    }

    const sql = neon(databaseUrl);

    // Get unique recent topics (last 3)
    const recentTopics = await sql`
      SELECT
        LOWER(query) as topic,
        MAX(article_title) as article_title,
        MAX(article_slug) as article_slug,
        MAX(created_at) as last_asked,
        COUNT(*) as times_asked
      FROM user_queries
      WHERE user_id = ${userId}
        AND query IS NOT NULL
        AND LENGTH(query) > 2
      GROUP BY LOWER(query)
      ORDER BY MAX(created_at) DESC
      LIMIT 3
    `;

    // Get total visit count (unique sessions)
    const visitStats = await sql`
      SELECT
        COUNT(DISTINCT session_id) as visit_count,
        MIN(created_at) as first_visit,
        MAX(created_at) as last_visit
      FROM user_queries
      WHERE user_id = ${userId}
    `;

    const stats = visitStats[0] || { visit_count: '0' };
    const visitCount = parseInt(stats.visit_count as string) || 0;

    return NextResponse.json({
      topics: recentTopics.map(t => ({
        topic: t.topic,
        articleTitle: t.article_title,
        articleSlug: t.article_slug,
        lastAsked: t.last_asked,
        timesAsked: parseInt(t.times_asked as string) || 1,
      })),
      visitCount,
      isReturning: visitCount > 1,
      firstVisit: stats.first_visit,
      lastVisit: stats.last_visit,
    });

  } catch (error) {
    console.error('[Recent Topics] Error:', error);
    return NextResponse.json({ topics: [], visitCount: 0, isReturning: false });
  }
}
