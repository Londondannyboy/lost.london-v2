"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { useRenderToolCall, useCopilotChat, useCoAgent } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { VoiceInput } from "@/components/voice-input";
import { ArticleGrid } from "@/components/generative-ui/ArticleGrid";
import { ArticleCard } from "@/components/generative-ui/ArticleCard";
import { LocationMap } from "@/components/generative-ui/LocationMap";
import { Timeline } from "@/components/generative-ui/Timeline";
import { BookDisplay } from "@/components/generative-ui/BookDisplay";
import { TopicContext } from "@/components/generative-ui/TopicContext";
import { LibrarianMessage, LibrarianThinking } from "@/components/LibrarianAvatar";
import { CustomUserMessage, ChatUserContext } from "@/components/ChatMessages";
import { useCallback, useEffect, useState, useRef } from "react";
import { authClient } from "@/lib/auth/client";

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

// Smart assistant message - shows Librarian UI when available, VIC text for greetings/questions
function SmartAssistantMessage({ message }: { message?: { generativeUI?: () => React.ReactNode; content?: string } }) {
  // Get generative UI from tools (Librarian's output)
  const generativeUI = message?.generativeUI?.();

  // Get VIC's text content
  const textContent = typeof message?.content === "string" ? message.content : "";

  // If there's tool UI (Librarian), show it
  if (generativeUI) {
    return (
      <div className="flex gap-3 mb-4">
        {/* Librarian Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
            <img
              src="/London Librarian Avatar 1.png"
              alt="London Librarian"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Message Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-amber-700">London Librarian</span>
          </div>
          <div className="bg-amber-50/50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-200">
            {generativeUI}
          </div>
        </div>
      </div>
    );
  }

  // If there's text but no tool UI, show VIC's response (for greetings, questions, etc.)
  if (textContent && textContent.length > 0) {
    return (
      <div className="flex gap-3 mb-4">
        {/* VIC Avatar */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
            <img
              src="/vic-avatar.jpg"
              alt="VIC"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Message Content */}
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

  // Nothing to show
  return null;
}

// Context for sharing background setter with render callbacks
import { createContext, useContext } from 'react';
const BackgroundContext = createContext<{ setBackground: (url: string | null) => void }>({ setBackground: () => {} });

// Component to set background when mounted (used in render callbacks)
function BackgroundUpdater({ imageUrl }: { imageUrl: string }) {
  const { setBackground } = useContext(BackgroundContext);
  useEffect(() => {
    if (imageUrl) {
      setBackground(imageUrl);
    }
  }, [imageUrl, setBackground]);
  return null;
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

export default function Home() {
  const { appendMessage } = useCopilotChat();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  // User profile state for Zep personalization
  const [userProfile, setUserProfile] = useState<{
    preferred_name?: string;
    isReturningUser?: boolean;
    facts?: string[];
  }>({});

  // Dynamic background based on current topic
  const [topicBackground, setTopicBackground] = useState<string | null>(null);

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

  // Sync logged-in user to agent state
  useEffect(() => {
    if (user?.id && !agentState?.user?.id) {
      const userInfo = {
        id: user.id,
        name: userName || user.name || 'Unknown',
        email: user.email || '',
      };
      setAgentState(prev => ({ ...prev, user: userInfo }));
      console.log('[VIC] User synced to agent state:', userInfo);
    }
  }, [user?.id, user?.name, user?.email, userName, agentState?.user?.id, setAgentState]);

  // Handle voice messages
  // IMPORTANT: Only forward USER messages to CopilotKit to trigger tools
  // VIC's VOICE responses should NOT be printed - voice IS the response
  // Librarian UI will appear via useRenderToolCall when tools run
  const handleVoiceMessage = useCallback((text: string, role?: "user" | "assistant") => {
    console.log(`[VIC] Voice ${role}: ${text.slice(0, 50)}...`);

    // Only forward USER messages to CopilotKit
    // This triggers the agent which runs tools -> Librarian UI appears
    // VIC's spoken response should NOT appear as text (ruins the magic)
    if (role === "user") {
      appendMessage(new TextMessage({ content: text, role: Role.User }));
    }
    // Note: VIC's voice response is handled by Hume - don't duplicate in chat

    // Store to Zep memory for returning user recognition
    if (user?.id) {
      storeToZep(user.id, text, role || "user", userProfile.preferred_name);
    }
  }, [appendMessage, user?.id, userProfile.preferred_name]);

  const handleTopicClick = useCallback((topic: string) => {
    const message = `Tell me about ${topic}`;
    appendMessage(new TextMessage({ content: message, role: Role.User }));

    // Store topic click to Zep
    if (user?.id) {
      storeToZep(user.id, message, "user", userProfile.preferred_name);
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

      // TopicContext is rendered directly (it includes its own Librarian header)
      if (uiComponent === "TopicContext") {
        return (
          <>
            {/* Update hero background when topic has an image */}
            {uiData?.hero_image && <BackgroundUpdater imageUrl={uiData.hero_image} />}
            <TopicContext
              query={uiData?.query || ""}
              brief={uiData?.brief}
              articles={uiData?.articles}
              location={uiData?.location}
              era={uiData?.era}
              timeline_events={uiData?.timeline_events}
              hero_image={uiData?.hero_image}
            />
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

## RULES FOR THIS USER
${userName ? `The user's name is "${userName}". Use their name occasionally (not every message).` : 'The user has not provided their name yet.'}
${userProfile.isReturningUser ? 'This is a RETURNING user - greet them warmly.' : ''}

## CRITICAL IDENTITY RULES
- NEVER say "I am a language model" or "I don't have access to personal information"
- You ARE Vic Keegan. Stay in character always.
- NEVER output code, tool names, function calls, or technical text - speak naturally
- If asked "what is my name": ${userName ? `Answer "You're ${userName}, of course!"` : 'Say "I don\'t believe you\'ve told me your name yet. What should I call you?"'}
- If asked about yourself: "I'm Vic Keegan, London historian and author of the Lost London books"

## LIBRARIAN DELEGATION
- Use delegate_to_librarian tool when users ask about places, topics, or want to see visual content
- For major searches, say "Let me check my archives..." BEFORE calling delegate_to_librarian
- For follow-up queries, just delegate silently
- The Librarian will find articles, maps, timelines - weave her findings into your narrative

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

## LIBRARIAN DELEGATION
- Use delegate_to_librarian tool when users ask about places, topics, or want to see visual content
- For major searches, say "Let me check my archives..." BEFORE calling delegate_to_librarian
- The Librarian will find articles, maps, timelines - weave her findings into your narrative

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

  // Background context value - memoized to prevent re-renders
  const backgroundContextValue = { setBackground: setTopicBackground };

  return (
    <BackgroundContext.Provider value={backgroundContextValue}>
    <ChatUserContext.Provider value={chatUserContextValue}>
      <CopilotSidebar
        defaultOpen={true}
        clickOutsideToClose={false}
        instructions={instructions}
        labels={{
          title: "London Librarian",
          initial: initialMessage,
        }}
        className="border-l border-stone-200"
        UserMessage={CustomUserMessage}
        AssistantMessage={SmartAssistantMessage}
      >
      {/* Main Content - Voice-First Hero */}
      <div className="bg-white text-black min-h-screen">
        {/* Hero Section - Full Screen */}
        <section className="relative min-h-screen flex items-center justify-center bg-[#1a1612]">
          {/* Background - Dynamic or default map */}
          <div className="absolute inset-0 z-0">
            <img
              src={topicBackground || "/London Map with River.jpg"}
              alt=""
              className="w-full h-full object-cover transition-all duration-1000"
              style={{ opacity: topicBackground ? 0.5 : 0.4, filter: 'sepia(30%) contrast(1.1)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a1612]/70 via-[#1a1612]/40 to-[#1a1612]/90" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 text-center">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 text-[#f4ead5]">
              Lost London
            </h1>
            <p className="text-xl md:text-2xl text-[#d4c4a8] mb-10 max-w-2xl mx-auto">
              AI-powered voice guide to 2,000 years of hidden history
            </p>

            {/* VIC Avatar + Voice */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <div className="w-36 h-36 md:w-44 md:h-44 rounded-full overflow-hidden shadow-2xl border-4 border-[#f4ead5]/30">
                  <img
                    src="/vic-avatar.jpg"
                    alt="VIC - Your London History Guide"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#f4ead5] text-[#2a231a] text-sm px-4 py-1.5 rounded-full font-semibold shadow-lg">
                  VIC
                </div>
              </div>

              {/* Voice Input - forwards to CopilotKit */}
              <VoiceInput
                onMessage={handleVoiceMessage}
                userId={user?.id}
                userName={userProfile.preferred_name || user?.name?.split(' ')[0] || user?.name}
                isReturningUser={userProfile.isReturningUser}
                userFacts={userProfile.facts}
              />

              <p className="text-[#d4c4a8]/70 text-sm mt-3">
                Tap to speak with VIC →
              </p>
            </div>

            {/* Topic Pills - White text */}
            <div className="w-full max-w-lg mx-auto">
              <p className="text-white/70 text-sm mb-3">Quick topics:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {['Thorney Island', 'Royal Aquarium', 'Victorian Era', 'Hidden Rivers', 'Roman London'].map((topic) => (
                  <TopicButton key={topic} topic={topic} onClick={handleTopicClick} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-gray-200 bg-gray-50">
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

        {/* Featured Book */}
        <section className="py-12 border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="md:w-1/3">
                <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-lg shadow-lg">
                  <img
                    src="/Thorney London's Forgotten book cover.jpg"
                    alt="Thorny Island"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="md:w-2/3">
                <span className="inline-block bg-black text-white text-xs px-3 py-1 mb-3 font-medium">
                  FEATURED
                </span>
                <h2 className="text-3xl font-bold mb-4">
                  Thorney: London's Forgotten Island
                </h2>
                <p className="text-gray-600 mb-4">
                  The hidden island beneath Westminster. Where Parliament, the Abbey, and the Supreme Court now stand was once an island formed by the River Tyburn.
                </p>
                <button
                  onClick={() => handleTopicClick('Thorney Island')}
                  className="bg-black text-white px-6 py-2 font-medium hover:bg-gray-800 transition-colors"
                >
                  Ask VIC about Thorney Island →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Books */}
        <section className="py-12 bg-gradient-to-b from-amber-50 to-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold mb-6 text-center">Own the Books</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <a href="https://www.waterstones.com/author/vic-keegan/4942784" target="_blank" rel="noopener noreferrer" className="group">
                <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-lg shadow group-hover:shadow-lg transition-shadow">
                  <img src="/lost-london-cover-1.jpg" alt="Lost London Volume 1" className="w-full h-full object-cover" />
                </div>
              </a>
              <a href="https://www.waterstones.com/author/vic-keegan/4942784" target="_blank" rel="noopener noreferrer" className="group">
                <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-lg shadow group-hover:shadow-lg transition-shadow">
                  <img src="/lost-london-cover-2.jpg" alt="Lost London Volume 2" className="w-full h-full object-cover" />
                </div>
              </a>
              <a href="https://shop.ingramspark.com/b/084?params=NwS1eOq0iGczj35Zm0gAawIEcssFFDCeMABwVB9c3gn" target="_blank" rel="noopener noreferrer" className="group">
                <div className="aspect-[3/4] overflow-hidden bg-gray-100 rounded-lg shadow group-hover:shadow-lg transition-shadow">
                  <img src="/Thorney London's Forgotten book cover.jpg" alt="Thorney" className="w-full h-full object-cover" />
                </div>
              </a>
            </div>
            <div className="text-center">
              <a href="https://www.waterstones.com/author/vic-keegan/4942784" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-amber-900 text-white px-6 py-3 rounded-lg hover:bg-amber-800 transition-colors font-medium">
                Buy at Waterstones →
              </a>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="py-12">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <p className="text-gray-600 text-sm">
              372 articles by Vic Keegan. Original content from{' '}
              <a href="https://www.londonmylondon.co.uk" className="underline">londonmylondon.co.uk</a>
            </p>
          </div>
        </section>
      </div>
      </CopilotSidebar>
    </ChatUserContext.Provider>
    </BackgroundContext.Provider>
  );
}
