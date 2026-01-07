"use client";

import { useState } from "react";

interface ArticleCardProps {
  id: string;
  title: string;
  excerpt: string;
  hero_image_url?: string | null;
  slug: string;
  score?: number;
  location?: string;
  date_range?: string;
  index?: number;
}

/**
 * Beautiful ArticleCard with image, hover effects, and rich metadata
 * Inspired by esportsjobs.quest-v2 AnimatedJobCard
 */
export function ArticleCard({
  title,
  excerpt,
  hero_image_url,
  slug,
  score,
  location,
  date_range,
  index = 0,
}: ArticleCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Fallback gradient backgrounds for articles without images
  const gradients = [
    "from-amber-900 via-amber-800 to-stone-900",
    "from-stone-800 via-amber-900 to-stone-900",
    "from-amber-800 via-stone-800 to-amber-900",
    "from-stone-900 via-amber-800 to-stone-800",
  ];
  const gradientClass = gradients[index % gradients.length];

  return (
    <div
      className={`
        relative overflow-hidden rounded-xl group cursor-pointer
        transform transition-all duration-300
        ${isHovered ? "scale-[1.02] shadow-xl" : "shadow-lg"}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background - Image or Gradient */}
      <div className="absolute inset-0 bg-stone-900">
        {hero_image_url && !imageError ? (
          <>
            {/* Placeholder while loading */}
            {!imageLoaded && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} animate-pulse`} />
            )}
            <img
              src={hero_image_url}
              alt=""
              className={`
                absolute inset-0 w-full h-full object-cover
                transition-opacity duration-500
                ${imageLoaded ? "opacity-100" : "opacity-0"}
              `}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        )}

        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
      </div>

      {/* Animated border glow on hover */}
      <div
        className={`
          absolute inset-0 rounded-xl transition-all duration-300
          ${isHovered ? "shadow-[0_0_20px_rgba(217,119,6,0.4),inset_0_0_15px_rgba(217,119,6,0.2)]" : ""}
        `}
      />

      {/* Border */}
      <div
        className={`
          absolute inset-0 rounded-xl border-2 transition-colors duration-300
          ${isHovered ? "border-amber-500" : "border-stone-700/50"}
        `}
      />

      {/* Content */}
      <div className="relative z-10 p-5 min-h-[200px] flex flex-col">
        {/* Metadata row */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {/* Location badge */}
          {location && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {location}
            </span>
          )}

          {/* Date range badge */}
          {date_range && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-500/20 text-stone-300 text-xs rounded-full border border-stone-500/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {date_range}
            </span>
          )}

          {/* Relevance score */}
          {score && score > 0 && (
            <span className="ml-auto px-2 py-0.5 bg-black/40 rounded text-[10px] font-mono text-stone-400">
              {(score * 100).toFixed(0)}% match
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-amber-300 transition-colors">
          {title}
        </h3>

        {/* Excerpt */}
        <p className="text-stone-300 text-sm line-clamp-3 flex-1">
          {excerpt}
        </p>

        {/* Read article button - appears on hover */}
        <a
          href={`https://lost.london/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            mt-4 inline-flex items-center gap-2 px-4 py-2
            bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm
            rounded-lg shadow-lg shadow-amber-600/30
            transform transition-all duration-300
            ${isHovered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Read Full Article
        </a>
      </div>
    </div>
  );
}

/**
 * Compact ArticleCard for inline mentions
 */
export function ArticleCardCompact({
  title,
  excerpt,
  hero_image_url,
  slug,
}: Pick<ArticleCardProps, "title" | "excerpt" | "hero_image_url" | "slug">) {
  return (
    <a
      href={`https://lost.london/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-3 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200 group"
    >
      {hero_image_url && (
        <img
          src={hero_image_url}
          alt=""
          className="w-16 h-16 rounded-md object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-stone-800 text-sm line-clamp-1 group-hover:text-amber-700 transition-colors">
          {title}
        </h4>
        <p className="text-stone-500 text-xs line-clamp-2 mt-1">{excerpt}</p>
      </div>
      <svg className="w-4 h-4 text-stone-400 group-hover:text-amber-600 flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  );
}
