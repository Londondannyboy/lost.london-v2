"use client";

/**
 * ROSIE VOICE AGENT - PROTOTYPE (Local Sandbox)
 *
 * This is a prototype for a separate voice agent for Rosie the London Archivist.
 * She can speak when articles are found, and VIC acknowledges her.
 *
 * REQUIREMENTS:
 * 1. Create a new Hume EVI config in dashboard with:
 *    - Female voice (e.g., "Dacher" or custom)
 *    - Different persona: "You are Rosie, the London Archivist"
 *    - Different CLM endpoint (optional): /rosie/chat/completions
 * 2. Set NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID env var
 *
 * ARCHITECTURE:
 * - VIC: Primary voice agent (historian, storyteller)
 * - Rosie: Secondary voice agent (archivist, shares findings)
 * - Coordination: Turn-based, Rosie speaks when results found, VIC responds
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

interface RosieVoiceProps {
  onMessage: (text: string, role?: "user" | "assistant") => void;
  onSpeakComplete?: () => void;
  articlesToAnnounce?: {
    query: string;
    count: number;
    titles: string[];
  } | null;
}

// Rosie's voice component (separate from VIC)
function RosieVoiceButton({
  onMessage,
  onSpeakComplete,
  articlesToAnnounce,
}: RosieVoiceProps) {
  const { connect, disconnect, status, sendUserInput } = useVoice();
  const [hasSpoken, setHasSpoken] = useState(false);
  const announcedRef = useRef<string | null>(null);

  // When articles are ready and Rosie hasn't spoken yet, trigger her
  useEffect(() => {
    if (
      articlesToAnnounce &&
      status.value === "connected" &&
      announcedRef.current !== articlesToAnnounce.query
    ) {
      // Rosie announces the findings
      const announcement = buildRosieAnnouncement(articlesToAnnounce);
      sendUserInput(announcement);
      announcedRef.current = articlesToAnnounce.query;
      setHasSpoken(true);

      // Notify when done (VIC can then respond)
      setTimeout(() => {
        onSpeakComplete?.();
      }, 3000); // Estimate 3s for Rosie to speak
    }
  }, [articlesToAnnounce, status.value, sendUserInput, onSpeakComplete]);

  // Connect Rosie when needed
  const handleConnect = useCallback(async () => {
    if (status.value !== "connected") {
      try {
        const res = await fetch("/api/hume-token");
        const { accessToken } = await res.json();

        // Use ROSIE's config ID (different voice)
        const rosieConfigId = process.env.NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID || "";

        if (!rosieConfigId) {
          console.warn("[Rosie Voice] No NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID set");
          return;
        }

        await connect({
          auth: { type: "accessToken" as const, value: accessToken },
          configId: rosieConfigId,
          sessionSettings: {
            type: "session_settings" as const,
            systemPrompt: ROSIE_SYSTEM_PROMPT,
            customSessionId: `rosie_${Date.now()}`,
          },
        });

        console.log("[Rosie Voice] Connected");
      } catch (e) {
        console.error("[Rosie Voice] Connect error:", e);
      }
    }
  }, [connect, status.value]);

  const isConnected = status.value === "connected";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Rosie Avatar - smaller, positioned differently */}
      <button
        onClick={handleConnect}
        disabled={isConnected}
        className={`w-12 h-12 rounded-full overflow-hidden transition-all ${
          isConnected
            ? "ring-2 ring-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
            : "hover:scale-105 border-2 border-purple-300/50"
        }`}
        title={isConnected ? "Rosie is ready" : "Connect Rosie"}
      >
        <img
          src="/London Librarian Avatar 1.png"
          alt="Rosie - London Archivist"
          className="w-full h-full object-cover"
        />
      </button>

      {isConnected && (
        <span className="text-xs text-purple-300">
          {hasSpoken ? "Rosie spoke" : "Rosie ready"}
        </span>
      )}
    </div>
  );
}

// Build Rosie's announcement based on search results
function buildRosieAnnouncement(articles: {
  query: string;
  count: number;
  titles: string[];
}): string {
  const { query, count, titles } = articles;

  if (count === 0) {
    return `speak: I've searched the archives for ${query}, but I couldn't find any matching articles. Sorry about that.`;
  }

  if (count === 1) {
    return `speak: I've found an article about ${query} - "${titles[0]}". I've shared it in the panel for you.`;
  }

  const titleList = titles.slice(0, 2).join(" and ");
  return `speak: I've found ${count} articles about ${query}, including ${titleList}. They're in the panel now.`;
}

// Rosie's system prompt
const ROSIE_SYSTEM_PROMPT = `You are Rosie, the London Archivist at Lost London.

IDENTITY:
- You are Rosie, a friendly archivist who manages Vic Keegan's article collection
- You speak with a warm, helpful tone
- You ONLY speak when you have search results to share

RULES:
- Keep announcements brief (1-2 sentences)
- Always mention what you found: "I've found X articles about..."
- Don't engage in conversation - just announce findings
- After announcing, let VIC continue the conversation

VOICE:
- Female voice, friendly and professional
- Slightly faster pace than VIC
- Clear enunciation`;

// Wrapper with VoiceProvider for Rosie
export function RosieVoice({
  onMessage,
  onSpeakComplete,
  articlesToAnnounce,
}: RosieVoiceProps) {
  return (
    <VoiceProvider
      onError={(err) => console.error("[Rosie Voice] Error:", err)}
      onOpen={() => console.log("[Rosie Voice] Connected")}
      onClose={(e) => console.log("[Rosie Voice] Closed:", e)}
    >
      <RosieVoiceButton
        onMessage={onMessage}
        onSpeakComplete={onSpeakComplete}
        articlesToAnnounce={articlesToAnnounce}
      />
    </VoiceProvider>
  );
}

/**
 * USAGE IN page.tsx:
 *
 * 1. Import: import { RosieVoice } from "@/components/rosie-voice";
 *
 * 2. Add state for articles to announce:
 *    const [rosieArticles, setRosieArticles] = useState(null);
 *
 * 3. In useRenderToolCall for delegate_to_librarian, set:
 *    setRosieArticles({
 *      query: uiData.query,
 *      count: uiData.articles?.length || 0,
 *      titles: uiData.articles?.map(a => a.title) || [],
 *    });
 *
 * 4. Add RosieVoice component:
 *    <RosieVoice
 *      articlesToAnnounce={rosieArticles}
 *      onSpeakComplete={() => {
 *        // Optionally tell VIC to acknowledge
 *        sendUserInput("Rosie has shared some articles");
 *      }}
 *    />
 *
 * 5. Set NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID in Vercel
 */
