"use client";

import { CopilotSidebar, CopilotPopup, CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { useRenderToolCall, useCopilotChat, useCoAgent, useCopilotContext } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { VoiceInput } from "@/components/voice-input";
import { ArticleGrid } from "@/components/generative-ui/ArticleGrid";
import { ArticleCard } from "@/components/generative-ui/ArticleCard";
import { LocationMap } from "@/components/generative-ui/LocationMap";
import { Timeline } from "@/components/generative-ui/Timeline";
import { BookDisplay } from "@/components/generative-ui/BookDisplay";
import { TopicContext } from "@/components/generative-ui/TopicContext";
import { TopicImage } from "@/components/generative-ui/TopicImage";
import { LibrarianMessage, LibrarianThinking } from "@/components/LibrarianAvatar";
import { CustomUserMessage, ChatUserContext } from "@/components/ChatMessages";
import { DebugPanel } from "@/components/DebugPanel";
import { RosieVoice } from "@/components/rosie-voice";
import { ConfirmInterestFromTool } from "@/components/ConfirmInterest";
import { TopicChangeConfirmation, detectTopicChangeRequest } from "@/components/TopicChangeConfirmation";
import { ArticlesSection } from "@/components/ArticlesSection";
import { useCallback, useEffect, useState, useRef } from "react";
import { authClient } from "@/lib/auth/client";

// Hook to detect mobile viewport
function useIsMobile(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check on mount
    const checkMobile = () => setIsMobile(window.innerWidth < breakpoint);
    checkMobile();

    // Listen for resize
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [breakpoint]);

  return isMobile;
}

// Loading component for tool results
function ToolLoading({ title }: { title: string }) {
  return (
    <div className="bg-stone-50 rounded-lg p-4 animate-pulse">
      <div className="text-sm text-stone-400">{title}</div>
      <div className="flex items-center justify-center h-20">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    </div>
  );
}

function TopicButton({ topic, onClick }: { topic: string; onClick: (topic: string) => void }) {
  return (
    <button
      onClick={() => onClick(topic)}
      className="px-5 py-2.5 text-sm font-medium rounded-full transition-all duration-200 bg-[#1a1612]/60 text-white hover:bg-[#f4ead5] hover:text-[#2a231a] hover:scale-105 cursor-pointer border-2 border-white/40 hover:border-[#8b6914] backdrop-blur-sm shadow-lg"
    >
      {topic}
    </button>
  );
}

// Smart assistant message - shows BOTH VIC's intro AND Librarian UI when available
function SmartAssistantMessage({ message }: { message?: { generativeUI?: () => React.ReactNode; content?: string } }) {
  // Get generative UI from tools (Librarian's output)
  const generativeUI = message?.generativeUI?.();

  // Check if generativeUI actually has renderable content
  // Must be a valid React element, not null/undefined/empty string
  const hasValidGenerativeUI = generativeUI !== null &&
    generativeUI !== undefined &&
    generativeUI !== false &&
    // Check it's not an empty string or whitespace
    !(typeof generativeUI === 'string' && !generativeUI.trim());

  // Get VIC's text content - clean it up
  const rawContent = typeof message?.content === "string" ? message.content : "";
  // Filter out empty, whitespace-only, or tool call artifacts
  const textContent = rawContent.trim();
  const isValidText = textContent.length > 2 &&
    !textContent.startsWith("{") &&
    !textContent.includes("tool_call") &&
    !textContent.includes("delegate_to");

  // If there's tool UI (Librarian) with actual content, show BOTH VIC's intro AND Librarian's content
  if (hasValidGenerativeUI) {
    return (
      <div className="space-y-3 mb-4">
        {/* VIC's brief intro if present */}
        {isValidText && (
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
                <img src="/vic-avatar.jpg" alt="VIC" className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-amber-800">VIC</span>
              </div>
              <div className="bg-amber-50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-300">
                {textContent}
              </div>
            </div>
          </div>
        )}

        {/* Librarian's research results */}
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
              <img src="/London Librarian Avatar 1.png" alt="Rosie" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-amber-700">Rosie</span>
            </div>
            <div className="bg-amber-50/50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-200">
              {generativeUI}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If there's valid text but no tool UI, show VIC's response only
  if (isValidText) {
    return (
      <div className="flex gap-3 mb-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
            <img src="/vic-avatar.jpg" alt="VIC" className="w-full h-full object-cover" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-amber-800">VIC</span>
          </div>
          <div className="bg-amber-50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-300">
            {textContent}
          </div>
        </div>
      </div>
    );
  }

  // Nothing valid to show - return null (no empty messages!)
  return null;
}

// Context for sharing background setter with render callbacks
import { createContext, useContext } from 'react';

// Background state includes both URL and topic name for caption
type BackgroundState = {
  url: string | null;
  topic: string | null;
};
const BackgroundContext = createContext<{
  setBackground: (url: string | null, topic?: string) => void;
  currentBackground: BackgroundState;
}>({
  setBackground: () => {},
  currentBackground: { url: null, topic: null }
});

// Component to set background when mounted (used in render callbacks)
function BackgroundUpdater({ imageUrl, topic }: { imageUrl: string; topic?: string }) {
  const { setBackground } = useContext(BackgroundContext);
  useEffect(() => {
    if (imageUrl) {
      setBackground(imageUrl, topic);
    }
  }, [imageUrl, topic, setBackground]);
  return null;
}

// Helper to extract topic from user query (for Zep storage)
function extractTopicFromQuery(query: string): string | null {
  const lowerQuery = query.toLowerCase();

  // Common query patterns to extract topic from
  const patterns = [
    /tell me about (.+)/i,
    /what (?:is|was|are|were) (?:the )?(.+)/i,
    /(?:show|find) (?:me )?(?:an? )?(?:image|picture|photo) of (.+)/i,
    /where (?:is|was) (?:the )?(.+)/i,
    /(?:who|what) (?:is|was) (.+)/i,
    /history of (.+)/i,
    /learn about (.+)/i,
    /explore (.+)/i,
    /(.+?) history/i,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted topic
      let topic = match[1].trim()
        .replace(/\?+$/, '')  // Remove trailing ?
        .replace(/^the /i, '')  // Remove leading "the"
        .replace(/please$/i, '')  // Remove trailing "please"
        .trim();

      // Only return if topic is meaningful (2+ words or known location)
      if (topic.length >= 4) {
        // Capitalize first letter of each word
        return topic.split(' ')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
    }
  }

  // Fallback: Check for known London topics in the query
  const knownTopics = [
    'thorney island', 'royal aquarium', 'tyburn', 'crystal palace',
    'london bridge', 'tower of london', 'fleet street', 'southwark',
    'westminster', 'thames', 'victorian', 'georgian', 'medieval',
    'blackfriars', 'bankside', 'spitalfields', 'whitechapel', 'mayfair',
    'covent garden', 'hyde park', 'chelsea', 'lambeth', 'vauxhall',
  ];

  for (const topic of knownTopics) {
    if (lowerQuery.includes(topic)) {
      return topic.split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  // Final fallback: if query is short (1-4 words) and looks like a topic name, use it directly
  // This handles queries like "Royal Aquarium" or "Thorney Island" said directly
  const words = query.trim().split(/\s+/);
  if (words.length >= 1 && words.length <= 4 && query.length >= 5 && query.length <= 50) {
    // Exclude common non-topic phrases
    const nonTopics = ['yes', 'no', 'hello', 'hi', 'thanks', 'thank you', 'bye', 'goodbye', 'ok', 'okay'];
    if (!nonTopics.includes(lowerQuery)) {
      return query.trim()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    }
  }

  return null;
}

// Helper to store STRUCTURED topic interest to Zep (with era, location)
// This creates specific entities like "Royal Aquarium" not generic "London history"
async function storeTopicToZep(
  userId: string,
  topic: string,
  name?: string,
  era?: string,
  location?: string
) {
  if (!userId || !topic || topic.length < 3) return;

  // Filter out generic topics
  const genericTopics = ['london', 'history', 'london history', 'the'];
  if (genericTopics.includes(topic.toLowerCase())) return;

  try {
    await fetch('/api/zep/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action: 'topic_interest',
        topic,      // "Royal Aquarium", "Thorney Island"
        era,        // "Victorian"
        location,   // "Westminster"
        name,
      }),
    });
    console.log(`[Zep] Stored topic: "${topic}" (era: ${era || 'none'}, location: ${location || 'none'})`);
  } catch (e) {
    console.warn('[Zep] Failed to store topic:', e);
  }
}

// Helper to store user profile to Zep
async function storeUserProfileToZep(userId: string, name: string) {
  if (!userId || !name) return;
  try {
    await fetch('/api/zep/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        action: 'user_profile',
        name,
      }),
    });
    console.log('[Zep] Stored user profile:', name);
  } catch (e) {
    console.warn('[Zep] Failed to store profile:', e);
  }
}

// Helper to store messages to Zep memory
async function storeToZep(userId: string, message: string, role: "user" | "assistant", name?: string) {
  if (!userId || message.length < 5) return;
  try {
    await fetch('/api/zep/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, message, role, name }),
    });
  } catch (e) {
    console.error('[VIC] Failed to store to Zep:', e);
  }
}

// Agent state - synced to backend via useCoAgent
type AgentState = {
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

// Type for Rosie's article announcements
interface RosieArticles {
  query: string;
  count: number;
  titles: string[];
}

export default function Home() {
  const { appendMessage } = useCopilotChat();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // Rosie voice: articles to announce when found
  const [rosieArticles, setRosieArticles] = useState<RosieArticles | null>(null);
  const lastRosieQueryRef = useRef<string | null>(null); // Prevent duplicate announcements

  // Topic change confirmation (HITL for voice users who don't open sidebar)
  const [pendingTopicChange, setPendingTopicChange] = useState<{
    currentTopic: string;
    newTopic: string;
  } | null>(null);

  // Collapse sidebar on mobile - voice is the primary experience
  const isMobile = useIsMobile();

  // User profile state for Zep personalization
  const [userProfile, setUserProfile] = useState<{
    preferred_name?: string;
    isReturningUser?: boolean;
    facts?: string[];
  }>({});

  // Dynamic background based on current topic - tracks both URL and topic name
  const [backgroundState, setBackgroundState] = useState<BackgroundState>({ url: null, topic: null });

  // Callback to set background with optional topic name
  const setBackground = useCallback((url: string | null, topic?: string) => {
    setBackgroundState({ url, topic: topic || null });
  }, []);

  // Fetch user profile and Zep context on mount
  useEffect(() => {
    async function fetchUserContext() {
      if (!user?.id) return;

      // Fetch user profile from our DB
      try {
        const profileRes = await fetch('/api/user-profile');
        if (profileRes.ok) {
          const profile = await profileRes.json();
          setUserProfile(prev => ({ ...prev, preferred_name: profile.preferred_name }));
        }
      } catch (e) {
        console.error('[VIC] Failed to fetch profile:', e);
      }

      // Fetch Zep context
      try {
        const zepRes = await fetch(`/api/zep/user?userId=${user.id}`);
        if (zepRes.ok) {
          const zepData = await zepRes.json();
          setUserProfile(prev => ({
            ...prev,
            isReturningUser: zepData.isReturningUser,
            facts: zepData.facts?.map((f: { fact?: string }) => f.fact).filter(Boolean),
          }));
          console.log('[VIC] User context:', zepData.isReturningUser ? 'returning' : 'new', 'with', zepData.facts?.length || 0, 'facts');
        }
      } catch (e) {
        console.error('[VIC] Failed to fetch Zep context:', e);
      }
    }
    fetchUserContext();
  }, [user?.id]);

  // Get user's first name for personalization
  const userName = userProfile.preferred_name || user?.name?.split(' ')[0] || user?.name;

  // Sync user to agent state via useCoAgent
  // The backend tool get_my_profile reads from ctx.deps.state.user
  const { state: agentState, setState: setAgentState } = useCoAgent<AgentState>({
    name: "vic_agent",
    initialState: { user: undefined },
  });

  // Track if we've already synced to prevent loops
  const hasSyncedRef = useRef(false);

  // Sync logged-in user to agent state and store profile to Zep
  // FIXED: Removed setAgentState from deps and added ref to prevent infinite loops
  useEffect(() => {
    if (user?.id && !hasSyncedRef.current) {
      hasSyncedRef.current = true;
      const userInfo = {
        id: user.id,
        name: userName || user.name || 'Unknown',
        email: user.email || '',
      };
      setAgentState(prev => ({ ...prev, user: userInfo }));
      console.log('[VIC] User synced to agent state:', userInfo);

      // Store user profile to Zep for returning user recognition
      const displayName = userName || user.name?.split(' ')[0];
      if (displayName) {
        storeUserProfileToZep(user.id, displayName);
      }
    }
  }, [user?.id, user?.name, user?.email, userName, setAgentState]);

  // Handle voice messages
  // IMPORTANT: Only forward USER messages to CopilotKit to trigger tools
  // VIC's VOICE responses should NOT be printed - voice IS the response
  // Librarian UI will appear via useRenderToolCall when tools run
  const handleVoiceMessage = useCallback((text: string, role?: "user" | "assistant") => {
    console.log(`[VIC] Voice ${role}: ${text.slice(0, 50)}...`);

    // Check if VIC is asking about topic change (assistant message)
    // Use setTimeout to defer state update and avoid React #185 error
    if (role === "assistant") {
      const topicChange = detectTopicChangeRequest(text);
      if (topicChange.isTopicChange && topicChange.currentTopic && topicChange.newTopic) {
        const currentTopic = topicChange.currentTopic;
        const newTopic = topicChange.newTopic;
        console.log(`[VIC] Topic change detected: ${currentTopic} → ${newTopic}`);
        setTimeout(() => {
          setPendingTopicChange({ currentTopic, newTopic });
        }, 0);
      }
    }

    // Only forward USER messages to CopilotKit
    // This triggers the agent which runs tools -> Librarian UI appears
    // VIC's spoken response should NOT appear as text (ruins the magic)
    if (role === "user") {
      appendMessage(new TextMessage({ content: text, role: Role.User }));

      // Extract topic from user query and store to Zep
      if (user?.id) {
        const topic = extractTopicFromQuery(text);
        if (topic) {
          storeTopicToZep(user.id, topic, userProfile.preferred_name);
        }
      }
    }
    // Note: VIC's voice response is handled by Hume - don't duplicate in chat
  }, [appendMessage, user?.id, userProfile.preferred_name]);

  const handleTopicClick = useCallback((topic: string) => {
    const message = `Tell me about ${topic}`;
    appendMessage(new TextMessage({ content: message, role: Role.User }));

    // Store topic as structured entity to Zep (not just raw message)
    if (user?.id) {
      storeTopicToZep(user.id, topic, userProfile.preferred_name);
    }
  }, [appendMessage, user?.id, userProfile.preferred_name]);

  // =============================================================================
  // GENERATIVE UI: Render tool results from Pydantic AI agent
  // These render IN the CopilotSidebar chat when the agent calls tools
  // =============================================================================

  useRenderToolCall({
    name: "search_lost_london",
    render: ({ result, status }) => {
      if (status !== "complete" || !result) return <ToolLoading title="Searching articles..." />;
      if (!result?.found) {
        return (
          <div className="p-4 bg-stone-50 rounded-lg text-stone-500">
            {result?.message || "No articles found"}
          </div>
        );
      }
      return <ArticleGrid articles={result.articles} query={result.query} />;
    },
  });

  useRenderToolCall({
    name: "show_article_card",
    render: ({ result, status }) => {
      if (status !== "complete" || !result) return <ToolLoading title="Loading article..." />;
      if (!result?.found || !result?.card) {
        return (
          <div className="p-4 bg-stone-50 rounded-lg text-stone-500">
            {result?.message || "Article not found"}
          </div>
        );
      }
      return <ArticleCard {...result.card} />;
    },
  });

  useRenderToolCall({
    name: "show_map",
    render: ({ result, status }) => {
      if (status !== "complete" || !result) return <ToolLoading title="Loading map..." />;
      if (!result?.found || !result?.location) {
        return (
          <div className="p-4 bg-stone-50 rounded-lg text-stone-500">
            {result?.message || "Location not found"}
          </div>
        );
      }
      return <LocationMap location={result.location} />;
    },
  });

  useRenderToolCall({
    name: "show_timeline",
    render: ({ result, status }) => {
      if (status !== "complete" || !result) return <ToolLoading title="Loading timeline..." />;
      if (!result?.found || !result?.events) {
        return (
          <div className="p-4 bg-stone-50 rounded-lg text-stone-500">
            {result?.message || "No timeline available"}
          </div>
        );
      }
      return <Timeline era={result.era} events={result.events} />;
    },
  });

  useRenderToolCall({
    name: "show_books",
    render: ({ result, status }) => {
      if (status !== "complete" || !result) return <ToolLoading title="Loading books..." />;
      if (!result?.books) {
        return (
          <div className="p-4 bg-stone-50 rounded-lg text-stone-500">
            No books found
          </div>
        );
      }
      return <BookDisplay books={result.books} />;
    },
  });

  // =============================================================================
  // LIBRARIAN: Render delegated research results
  // When VIC delegates to the Librarian, render with distinct styling
  // =============================================================================

  useRenderToolCall({
    name: "delegate_to_librarian",
    render: ({ result, status }) => {
      // Loading state
      if (status !== "complete" || !result) {
        return <LibrarianThinking />;
      }

      // Error state
      if (!result?.found) {
        return (
          <LibrarianMessage brief={result?.content}>
            <div className="p-4 bg-amber-50 rounded-lg text-amber-700">
              I couldn&apos;t find anything in the archives about that topic.
            </div>
          </LibrarianMessage>
        );
      }

      // Render the appropriate UI component based on what Librarian returned
      const uiComponent = result?.ui_component;
      const uiData = result?.ui_data || result;

      // Debug disabled - was causing console spam
      // console.log('[Rosie] Full result:', { uiComponent, query: uiData?.query });

      // TopicContext is rendered directly (it includes its own Librarian header)
      if (uiComponent === "TopicContext") {
        // Set Rosie's articles to announce (for dual-voice prototype)
        // Use ref to prevent infinite loop - only announce once per query
        const currentQuery = uiData?.query || "your topic";
        if (uiData?.articles && uiData.articles.length > 0 && lastRosieQueryRef.current !== currentQuery) {
          lastRosieQueryRef.current = currentQuery;
          setRosieArticles({
            query: currentQuery,
            count: uiData.articles.length,
            titles: uiData.articles.map((a: any) => a.title || a.name).slice(0, 3),
          });
        }

        return (
          <>
            {/* Update hero background when topic has an image */}
            {uiData?.hero_image && <BackgroundUpdater imageUrl={uiData.hero_image} topic={uiData?.query} />}

            {/* HITL: Confirm interest before storing to Zep */}
            {user?.id && uiData?.query && uiData.query.length > 3 && (
              <ConfirmInterestFromTool
                result={{
                  topic: uiData.query,
                  era: uiData?.era,
                  location: uiData?.location,
                }}
                userId={user.id}
                userName={userProfile.preferred_name}
                onConfirm={(interest) => {
                  console.log("[HITL] User confirmed interest:", interest.topic);
                }}
                onSkip={() => {
                  console.log("[HITL] User skipped interest");
                }}
              />
            )}

            <TopicContext
              query={uiData?.query || ""}
              brief={uiData?.brief}
              articles={uiData?.articles}
              location={uiData?.location}
              era={uiData?.era}
              timeline_events={uiData?.timeline_events}
              hero_image={uiData?.hero_image}
              onTimelineEventClick={(event) => {
                const message = `Tell me about ${event.title} in ${event.year}`;
                appendMessage(new TextMessage({ content: message, role: Role.User }));
              }}
              onArticleClick={(article) => {
                const message = `Tell me more about ${article.title}`;
                appendMessage(new TextMessage({ content: message, role: Role.User }));
              }}
            />
          </>
        );
      }

      // TopicImage - single image display (for "show me image of X")
      if (uiComponent === "TopicImage" && uiData?.hero_image) {
        return (
          <>
            <BackgroundUpdater imageUrl={uiData.hero_image} topic={uiData?.query} />
            <LibrarianMessage brief={uiData?.brief}>
              <TopicImage
                query={uiData?.query || ""}
                hero_image={uiData.hero_image}
                brief={uiData?.brief}
              />
            </LibrarianMessage>
          </>
        );
      }

      // Wrap other Librarian outputs in LibrarianMessage for distinct styling
      return (
        <LibrarianMessage brief={uiData?.brief || result?.content}>
          {uiComponent === "ArticleGrid" && uiData?.articles && (
            <ArticleGrid articles={uiData.articles} query={uiData.query} />
          )}
          {uiComponent === "LocationMap" && uiData?.location && (
            <LocationMap location={uiData.location} />
          )}
          {uiComponent === "Timeline" && uiData?.events && (
            <Timeline era={uiData.era} events={uiData.events} />
          )}
          {uiComponent === "BookDisplay" && uiData?.books && (
            <BookDisplay books={uiData.books} />
          )}
          {!uiComponent && result?.content && (
            <p className="text-stone-600">{result.content}</p>
          )}
        </LibrarianMessage>
      );
    },
  });

  // Build dynamic instructions with user context
  // NOTE: The backend middleware extracts user info by looking for "User Name:", "User ID:", etc.
  const instructions = user
    ? `You are VIC (Vic Keegan), a warm London historian with 370+ articles. Help users explore London's hidden history.

## USER CONTEXT (for backend extraction)
- User Name: ${userName || user.name || 'unknown'}
- User ID: ${user.id}
- User Email: ${user.email || 'unknown'}
- Status: ${userProfile.isReturningUser ? 'Returning user' : 'New user'}
${userProfile.facts?.length ? `- Recent interests: ${userProfile.facts.slice(0, 3).join(', ')}` : ''}
${backgroundState.topic ? `- Current Background Image: ${backgroundState.topic} (You can reference this - "as you can see in the image..." or "the image shows...")` : ''}

## RULES FOR THIS USER
${userName ? `The user's name is "${userName}". Use their name occasionally (not every message).` : 'The user has not provided their name yet.'}
${userProfile.isReturningUser ? 'This is a RETURNING user - greet them warmly.' : ''}

## CRITICAL IDENTITY RULES
- NEVER say "I am a language model" or "I don't have access to personal information"
- You ARE Vic Keegan. Stay in character always.
- NEVER output code, tool names, function calls, or technical text - speak naturally
- If asked "what is my name": ${userName ? `Answer "You're ${userName}, of course!"` : 'Say "I don\'t believe you\'ve told me your name yet. What should I call you?"'}
- If asked about yourself: "I'm Vic Keegan, London historian and author of the Lost London books"

## ROSIE (London Archivist)
- Use delegate_to_librarian tool when users ask about places, topics, or want to see visual content
- For major searches, say "Let me ask Rosie to check the archives..." BEFORE calling delegate_to_librarian
- For follow-up queries, just delegate silently
- Rosie will show articles, maps, timelines, and images in the sidebar - weave her findings into your narrative

## TOOL USAGE
- delegate_to_librarian: For finding articles, maps, timelines about topics
- show_books: When asked about your published books

## OUTPUT RULES
- Keep responses SHORT and conversational (2-3 sentences max for greetings)
- NEVER output code snippets, function names, or technical syntax
- NEVER repeat yourself or echo facts back verbatim
- Speak naturally as a historian sharing stories`
    : `You are VIC (Vic Keegan), a warm London historian with 370+ articles. Help users explore London's hidden history. The user is not logged in.

## CRITICAL IDENTITY RULES
- NEVER say "I am a language model" or "I don't have access to personal information"
- You ARE Vic Keegan. Stay in character always.
- NEVER output code, tool names, function calls, or technical text - speak naturally
- If asked "what is my name": Say "I don't believe you've told me your name yet. What should I call you?"
- If asked about yourself: "I'm Vic Keegan, London historian and author of the Lost London books"

## ROSIE (London Archivist)
- Use delegate_to_librarian tool when users ask about places, topics, or want to see visual content
- For major searches, say "Let me ask Rosie to check the archives..." BEFORE calling delegate_to_librarian
- Rosie will show articles, maps, timelines, and images in the sidebar - weave her findings into your narrative

## TOOL USAGE
- delegate_to_librarian: For finding articles, maps, timelines about topics
- show_books: When asked about your published books

## OUTPUT RULES
- Keep responses SHORT and conversational (2-3 sentences max for greetings)
- NEVER output code snippets, function names, or technical syntax
- Speak naturally as a historian sharing stories`;

  // Build personalized initial message - keep it SHORT
  // Use extracted interests (not raw facts) for better UX
  const initialMessage = (() => {
    // Get clean interest from extracted interests array (not raw facts)
    const recentInterest = userProfile.facts
      ?.map((f: string) => {
        // Extract topic from fact patterns
        const match = f.match(/(?:interested in|asked about|discussed|talked about|curious about)\s+(.+)/i);
        return match?.[1]?.replace(/['"]/g, '').trim();
      })
      .filter(Boolean)[0];

    if (userName && userProfile.isReturningUser && recentInterest) {
      return `Welcome back, ${userName}. Last time we explored ${recentInterest}. Shall we continue, or discover something new?`;
    } else if (userName && userProfile.isReturningUser) {
      return `Welcome back, ${userName}. What shall we explore today?`;
    } else if (userName) {
      return `Hello ${userName}. I'm Vic Keegan. What corner of London's history shall we explore?`;
    } else {
      return "Hello. I'm Vic Keegan. How can I help?";
    }
  })();

  // User context for custom chat components
  const chatUserContextValue = {
    userName: userName || user?.name?.split(' ')[0] || 'You',
    userImage: (user as any)?.image || undefined,
  };

  // Background context value - includes current state for VIC to know what's displayed
  const backgroundContextValue = {
    setBackground,
    currentBackground: backgroundState,
  };

  // CopilotKit custom styling - soft London aesthetic
  const copilotStyles: CopilotKitCSSProperties = {
    "--copilot-kit-background-color": "rgba(250, 247, 240, 0.95)",
    "--copilot-kit-secondary-color": "rgba(255, 255, 255, 0.9)",
    "--copilot-kit-primary-color": "#8b6914",
    "--copilot-kit-separator-color": "rgba(139, 105, 20, 0.2)",
  };

  // Get setThreadId for clear conversation functionality
  const { setThreadId } = useCopilotContext();

  // Clear conversation handler - generates new thread ID
  const handleClearConversation = () => {
    const newThreadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setThreadId(newThreadId);
    // Also reset background
    setBackground(null);
  };

  // Custom header with clear button
  const CustomHeader = ({ onClose }: { onClose?: () => void }) => (
    <div className="flex items-center justify-between p-3 border-b border-amber-200 bg-amber-50/80">
      <div className="flex items-center gap-2">
        <img src="/London Librarian Avatar 1.png" alt="Rosie" className="w-8 h-8 rounded-full" />
        <span className="font-semibold text-amber-900">Rosie - London Archivist</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleClearConversation}
          className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
          title="Clear conversation"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  // Shared props for both Sidebar and Popup
  const copilotProps = {
    instructions,
    labels: {
      title: "Rosie - London Archivist",
      initial: initialMessage,
    },
    UserMessage: CustomUserMessage,
    AssistantMessage: SmartAssistantMessage,
    Header: CustomHeader,
  };

  // Main content component - reused for both mobile and desktop
  const MainContent = (
    <div className="bg-white text-black min-h-screen">
      {/* Hero Section - Full Screen */}
      <section className="relative min-h-screen flex items-center justify-center bg-[#1a1612]">
        {/* Background - Dynamic or default map */}
        <div className="absolute inset-0 z-0">
          <img
            src={backgroundState.url || "/London Map with River.jpg"}
            alt=""
            className="w-full h-full object-cover transition-all duration-1000"
            style={{ opacity: backgroundState.url ? 0.5 : 0.4, filter: 'sepia(30%) contrast(1.1)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1612]/70 via-[#1a1612]/40 to-[#1a1612]/90" />
          {/* Image caption - shows topic name when dynamic image is displayed */}
          {backgroundState.topic && (
            <div className="absolute bottom-20 left-4 z-10">
              <span className="text-white/70 text-xs font-medium bg-black/30 px-2 py-1 rounded backdrop-blur-sm">
                {backgroundState.topic}
              </span>
            </div>
          )}
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-6 md:py-12 text-center">
          {/* VIC Avatar - The hero, center stage on all devices */}
          <div className="flex flex-col items-center mb-6">
            {/* VIC Avatar - Primary Voice */}
            <VoiceInput
              onMessage={handleVoiceMessage}
              userId={user?.id}
              userName={userProfile.preferred_name || user?.name?.split(' ')[0] || user?.name}
              isReturningUser={userProfile.isReturningUser}
              userFacts={userProfile.facts}
            />

            {/* Topic Change Confirmation - HITL buttons for voice users */}
            {pendingTopicChange && (
              <div className="mt-4 w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
                <TopicChangeConfirmation
                  currentTopic={pendingTopicChange.currentTopic}
                  newTopic={pendingTopicChange.newTopic}
                  userId={user?.id}
                  userName={userProfile.preferred_name}
                  onConfirm={(newTopic) => {
                    // Send confirmation message to CopilotKit
                    appendMessage(new TextMessage({ content: "Yes", role: Role.User }));
                    setPendingTopicChange(null);
                    console.log(`[VIC] Topic change confirmed: ${newTopic}`);
                  }}
                  onReject={(currentTopic) => {
                    // Send rejection message to CopilotKit
                    appendMessage(new TextMessage({ content: "No, stay on the current topic", role: Role.User }));
                    setPendingTopicChange(null);
                    console.log(`[VIC] Topic change rejected, staying on: ${currentTopic}`);
                  }}
                />
              </div>
            )}

            {/* Rosie Voice - Secondary (announces articles found) */}
            {/* Only render if NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID is set */}
            {process.env.NEXT_PUBLIC_HUME_ROSIE_CONFIG_ID && (
              <div className="absolute bottom-4 right-4">
                <RosieVoice
                  onMessage={handleVoiceMessage}
                  articlesToAnnounce={rosieArticles}
                  onSpeakComplete={() => {
                    // Clear after Rosie speaks
                    setRosieArticles(null);
                  }}
                />
              </div>
            )}
          </div>

          {/* Quick Topics - clean pills */}
          <div className="w-full max-w-lg mx-auto">
            <div className="flex flex-wrap justify-center gap-2">
              {['Thorney Island', 'Royal Aquarium', 'Victorian Era', 'Hidden Rivers', 'Roman London'].map((topic) => (
                <TopicButton key={topic} topic={topic} onClick={handleTopicClick} />
              ))}
            </div>
          </div>
        </div>

        {/* Sticky bottom bar - Tap to speak CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#f4ead5] border-t border-amber-200 py-3 px-4 text-center shadow-lg">
          <p className="text-[#2a231a] font-medium text-sm">
            Tap VIC to speak about London&apos;s hidden history
          </p>
        </div>
      </section>

      {/* Stats - hidden on mobile for cleaner look */}
      <section className="hidden md:block border-y border-gray-200 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">372</p>
              <p className="text-xs text-gray-500">Articles</p>
            </div>
            <div>
              <p className="text-2xl font-bold">2,000</p>
              <p className="text-xs text-gray-500">Years</p>
            </div>
            <div>
              <p className="text-2xl font-bold">56</p>
              <p className="text-xs text-gray-500">Chapters</p>
            </div>
          </div>
        </div>
      </section>

      {/* Articles Section - browse all articles */}
      <ArticlesSection
        onArticleClick={(article) => {
          const message = `Tell me about ${article.title}`;
          appendMessage(new TextMessage({ content: message, role: Role.User }));
        }}
      />

      {/* About */}
      <section className="py-8 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm">
            372 articles by Vic Keegan. Original content from{' '}
            <a href="https://www.londonmylondon.co.uk" className="underline">londonmylondon.co.uk</a>
          </p>
        </div>
      </section>
    </div>
  );

  return (
    <BackgroundContext.Provider value={backgroundContextValue}>
    <ChatUserContext.Provider value={chatUserContextValue}>
      <div style={copilotStyles}>
        {isMobile ? (
          // Mobile: Floating popup button in corner, main content visible
          <>
            {MainContent}
            <CopilotPopup
              {...copilotProps}
              className="copilotkit-popup-mobile"
            />
          </>
        ) : (
          // Desktop: Sidebar layout
          <CopilotSidebar
            {...copilotProps}
            defaultOpen={true}
            clickOutsideToClose={false}
            className="border-l border-stone-200"
          >
            {MainContent}
          </CopilotSidebar>
        )}
      </div>
    </ChatUserContext.Provider>
    {/* Debug panel - toggle with button in bottom-right */}
    <DebugPanel userId={user?.id} />
    </BackgroundContext.Provider>
  );
}
