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
  slug?: string;  // URL slug for lost.london links
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
  onTimelineEventClick?: (event: TimelineEvent) => void;
  onArticleClick?: (article: Article) => void;
}

/**
 * TopicContext - Shows ALL research results prominently: image, timeline, map, articles
 * Used by Rosie to present complete research results - everything visible at once
 */
export function TopicContext({
  query,
  brief,
  articles,
  location,
  era,
  timeline_events,
  hero_image,
  onTimelineEventClick,
  onArticleClick,
}: TopicContextProps) {
  const [showAllArticles, setShowAllArticles] = useState(false);

  const hasArticles = articles && articles.length > 0;
  const hasMap = location && location.lat && location.lng;
  const hasTimeline = timeline_events && timeline_events.length > 0;
  const timelineEra = era || "London History";

  // Debug only once on mount (not on every render)
  // console.log('[TopicContext] Data:', { query, hasMap, hasTimeline, era });

  return (
    <div className="space-y-4">
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

      {/* TIMELINE - Show immediately if available */}
      {hasTimeline && timeline_events && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">{timelineEra}</span>
          </div>
          <Timeline era={timelineEra} events={timeline_events} onEventClick={onTimelineEventClick} />
        </div>
      )}

      {/* MAP - Show immediately if available */}
      {hasMap && location && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-3 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-semibold text-blue-800">{location.name}</span>
          </div>
          <LocationMap location={location} />
        </div>
      )}

      {/* ARTICLES - Show first article prominently, rest collapsible */}
      {hasArticles && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
            </svg>
            <span className="text-sm font-semibold text-stone-700">Related Articles ({articles.length})</span>
          </div>

          {/* First article always visible */}
          <ArticleCard
            key={articles[0].id}
            id={articles[0].id}
            title={articles[0].title}
            excerpt={articles[0].excerpt}
            hero_image_url={articles[0].hero_image_url}
            slug={articles[0].slug || articles[0].id}
            score={articles[0].score}
            location={articles[0].location?.name}
            date_range={articles[0].era || undefined}
            index={0}
            onClick={onArticleClick ? () => onArticleClick(articles[0]) : undefined}
          />

          {/* More articles - collapsible */}
          {articles.length > 1 && (
            <>
              {showAllArticles && articles.slice(1).map((article, index) => (
                <ArticleCard
                  key={article.id}
                  id={article.id}
                  title={article.title}
                  excerpt={article.excerpt}
                  hero_image_url={article.hero_image_url}
                  slug={article.slug || article.id}
                  score={article.score}
                  location={article.location?.name}
                  date_range={article.era || undefined}
                  index={index + 1}
                  onClick={onArticleClick ? () => onArticleClick(article) : undefined}
                />
              ))}
              <button
                onClick={() => setShowAllArticles(!showAllArticles)}
                className="w-full py-2 text-sm text-amber-700 hover:text-amber-800 font-medium transition-colors"
              >
                {showAllArticles ? `Show less` : `Show ${articles.length - 1} more articles`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
