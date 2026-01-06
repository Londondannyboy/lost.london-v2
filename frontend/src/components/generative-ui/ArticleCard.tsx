"use client";

interface ArticleCardProps {
  id: string;
  title: string;
  excerpt: string;
  hero_image_url?: string | null;
  slug: string;
  score?: number;
}

export function ArticleCard({ title, excerpt, hero_image_url, slug, score }: ArticleCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border border-stone-200">
      {hero_image_url && (
        <div className="h-40 overflow-hidden">
          <img
            src={hero_image_url}
            alt={title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold text-lg text-stone-800 mb-2 line-clamp-2">{title}</h3>
        <p className="text-stone-600 text-sm line-clamp-3">{excerpt}</p>
        {score && (
          <div className="mt-2 text-xs text-stone-400">
            Relevance: {(score * 100).toFixed(0)}%
          </div>
        )}
        <a
          href={`https://lost.london/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-amber-600 hover:text-amber-700 text-sm font-medium"
        >
          Read full article →
        </a>
      </div>
    </div>
  );
}
