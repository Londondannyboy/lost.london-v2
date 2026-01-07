"use client";

import { useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { LocationMap } from "./LocationMap";
import { Timeline } from "./Timeline";

interface Article {
  id: string;
  title: string;
  excerpt: string;
  hero_image_url?: string | null;
  score?: number;
  location?: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
  } | null;
  era?: string | null;
}

interface TimelineEvent {
  year: number;
  title: string;
  description: string;
}

interface TopicContextProps {
  query: string;
  brief?: string;
  articles?: Article[];
  location?: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
  };
  era?: string;
  timeline_events?: TimelineEvent[];
  hero_image?: string;
}

/**
 * TopicContext - Comprehensive view showing articles, map, timeline, and image for a topic
 * Used by the Librarian to present complete research results
 */
export function TopicContext({
  query,
  brief,
  articles,
  location,
  era,
  timeline_events,
  hero_image,
}: TopicContextProps) {
  const [activeTab, setActiveTab] = useState<"articles" | "map" | "timeline">("articles");

  const hasArticles = articles && articles.length > 0;
  const hasMap = location && location.lat && location.lng;
  // Timeline needs events - era is optional (we'll use a default)
  const hasTimeline = timeline_events && timeline_events.length > 0;
  const timelineEra = era || "London History";

  // Available tabs based on what data we have
  const tabs = [
    { id: "articles", label: `Articles (${articles?.length || 0})`, available: hasArticles },
    { id: "map", label: "Map", available: hasMap },
    { id: "timeline", label: "Timeline", available: hasTimeline },
  ].filter((tab) => tab.available);

  return (
    <div className="space-y-3">
      {/* Hero image - stunning full-width with overlay */}
      {hero_image && (
        <div className="relative rounded-xl overflow-hidden shadow-lg">
          <img
            src={hero_image}
            alt={query}
            className="w-full h-44 object-cover"
          />
          {/* Multi-layer gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,rgba(0,0,0,0.2)_100%)]" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-xl drop-shadow-lg mb-1">{query}</h3>
            {brief && <p className="text-white/90 text-sm line-clamp-2 drop-shadow">{brief}</p>}
            {era && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-amber-500/90 text-white text-xs font-medium rounded-full">
                {era}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Brief summary - only show if no hero image */}
      {!hero_image && brief && (
        <div className="bg-gradient-to-r from-amber-50 to-stone-50 rounded-xl p-4 border border-amber-100">
          <h3 className="font-semibold text-stone-800 mb-1">{query}</h3>
          <p className="text-sm text-stone-600">{brief}</p>
        </div>
      )}

      {/* Tab navigation if we have multiple content types */}
      {tabs.length > 1 && (
        <div className="flex gap-1.5 border-b border-stone-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-500 text-white font-medium"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content based on active tab */}
      <div>
        {/* Articles */}
        {activeTab === "articles" && hasArticles && (
          <div className="space-y-3">
            {articles.map((article, index) => (
              <ArticleCard
                key={article.id}
                id={article.id}
                title={article.title}
                excerpt={article.excerpt}
                hero_image_url={article.hero_image_url}
                slug={article.id}
                score={article.score}
                location={article.location?.name}
                date_range={article.era || undefined}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Map */}
        {activeTab === "map" && hasMap && location && (
          <LocationMap location={location} />
        )}

        {/* Timeline - uses era or default */}
        {activeTab === "timeline" && hasTimeline && timeline_events && (
          <Timeline era={timelineEra} events={timeline_events} />
        )}
      </div>
    </div>
  );
}
