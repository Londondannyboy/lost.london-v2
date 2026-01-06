"use client";

import { ArticleCard } from "./ArticleCard";

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
}

export function ArticleGrid({ articles, query }: ArticleGridProps) {
  if (!articles || articles.length === 0) {
    return (
      <div className="p-4 bg-stone-100 rounded-lg text-stone-600 text-center">
        No articles found for this topic.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {query && (
        <div className="text-sm text-stone-500 mb-2">
          Found {articles.length} article{articles.length !== 1 ? 's' : ''} about "{query}"
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article) => (
          <ArticleCard
            key={article.id}
            id={article.id}
            title={article.title}
            excerpt={article.excerpt}
            hero_image_url={article.hero_image_url}
            slug={article.id}
            score={article.score}
          />
        ))}
      </div>
    </div>
  );
}
