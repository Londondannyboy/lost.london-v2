"use client";

import { useState } from "react";
import { ArticleCard } from "./ArticleCard";
import { LocationMap } from "./LocationMap";
import { Timeline } from "./Timeline";
import { LibrarianAvatar } from "../LibrarianAvatar";

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
  const hasTimeline = timeline_events && timeline_events.length > 0;

  // Available tabs based on what data we have
  const tabs = [
    { id: "articles", label: "Articles", available: hasArticles },
    { id: "map", label: "Map", available: hasMap },
    { id: "timeline", label: "Timeline", available: hasTimeline },
  ].filter((tab) => tab.available);

  return (
    <div className="space-y-4 my-4">
      {/* Librarian header */}
      <div className="flex items-start gap-3">
        <LibrarianAvatar speaking size="sm" showLabel />
        <div className="flex-1">
          <span className="text-sm text-amber-600 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            Research complete
          </span>
        </div>
      </div>

      {/* Brief summary */}
      {brief && (
        <p className="text-sm text-stone-600 pl-10 border-l-2 border-amber-200 italic">
          {brief}
        </p>
      )}

      {/* Hero image if available */}
      {hero_image && (
        <div className="ml-10 rounded-lg overflow-hidden border border-stone-200 shadow-sm">
          <img
            src={hero_image}
            alt={query}
            className="w-full h-48 object-cover"
          />
          <div className="p-2 bg-stone-50 text-xs text-stone-500 text-center">
            Historic image of {query}
          </div>
        </div>
      )}

      {/* Tab navigation if we have multiple content types */}
      {tabs.length > 1 && (
        <div className="flex gap-2 ml-10 border-b border-stone-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-1.5 text-sm rounded-full transition-colors ${
                activeTab === tab.id
                  ? "bg-amber-100 text-amber-800 font-medium"
                  : "text-stone-500 hover:bg-stone-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Content based on active tab */}
      <div className="ml-10">
        {/* Articles */}
        {activeTab === "articles" && hasArticles && (
          <div className="space-y-4">
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

        {/* Timeline */}
        {activeTab === "timeline" && hasTimeline && era && timeline_events && (
          <Timeline era={era} events={timeline_events} />
        )}
      </div>

      {/* Quick links to other content types */}
      {tabs.length > 1 && (
        <div className="ml-10 flex items-center gap-2 text-xs text-stone-400">
          <span>Also available:</span>
          {tabs
            .filter((tab) => tab.id !== activeTab)
            .map((tab, i) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className="underline hover:text-amber-600"
              >
                {tab.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
