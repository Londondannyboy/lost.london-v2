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
 * Clean ArticleCard with white background and readable typography
 * Full-width layout for better readability in chat sidebar
 */
export function ArticleCard({
  title,
  excerpt,
  hero_image_url,
  slug,
  score,
  location,
  date_range,
}: ArticleCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <a
      href={`https://lost.london/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block bg-white rounded-lg border border-stone-200 overflow-hidden hover:border-amber-400 hover:shadow-md transition-all group"
    >
      {/* Image - horizontal layout with image on left */}
      <div className="flex">
        {/* Image thumbnail */}
        {hero_image_url && !imageError ? (
          <div className="w-24 h-24 flex-shrink-0 bg-stone-100">
            {!imageLoaded && (
              <div className="w-full h-full bg-gradient-to-br from-amber-100 to-stone-100 animate-pulse" />
            )}
            <img
              src={hero_image_url}
              alt=""
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-24 h-24 flex-shrink-0 bg-gradient-to-br from-amber-50 to-stone-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-3 min-w-0">
          {/* Title */}
          <h3 className="font-semibold text-stone-800 text-sm leading-tight mb-1 line-clamp-2 group-hover:text-amber-700 transition-colors">
            {title}
          </h3>

          {/* Metadata badges */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {location && (
              <span className="inline-flex items-center gap-0.5 text-xs text-stone-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {location}
              </span>
            )}
            {date_range && (
              <span className="inline-flex items-center gap-0.5 text-xs text-stone-500">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {date_range}
              </span>
            )}
            {score && score > 0 && (
              <span className="text-[10px] text-stone-400 ml-auto">
                {(score * 100).toFixed(0)}%
              </span>
            )}
          </div>

          {/* Excerpt */}
          <p className="text-stone-600 text-xs line-clamp-2 leading-relaxed">
            {excerpt}
          </p>
        </div>
      </div>
    </a>
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
