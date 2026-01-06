import { NextRequest, NextResponse } from 'next/server';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 });
    }

    // Call the Railway backend search endpoint
    // The backend has a search_articles function we can expose
    const response = await fetch(`${AGENT_URL.replace('/agui', '')}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });

    if (!response.ok) {
      // Fallback: return mock data for now
      console.log('[Search API] Backend unavailable, returning mock');
      return NextResponse.json({
        articles: [
          {
            id: '1',
            title: `Article about ${query}`,
            excerpt: `Information about ${query}...`,
            slug: query.toLowerCase().replace(/\s+/g, '-'),
            score: 0.95,
          }
        ],
        query,
      });
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
