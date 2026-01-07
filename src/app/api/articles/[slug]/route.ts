/**
 * Article Detail API
 *
 * GET: Fetch a single article by slug
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: "DATABASE_URL not configured" },
        { status: 500 }
      );
    }

    const sql = neon(databaseUrl);

    const articles = await sql`
      SELECT id, title, content, slug, excerpt, hero_image_url
      FROM articles
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (articles.length === 0) {
      return NextResponse.json(
        { error: "Article not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ article: articles[0] });
  } catch (error) {
    console.error("[Article API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch article", details: String(error) },
      { status: 500 }
    );
  }
}
