"use client";

import { CopilotSidebar } from "@copilotkit/react-ui";
import { useRenderToolCall, useCopilotChat } from "@copilotkit/react-core";
import { Role, TextMessage } from "@copilotkit/runtime-client-gql";
import { VoiceInput } from "@/components/voice-input";
import { ArticleGrid } from "@/components/generative-ui/ArticleGrid";
import { ArticleCard } from "@/components/generative-ui/ArticleCard";
import { LocationMap } from "@/components/generative-ui/LocationMap";
import { Timeline } from "@/components/generative-ui/Timeline";
import { useCallback } from "react";

function TopicCard({ title, description, prompt }: { title: string; description: string; prompt: string }) {
  const { appendMessage } = useCopilotChat();

  const handleClick = () => {
    appendMessage(new TextMessage({ content: prompt, role: Role.User }));
  };

  return (
    <button
      onClick={handleClick}
      className="text-left p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow border border-stone-200 hover:border-amber-300"
    >
      <h3 className="font-semibold text-lg text-stone-800 mb-2">{title}</h3>
      <p className="text-stone-600 text-sm">{description}</p>
      <span className="mt-3 inline-block text-amber-600 text-sm font-medium">
        Ask VIC about this →
      </span>
    </button>
  );
}

export default function Home() {
  const { appendMessage } = useCopilotChat();

  const handleVoiceMessage = useCallback((text: string, role?: "user" | "assistant") => {
    if (role === "user") {
      appendMessage(new TextMessage({ content: text, role: Role.User }));
    }
  }, [appendMessage]);

  useRenderToolCall({
    name: "search_lost_london",
    render: ({ result }) => {
      if (!result?.found) {
        return <div className="p-4 text-stone-500">{result?.message || "No results found"}</div>;
      }
      return <ArticleGrid articles={result.articles} query={result.query} />;
    },
  });

  useRenderToolCall({
    name: "show_article_card",
    render: ({ result }) => {
      if (!result?.found || !result?.card) {
        return <div className="p-4 text-stone-500">{result?.message || "Article not found"}</div>;
      }
      return <ArticleCard {...result.card} />;
    },
  });

  useRenderToolCall({
    name: "show_map",
    render: ({ result }) => {
      if (!result?.found || !result?.location) {
        return <div className="p-4 text-stone-500">{result?.message || "Location not found"}</div>;
      }
      return <LocationMap location={result.location} />;
    },
  });

  useRenderToolCall({
    name: "show_timeline",
    render: ({ result }) => {
      if (!result?.found || !result?.events) {
        return <div className="p-4 text-stone-500">{result?.message || "No timeline available"}</div>;
      }
      return <Timeline era={result.era} events={result.events} />;
    },
  });

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[60vh] flex items-center justify-center bg-[#1a1612]">
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-stone-800 to-stone-900" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 text-[#f4ead5]">
            Lost London
          </h1>
          <p className="text-xl md:text-2xl text-[#d4c4a8] mb-12 max-w-2xl mx-auto">
            AI-powered voice guide to 370+ stories of hidden history
          </p>

          <div className="flex flex-col items-center gap-4">
            <VoiceInput onMessage={handleVoiceMessage} />
            <span className="text-stone-400 text-sm">
              Click to talk to VIC, or use the chat sidebar
            </span>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold">370+</p>
              <p className="text-sm text-gray-500 mt-1">Articles</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold">2,000</p>
              <p className="text-sm text-gray-500 mt-1">Years of History</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-bold">56</p>
              <p className="text-sm text-gray-500 mt-1">Book Chapters</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Topics */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-stone-800 mb-8">
            Popular Topics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TopicCard
              title="The Royal Aquarium"
              description="A Victorian entertainment palace in Westminster that featured everything from trapeze artists to a rollercoaster."
              prompt="Tell me about the Royal Aquarium"
            />
            <TopicCard
              title="Thorney Island"
              description="The ancient isle where Westminster Abbey now stands - once a marshy haven for brambles and outlaws."
              prompt="What is Thorney Island?"
            />
            <TopicCard
              title="Tyburn"
              description="London's most notorious execution site, where crowds gathered for 600 years to watch public hangings."
              prompt="Tell me about Tyburn"
            />
            <TopicCard
              title="Crystal Palace"
              description="The magnificent glass structure that rose in Hyde Park for the Great Exhibition of 1851."
              prompt="What happened to Crystal Palace?"
            />
            <TopicCard
              title="Fleet Street"
              description="The birthplace of British journalism and home to newspapers for over 400 years."
              prompt="Tell me about Fleet Street's history"
            />
            <TopicCard
              title="Devil's Acre"
              description="A notorious Victorian slum in the shadow of Westminster Abbey, home to London's poorest."
              prompt="What was Devil's Acre?"
            />
          </div>
        </div>
      </section>

      {/* CopilotKit Sidebar */}
      <CopilotSidebar
        defaultOpen={false}
        instructions="You are VIC, a warm London historian. Help users explore London's hidden history."
        labels={{
          title: "Talk to VIC",
          initial: "Hello! I'm Vic Keegan, and I've spent years uncovering London's hidden stories. What would you like to explore?",
        }}
        className="border-l border-stone-200"
      />
    </>
  );
}
