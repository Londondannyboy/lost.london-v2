"use client";

import { ArticleCard } from "./ArticleCard";
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

interface ArticleGridProps {
  articles: Article[];
  query?: string;
  brief?: string;
}

export function ArticleGrid({ articles, query, brief }: ArticleGridProps) {
  if (!articles || articles.length === 0) {
    return (
      <div className="p-4 bg-stone-100 rounded-lg text-stone-600 text-center">
        No articles found for this topic.
      </div>
    );
  }

  return (
    <div className="space-y-4 my-4">
      {/* Librarian header */}
      <div className="flex items-center gap-3">
        <LibrarianAvatar speaking size="sm" showLabel />
        <div className="flex-1">
          {query && (
            <span className="text-sm text-amber-600 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              Found {articles.length} article{articles.length !== 1 ? 's' : ''} about "{query}"
            </span>
          )}
        </div>
      </div>

      {/* Brief from Librarian */}
      {brief && (
        <p className="text-sm text-stone-600 italic pl-10 border-l-2 border-amber-200">
          {brief}
        </p>
      )}

      {/* Article cards - stack vertically for better readability in chat */}
      <div className="space-y-4 pl-10">
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
    </div>
  );
}
