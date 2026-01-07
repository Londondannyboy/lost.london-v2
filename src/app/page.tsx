"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { useRenderToolCall, useCopilotChat, useCopilotReadable } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { VoiceInput } from "@/components/voice-input";
import { ArticleGrid } from "@/components/generative-ui/ArticleGrid";
import { ArticleCard } from "@/components/generative-ui/ArticleCard";
import { LocationMap } from "@/components/generative-ui/LocationMap";
import { Timeline } from "@/components/generative-ui/Timeline";
import { BookDisplay } from "@/components/generative-ui/BookDisplay";
import { useCallback, useEffect, useState } from "react";
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
      className="px-4 py-2 text-sm rounded-full transition-all duration-200 bg-white/10 text-white/80 hover:bg-[#f4ead5] hover:text-[#2a231a] hover:scale-105 cursor-pointer border border-white/20 hover:border-[#8b6914]"
    >
      {topic}
    </button>
  );
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

  // Provide user context to CopilotKit agent
  useCopilotReadable({
    description: "Current user information for personalization",
    value: {
      userId: user?.id || null,
      userName: userName || null,
      isReturningUser: userProfile.isReturningUser || false,
      recentInterests: userProfile.facts?.slice(0, 5) || [],
    },
  });

  // Handle voice messages - forward to CopilotKit and store to Zep
  // Voice → onMessage → appendMessage → Pydantic AI Agent → useRenderToolCall → Generative UI
  const handleVoiceMessage = useCallback((text: string, role?: "user" | "assistant") => {
    console.log(`[VIC] Voice ${role}: ${text.slice(0, 80)}...`);

    // Forward to CopilotKit - this triggers the agent which runs tools
    // Tool results render in the CopilotSidebar via useRenderToolCall
    const messageRole = role === "user" ? Role.User : Role.Assistant;
    appendMessage(new TextMessage({ content: text, role: messageRole }));

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

  // Build dynamic instructions with user context
  const instructions = `You are VIC (Vic Keegan), a warm London historian with 370+ articles. Help users explore London's hidden history.

## CURRENT USER CONTEXT
${userName ? `The user's name is "${userName}". Use their name occasionally (not every message).` : 'The user has not provided their name yet.'}
${userProfile.isReturningUser ? 'This is a RETURNING user - greet them warmly and reference past conversations.' : 'This may be a new user.'}
${userProfile.facts?.length ? `User's recent interests: ${userProfile.facts.slice(0, 3).join(', ')}` : ''}

## CRITICAL RULES
- NEVER say "I am a language model" or "I don't have access to personal information"
- You ARE Vic Keegan. Stay in character always.
- If asked "what is my name": ${userName ? `Answer "Your name is ${userName}!"` : 'Say "I don\'t believe you\'ve told me your name yet. What should I call you?"'}
- If asked about yourself: "I'm Vic Keegan, London historian and author of the Lost London books"
- ALWAYS use the search_lost_london tool when users ask about any London topic
- Use show_map for locations, show_timeline for eras, show_books when asked about your books`;

  // Build personalized initial message
  const initialMessage = userName
    ? `Hello ${userName}! I'm VIC, your guide to London's hidden history. Ask me about Thorney Island, the Royal Aquarium, Victorian London, or any corner of this ancient city. You can type here or tap the microphone below to speak.`
    : "Hello! I'm VIC, your guide to London's hidden history. Ask me about Thorney Island, the Royal Aquarium, Victorian London, or any corner of this ancient city. You can type here or tap the microphone below to speak.";

  return (
    <CopilotSidebar
      defaultOpen={true}
      clickOutsideToClose={false}
      instructions={instructions}
      labels={{
        title: "VIC - London Historian",
        initial: initialMessage,
      }}
      className="border-l border-stone-200"
    >
      {/* Main Content - Voice-First Hero */}
      <div className="bg-white text-black min-h-screen">
        {/* Hero Section */}
        <section className="relative min-h-[60vh] flex items-center justify-center bg-[#1a1612]">
          {/* Background */}
          <div className="absolute inset-0 z-0">
            <img
              src="/London Map with River.jpg"
              alt=""
              className="w-full h-full object-cover opacity-40"
              style={{ filter: 'sepia(30%) contrast(1.1)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#1a1612]/60 via-transparent to-[#1a1612]/80" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-[#f4ead5]">
              Lost London
            </h1>
            <p className="text-lg md:text-xl text-[#d4c4a8] mb-8 max-w-2xl mx-auto">
              AI-powered voice guide to 2,000 years of hidden history
            </p>

            {/* VIC Avatar + Voice */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden shadow-2xl border-4 border-[#f4ead5]/20">
                  <img
                    src="/vic-avatar.jpg"
                    alt="VIC - Your London History Guide"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-[#f4ead5] text-[#2a231a] text-xs px-3 py-1 rounded-full font-medium">
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

              <p className="text-[#d4c4a8]/60 text-xs mt-2">
                Voice synced with chat →
              </p>
            </div>

            {/* Topic Pills */}
            <div className="w-full max-w-md mx-auto">
              <p className="text-white/50 text-xs mb-2">Quick topics:</p>
              <div className="flex flex-wrap justify-center gap-2">
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
  );
}
