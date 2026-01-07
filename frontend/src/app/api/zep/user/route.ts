/**
 * Zep User Memory API
 *
 * Manages user memory and facts in Zep
 * - GET: Retrieve user profile and facts (for returning user recognition)
 * - POST: Add a message to user's memory graph
 */

import { NextRequest, NextResponse } from "next/server";
import { ZepClient } from "@getzep/zep-cloud";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ZEP_API_KEY;
    if (!apiKey) {
      console.warn("[Zep User] ZEP_API_KEY not configured");
      return NextResponse.json({
        userId,
        isReturningUser: false,
        facts: [],
        userName: undefined,
        interests: [],
      });
    }

    const client = new ZepClient({ apiKey });

    // Try to search for facts about this user
    // This may fail if user doesn't exist yet - that's OK
    let userFacts: { edges?: Array<{ fact?: string }> } = { edges: [] };
    try {
      userFacts = await client.graph.search({
        userId,
        query: "user name interests preferences topics discussed London history",
        limit: 20,
        scope: "edges",
      });
    } catch (searchError) {
      // User may not exist yet or have no data - return empty profile
      console.log("[Zep User] No facts found for user:", userId);
    }

    // Extract user profile from facts
    const profile = {
      userId,
      isReturningUser: (userFacts.edges?.length || 0) > 0,
      facts: userFacts.edges || [],
      userName: extractUserName(userFacts.edges || []),
      interests: extractInterests(userFacts.edges || []),
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error("[Zep User] GET Error:", error);
    // Return empty profile instead of 500 - don't break the app
    return NextResponse.json({
      userId: "",
      isReturningUser: false,
      facts: [],
      userName: undefined,
      interests: [],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, message, role = "user", name } = await request.json();

    if (!userId || !message) {
      return NextResponse.json(
        { error: "userId and message are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ZEP_API_KEY;
    if (!apiKey) {
      console.warn("[Zep User] ZEP_API_KEY not configured");
      return NextResponse.json({ success: false, reason: "ZEP_API_KEY not configured" });
    }

    const client = new ZepClient({ apiKey });

    // Ensure user exists
    try {
      await client.user.get(userId);
    } catch {
      await client.user.add({ userId });
    }

    // Format message with speaker attribution
    const formattedMessage = name
      ? `${name} (${role}): ${message}`
      : `${role}: ${message}`;

    // Add message to user's graph (Zep automatically extracts facts)
    const result = await client.graph.add({
      userId,
      type: "message",
      data: formattedMessage,
    });

    return NextResponse.json({
      success: true,
      episodeId: result.uuid,
    });
  } catch (error) {
    console.error("[Zep User] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to store message", details: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Extract user name from facts
function extractUserName(edges: Array<{ fact?: string }>): string | undefined {
  for (const edge of edges) {
    const fact = edge.fact?.toLowerCase() || "";
    // Look for patterns like "user's name is X" or "X is the user"
    const namePatterns = [
      /name is (\w+)/i,
      /called (\w+)/i,
      /user (\w+)/i,
      /visitor (\w+)/i,
    ];
    for (const pattern of namePatterns) {
      const match = fact.match(pattern);
      if (match && match[1]) {
        return match[1].charAt(0).toUpperCase() + match[1].slice(1);
      }
    }
  }
  return undefined;
}

// Helper: Extract interests from facts
function extractInterests(edges: Array<{ fact?: string }>): string[] {
  const interests: string[] = [];
  const interestPatterns = [
    /interested in (.+)/i,
    /wants to learn about (.+)/i,
    /asked about (.+)/i,
    /discussed (.+)/i,
    /talked about (.+)/i,
    /curious about (.+)/i,
  ];

  for (const edge of edges) {
    const fact = edge.fact || "";
    for (const pattern of interestPatterns) {
      const match = fact.match(pattern);
      if (match && match[1]) {
        interests.push(match[1].trim());
      }
    }
  }

  return [...new Set(interests)].slice(0, 5); // Unique, max 5
}
