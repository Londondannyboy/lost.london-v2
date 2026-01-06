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
import Link from "next/link";

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

export default function Home() {
  const { appendMessage } = useCopilotChat();

  const handleVoiceMessage = useCallback((text: string, role?: "user" | "assistant") => {
    if (role === "user") {
      appendMessage(new TextMessage({ content: text, role: Role.User }));
    }
  }, [appendMessage]);

  const handleTopicClick = useCallback((topic: string) => {
    appendMessage(new TextMessage({ content: `Tell me about ${topic}`, role: Role.User }));
  }, [appendMessage]);

  useRenderToolCall({
    name: "search_lost_london",
    render: ({ result }) => {
      if (!result?.found) return <div className="p-4 text-stone-500">{result?.message || "No results found"}</div>;
      return <ArticleGrid articles={result.articles} query={result.query} />;
    },
  });

  useRenderToolCall({
    name: "show_article_card",
    render: ({ result }) => {
      if (!result?.found || !result?.card) return <div className="p-4 text-stone-500">{result?.message || "Article not found"}</div>;
      return <ArticleCard {...result.card} />;
    },
  });

  useRenderToolCall({
    name: "show_map",
    render: ({ result }) => {
      if (!result?.found || !result?.location) return <div className="p-4 text-stone-500">{result?.message || "Location not found"}</div>;
      return <LocationMap location={result.location} />;
    },
  });

  useRenderToolCall({
    name: "show_timeline",
    render: ({ result }) => {
      if (!result?.found || !result?.events) return <div className="p-4 text-stone-500">{result?.message || "No timeline available"}</div>;
      return <Timeline era={result.era} events={result.events} />;
    },
  });

  return (
    <div className="bg-white text-black">
      {/* Hero Section - Voice First */}
      <section className="relative min-h-[80vh] flex items-center justify-center bg-[#1a1612]">
        {/* Dark River Map Background */}
        <div className="absolute inset-0 z-0">
          <img
            src="/London Map with River.jpg"
            alt=""
            className="w-full h-full object-cover opacity-40"
            style={{ filter: 'sepia(30%) contrast(1.1)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1612]/60 via-transparent to-[#1a1612]/80" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 py-16 text-center">
          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4 text-[#f4ead5]">
            Lost London
          </h1>
          <p className="text-xl md:text-2xl text-[#d4c4a8] mb-12 max-w-2xl mx-auto">
            AI-powered voice guide to 2,000 years of hidden history
          </p>

          {/* VIC Avatar + Voice Input */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-6">
              <div className="w-48 h-48 md:w-56 md:h-56 rounded-full overflow-hidden shadow-2xl border-4 border-[#f4ead5]/20">
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

            <VoiceInput onMessage={handleVoiceMessage} />

            <p className="text-[#d4c4a8] text-sm mt-4">
              Click to speak, or use the chat sidebar
            </p>
          </div>

          {/* Topic Pills */}
          <div className="text-center w-full max-w-lg mx-auto">
            <p className="text-white/60 text-sm mb-3">Tap a topic to explore:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Thorney Island', 'Shakespeare', 'Medieval London', 'Tudor History', 'Hidden Rivers', 'Roman London', 'Victorian Era'].map((topic) => (
                <TopicButton key={topic} topic={topic} onClick={handleTopicClick} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold">372</p>
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

      {/* Featured Book - Thorny Island */}
      <section className="py-16 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="md:w-1/3">
              <div className="aspect-[3/4] overflow-hidden bg-gray-100">
                <img
                  src="/Thorney London's Forgotten book cover.jpg"
                  alt="Thorny Island"
                  className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-500"
                />
              </div>
            </div>
            <div className="md:w-2/3">
              <span className="inline-block bg-black text-white text-xs px-3 py-1 mb-4 font-medium tracking-wide">
                FEATURED
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Thorney: London's Forgotten Island
              </h2>
              <p className="text-lg text-gray-600 leading-relaxed mb-6">
                The hidden island beneath Westminster. Where Parliament, the Abbey, and the Supreme Court now stand was once an island formed by the River Tyburn and the Thames.
              </p>
              <p className="text-gray-500 mb-8">
                56 chapters covering the River Tyburn, the Devil's Acre, William Caxton, and centuries of hidden history.
              </p>
              <button
                onClick={() => handleTopicClick('Thorney Island')}
                className="inline-block bg-black text-white px-8 py-3 font-medium hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Ask VIC about Thorney Island →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Browse by Series */}
      <section className="py-16 border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">Browse by Series</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            <button
              onClick={() => handleTopicClick('Lost London stories')}
              className="bg-white border border-gray-200 p-6 hover:border-black hover:shadow-md transition-all group text-left cursor-pointer"
            >
              <h3 className="font-bold text-lg mb-2 group-hover:underline">Lost London</h3>
              <p className="text-sm text-gray-500 mb-3">232 articles</p>
              <p className="text-sm text-gray-600">The complete Vic Keegan archive of hidden London stories.</p>
            </button>
            <button
              onClick={() => handleTopicClick("Shakespeare's London")}
              className="bg-white border border-gray-200 p-6 hover:border-black hover:shadow-md transition-all group text-left cursor-pointer"
            >
              <h3 className="font-bold text-lg mb-2 group-hover:underline">Shakespeare's London</h3>
              <p className="text-sm text-gray-500 mb-3">9 articles</p>
              <p className="text-sm text-gray-600">Theatres, taverns, and tales from the Bard's city.</p>
            </button>
            <button
              onClick={() => handleTopicClick('River Thames history')}
              className="bg-white border border-gray-200 p-6 hover:border-black hover:shadow-md transition-all group text-left cursor-pointer"
            >
              <h3 className="font-bold text-lg mb-2 group-hover:underline">River Thames</h3>
              <p className="text-sm text-gray-500 mb-3">7 articles</p>
              <p className="text-sm text-gray-600">London's artery through the ages.</p>
            </button>
            <button
              onClick={() => handleTopicClick('Hidden Rivers of London')}
              className="bg-white border border-gray-200 p-6 hover:border-black hover:shadow-md transition-all group text-left cursor-pointer"
            >
              <h3 className="font-bold text-lg mb-2 group-hover:underline">Hidden Rivers</h3>
              <p className="text-sm text-gray-500 mb-3">5 articles</p>
              <p className="text-sm text-gray-600">The buried waterways beneath London's streets.</p>
            </button>
          </div>
        </div>
      </section>

      {/* Popular Topics Grid */}
      <section className="py-16 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold">Popular Topics</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'The Royal Aquarium', desc: 'A Victorian entertainment palace in Westminster with trapeze artists and a rollercoaster.' },
              { title: 'Tyburn', desc: "London's most notorious execution site, where crowds gathered for 600 years." },
              { title: 'Crystal Palace', desc: 'The magnificent glass structure from the Great Exhibition of 1851.' },
              { title: 'Fleet Street', desc: 'The birthplace of British journalism for over 400 years.' },
              { title: "Devil's Acre", desc: 'A notorious Victorian slum in the shadow of Westminster Abbey.' },
              { title: 'Roman London', desc: 'Londinium: the ancient walled city founded by the Romans in 43 AD.' },
            ].map((topic) => (
              <button
                key={topic.title}
                onClick={() => handleTopicClick(topic.title)}
                className="group bg-white border border-gray-200 p-6 hover:border-black hover:shadow-md transition-all text-left cursor-pointer"
              >
                <h3 className="font-bold text-lg mb-2 group-hover:underline">{topic.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{topic.desc}</p>
                <span className="text-sm text-amber-600 font-medium">Ask VIC about this →</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Books Grid */}
      <section className="py-16 border-b border-gray-200 bg-gradient-to-b from-amber-50 to-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">Own the Books</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Take London's hidden history home. Vic Keegan's Lost London series is available at Waterstones and IngramSpark.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <a
              href="https://www.waterstones.com/author/vic-keegan/4942784"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="aspect-[3/4] overflow-hidden bg-gray-100 mb-3 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
                <img
                  src="/lost-london-cover-1.jpg"
                  alt="Lost London Volume 1"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <p className="text-sm font-medium group-hover:underline">Volume 1</p>
            </a>
            <a
              href="https://www.waterstones.com/author/vic-keegan/4942784"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="aspect-[3/4] overflow-hidden bg-gray-100 mb-3 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
                <img
                  src="/lost-london-cover-2.jpg"
                  alt="Lost London Volume 2"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <p className="text-sm font-medium group-hover:underline">Volume 2</p>
            </a>
            <a
              href="https://shop.ingramspark.com/b/084?params=NwS1eOq0iGczj35Zm0gAawIEcssFFDCeMABwVB9c3gn"
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="aspect-[3/4] overflow-hidden bg-gray-100 mb-3 rounded-lg shadow-lg group-hover:shadow-xl transition-shadow">
                <img
                  src="/Thorney London's Forgotten book cover.jpg"
                  alt="Thorney: London's Forgotten Island"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <p className="text-sm font-medium group-hover:underline">Thorney</p>
            </a>
          </div>
          <div className="text-center">
            <a
              href="https://www.waterstones.com/author/vic-keegan/4942784"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-amber-900 text-white px-8 py-4 rounded-lg hover:bg-amber-800 transition-colors font-bold text-lg"
            >
              <span>Buy at Waterstones</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-6">About</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            372 articles by Vic Keegan exploring London's hidden corners. From Shakespeare's lost theatres to the source of the Thames — VIC is your voice-powered guide to discovering London like never before.
          </p>
          <p className="text-sm text-gray-400">
            Original articles from{' '}
            <a href="https://www.londonmylondon.co.uk" className="underline hover:text-black">londonmylondon.co.uk</a>
            {' '}and{' '}
            <a href="https://www.onlondon.co.uk" className="underline hover:text-black">onlondon.co.uk</a>
          </p>
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
    </div>
  );
}
