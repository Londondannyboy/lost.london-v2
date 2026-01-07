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
    const { userId, message, role = "user", name, topic, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ZEP_API_KEY;
    if (!apiKey) {
      console.warn("[Zep User] ZEP_API_KEY not configured");
      return NextResponse.json({ success: false, reason: "ZEP_API_KEY not configured" });
    }

    const client = new ZepClient({ apiKey });

    // Ensure user exists with proper metadata
    try {
      await client.user.get(userId);
    } catch {
      await client.user.add({
        userId,
        firstName: name,
        metadata: { source: "lost-london-v2" },
      });
    }

    // ACTION: Store a specific topic interest (structured entity)
    if (action === "topic_interest" && topic) {
      // Store as structured JSON - Zep will create proper nodes/edges
      const topicData = {
        entity_type: "topic",
        topic_name: topic,
        user_action: "explored",
        user_name: name || "User",
        timestamp: new Date().toISOString(),
      };

      // Use JSON type for structured data
      const result = await client.graph.add({
        userId,
        type: "json",
        data: JSON.stringify(topicData),
      });

      // ALSO store a clear fact statement
      await client.graph.add({
        userId,
        type: "text",
        data: `${name || 'The user'} explored the topic "${topic}" in Lost London.`,
      });

      console.log(`[Zep User] Stored topic interest: ${topic} for ${name || userId}`);

      return NextResponse.json({
        success: true,
        episodeId: result.uuid,
        storedTopic: topic,
      });
    }

    // ACTION: Store user profile info
    if (action === "user_profile" && name) {
      const result = await client.graph.add({
        userId,
        type: "text",
        data: `The user's name is ${name}. They use Lost London to explore London history.`,
      });

      return NextResponse.json({
        success: true,
        episodeId: result.uuid,
        storedName: name,
      });
    }

    // DEFAULT: Store message (with better formatting)
    if (message) {
      // Format for better fact extraction
      let formattedMessage: string;
      if (role === "user") {
        formattedMessage = name
          ? `${name} asked: "${message}"`
          : `User asked: "${message}"`;
      } else {
        formattedMessage = `VIC responded about: ${message.slice(0, 100)}`;
      }

      const result = await client.graph.add({
        userId,
        type: "text",
        data: formattedMessage,
      });

      return NextResponse.json({
        success: true,
        episodeId: result.uuid,
      });
    }

    return NextResponse.json({ success: false, reason: "No action or message provided" });

  } catch (error) {
    console.error("[Zep User] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to store data", details: String(error) },
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
