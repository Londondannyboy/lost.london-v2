/**
 * Articles API
 *
 * GET: Fetch all articles with optional search/filter
 * Query params:
 *   - search: Filter by title/content
 *   - limit: Max results (default 50)
 *   - offset: Pagination offset
 */

import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json(
        { error: "DATABASE_URL not configured" },
        { status: 500 }
      );
    }

    const sql = neon(databaseUrl);

    let articles;

    if (search) {
      // Search by title or content
      const searchTerm = `%${search.toLowerCase()}%`;
      articles = await sql`
        SELECT id, title, slug, excerpt, hero_image_url
        FROM articles
        WHERE LOWER(title) LIKE ${searchTerm}
           OR LOWER(content) LIKE ${searchTerm}
        ORDER BY title ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    } else {
      // Get all articles
      articles = await sql`
        SELECT id, title, slug, excerpt, hero_image_url
        FROM articles
        ORDER BY title ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;
    }

    // Get total count
    const countResult = await sql`SELECT COUNT(*) as total FROM articles`;
    const total = countResult[0]?.total || 0;

    return NextResponse.json({
      articles,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[Articles API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch articles", details: String(error) },
      { status: 500 }
    );
  }
}
