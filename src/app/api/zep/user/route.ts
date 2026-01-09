/**
 * Zep User Memory API - Structured Entity Storage
 *
 * Stores SPECIFIC structured entities in Zep graph:
 * - TopicInterest: Royal Aquarium, Thorney Island (not "London history")
 * - UserProfile: Name, preferred_name
 * - LocationInterest: Westminster, Southwark
 * - EraInterest: Victorian, Tudor
 *
 * This mirrors how CopilotKit demo stores structured profile data.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZepClient } from "@getzep/zep-cloud";

// ============================================================================
// STRUCTURED ENTITY TYPES (like CopilotKit demo)
// ============================================================================

interface TopicEntity {
  entity_type: "topic_interest";
  topic_name: string;      // "Royal Aquarium" not "London history"
  era?: string;            // "Victorian"
  location?: string;       // "Westminster"
  explored_at: string;     // ISO timestamp
}

interface UserProfileEntity {
  entity_type: "user_profile";
  preferred_name: string;
  first_seen: string;
  last_seen: string;
}

interface LocationEntity {
  entity_type: "location_interest";
  location_name: string;   // "Westminster", "Southwark"
  explored_at: string;
}

interface EraEntity {
  entity_type: "era_interest";
  era_name: string;        // "Victorian", "Tudor"
  explored_at: string;
}

// ============================================================================
// GET: Retrieve structured user profile
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const apiKey = process.env.ZEP_API_KEY;
    if (!apiKey) {
      console.warn("[Zep User] ZEP_API_KEY not configured");
      return NextResponse.json({
        userId,
        isReturningUser: false,
        profile: null,
        topics: [],
        locations: [],
        eras: [],
        facts: [],
      });
    }

    const client = new ZepClient({ apiKey });

    // Search for structured entities
    let graphResults: { edges?: Array<{ fact?: string; attributes?: any }> } = { edges: [] };
    try {
      graphResults = await client.graph.search({
        userId,
        query: "topic_interest location_interest era_interest user_profile preferred_name explored",
        limit: 30,
        scope: "edges",
      });
    } catch (searchError) {
      console.log("[Zep User] No data found for user:", userId);
    }

    // Parse structured entities from facts
    const edges = graphResults.edges || [];
    const profile = extractStructuredProfile(edges);

    console.log(`[Zep User] Found ${profile.topics.length} topics, ${profile.locations.length} locations for ${userId}`);

    return NextResponse.json({
      userId,
      isReturningUser: edges.length > 0,
      ...profile,
      facts: edges.map(e => e.fact).filter(Boolean),
    });

  } catch (error) {
    console.error("[Zep User] GET Error:", error);
    return NextResponse.json({
      userId: "",
      isReturningUser: false,
      profile: null,
      topics: [],
      locations: [],
      eras: [],
      facts: [],
    });
  }
}

// ============================================================================
// POST: Store structured entities
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, action, name, topic, era, location } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
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
      await client.user.add({
        userId,
        firstName: name,
        metadata: { source: "lost-london-v2", version: "2026-01" },
      });
    }

    const timestamp = new Date().toISOString();

    // ========================================================================
    // ACTION: topic_interest - Store a SPECIFIC topic (not generic "London")
    // ========================================================================
    if (action === "topic_interest" && topic) {
      // Store as structured entity - SPECIFIC topic name
      const entity: TopicEntity = {
        entity_type: "topic_interest",
        topic_name: topic,  // "Royal Aquarium", "Thorney Island"
        era: era,           // "Victorian"
        location: location, // "Westminster"
        explored_at: timestamp,
      };

      // Store structured JSON
      await client.graph.add({
        userId,
        type: "json",
        data: JSON.stringify(entity),
      });

      // ALSO store a SPECIFIC fact statement that will extract properly
      // Format: "[Name] is interested in [SPECIFIC TOPIC]" not generic "London history"
      const factText = name
        ? `${name} is interested in ${topic}.${era ? ` This is from the ${era} era.` : ''}${location ? ` Located in ${location}.` : ''}`
        : `User is interested in ${topic}.${era ? ` This is from the ${era} era.` : ''}`;

      await client.graph.add({
        userId,
        type: "text",
        data: factText,
      });

      console.log(`[Zep User] Stored topic: "${topic}" (${era || 'no era'}, ${location || 'no location'})`);

      return NextResponse.json({
        success: true,
        stored: { topic, era, location },
      });
    }

    // ========================================================================
    // ACTION: location_interest - Store a specific London location
    // ========================================================================
    if (action === "location_interest" && location) {
      const entity: LocationEntity = {
        entity_type: "location_interest",
        location_name: location,
        explored_at: timestamp,
      };

      await client.graph.add({
        userId,
        type: "json",
        data: JSON.stringify(entity),
      });

      await client.graph.add({
        userId,
        type: "text",
        data: `${name || 'User'} is interested in ${location} in London.`,
      });

      console.log(`[Zep User] Stored location interest: "${location}"`);

      return NextResponse.json({ success: true, stored: { location } });
    }

    // ========================================================================
    // ACTION: era_interest - Store a specific historical era
    // ========================================================================
    if (action === "era_interest" && era) {
      const entity: EraEntity = {
        entity_type: "era_interest",
        era_name: era,
        explored_at: timestamp,
      };

      await client.graph.add({
        userId,
        type: "json",
        data: JSON.stringify(entity),
      });

      await client.graph.add({
        userId,
        type: "text",
        data: `${name || 'User'} is interested in the ${era} era of London history.`,
      });

      console.log(`[Zep User] Stored era interest: "${era}"`);

      return NextResponse.json({ success: true, stored: { era } });
    }

    // ========================================================================
    // ACTION: user_profile - Store user's name and preferences
    // ========================================================================
    if (action === "user_profile" && name) {
      const entity: UserProfileEntity = {
        entity_type: "user_profile",
        preferred_name: name,
        first_seen: timestamp,
        last_seen: timestamp,
      };

      await client.graph.add({
        userId,
        type: "json",
        data: JSON.stringify(entity),
      });

      await client.graph.add({
        userId,
        type: "text",
        data: `The user's preferred name is ${name}. They enjoy exploring London's hidden history.`,
      });

      console.log(`[Zep User] Stored user profile: name="${name}"`);

      return NextResponse.json({ success: true, stored: { name } });
    }

    return NextResponse.json({ success: false, reason: "Unknown action or missing required fields" });

  } catch (error) {
    console.error("[Zep User] POST Error:", error);
    return NextResponse.json(
      { error: "Failed to store data", details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================================================
// HELPER: Extract structured profile from Zep edges
// ============================================================================

function extractStructuredProfile(edges: Array<{ fact?: string; attributes?: any }>) {
  const topics: string[] = [];
  const locations: string[] = [];
  const eras: string[] = [];
  let userName: string | undefined;

  // Patterns to extract SPECIFIC entities from facts
  const topicPattern = /interested in ([A-Z][^.]+?)(?:\.|$)/gi;
  const locationPattern = /interested in ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*) in London/gi;
  const eraPattern = /interested in the (\w+) era/gi;
  const namePattern = /preferred name is (\w+)/i;

  for (const edge of edges) {
    const fact = edge.fact || "";

    // Extract user name
    const nameMatch = fact.match(namePattern);
    if (nameMatch) {
      userName = nameMatch[1];
    }

    // Extract topics (capitalize properly)
    let topicMatch;
    while ((topicMatch = topicPattern.exec(fact)) !== null) {
      const topic = topicMatch[1].trim();
      // Filter out generic terms
      if (!isGenericTerm(topic)) {
        topics.push(topic);
      }
    }

    // Extract locations
    let locationMatch;
    while ((locationMatch = locationPattern.exec(fact)) !== null) {
      locations.push(locationMatch[1].trim());
    }

    // Extract eras
    let eraMatch;
    while ((eraMatch = eraPattern.exec(fact)) !== null) {
      eras.push(eraMatch[1].trim());
    }
  }

  return {
    userName,
    topics: [...new Set(topics)].slice(0, 10),     // Unique, max 10
    locations: [...new Set(locations)].slice(0, 5), // Unique, max 5
    eras: [...new Set(eras)].slice(0, 5),           // Unique, max 5
  };
}

// Filter out generic terms that shouldn't be stored as topics
function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'london', 'london history', 'history', 'the', 'a', 'an',
    'exploring', 'learning', 'studying', 'reading',
  ];
  return genericTerms.includes(term.toLowerCase());
}
