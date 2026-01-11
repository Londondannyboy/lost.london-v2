"use client";

import { useState, useCallback } from "react";

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
  onClick?: () => void;  // Handler to trigger VIC conversation
}

/**
 * Stunning ArticleCard with full-bleed image background
 * Image fills the entire card with text overlaid via gradient
 */
export function ArticleCard({
  title,
  excerpt,
  hero_image_url,
  slug,
  location,
  date_range,
  index = 0,
  onClick,
}: ArticleCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Safe handlers - defer state updates to avoid React #185 error
  const handleImageLoad = useCallback(() => {
    // Use setTimeout to avoid "Cannot update during render" error
    setTimeout(() => setImageLoaded(true), 0);
  }, []);
  const handleImageError = useCallback(() => {
    setTimeout(() => setImageError(true), 0);
  }, []);

  // Beautiful fallback gradients when no image
  const gradients = [
    "from-amber-800 via-amber-900 to-stone-900",
    "from-stone-700 via-amber-800 to-stone-900",
    "from-amber-700 via-stone-800 to-amber-900",
    "from-stone-800 via-amber-700 to-stone-800",
  ];
  const gradientClass = gradients[index % gradients.length];

  const hasImage = hero_image_url && !imageError;

  // If onClick is provided, card triggers VIC conversation; otherwise link to lost.london
  const CardWrapper = onClick ? 'button' : 'a';
  const cardProps = onClick
    ? { onClick, type: 'button' as const }
    : { href: `https://lost.london/${slug}`, target: '_blank', rel: 'noopener noreferrer' };

  return (
    <CardWrapper
      {...cardProps}
      className="block relative rounded-xl overflow-hidden group cursor-pointer h-48 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] w-full text-left"
    >
      {/* Background - Full-bleed image or gradient */}
      <div className="absolute inset-0">
        {hasImage ? (
          <>
            {/* Loading placeholder */}
            {!imageLoaded && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} animate-pulse`} />
            )}
            {/* The actual image */}
            <img
              src={hero_image_url}
              alt=""
              className={`
                absolute inset-0 w-full h-full object-cover
                transition-all duration-700 group-hover:scale-105
                ${imageLoaded ? "opacity-100" : "opacity-0"}
              `}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          </>
        ) : (
          /* Fallback gradient background */
          <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        )}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Subtle vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.3)_100%)]" />
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl shadow-[inset_0_0_30px_rgba(217,119,6,0.3)]" />

      {/* Content overlay */}
      <div className="absolute inset-0 p-4 flex flex-col justify-end">
        {/* Era/Location badges - top */}
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap">
          {date_range && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full shadow-lg">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              {date_range}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full border border-white/30">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              {location}
            </span>
          )}
        </div>

        {/* Title & excerpt - bottom */}
        <div>
          <h3 className="font-bold text-white text-lg leading-tight mb-1 line-clamp-2 drop-shadow-lg group-hover:text-amber-200 transition-colors">
            {title}
          </h3>
          <p className="text-white/80 text-sm line-clamp-2 leading-relaxed drop-shadow">
            {excerpt}
          </p>
        </div>

        {/* Action indicator - appears on hover */}
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-lg">
            {onClick ? 'Ask VIC' : 'Read'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        {/* External link - only when onClick is provided (so user can still read full article) */}
        {onClick && (
          <a
            href={`https://lost.london/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors"
            title="Read full article on lost.london"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>
    </CardWrapper>
  );
}

/**
 * Compact ArticleCard for inline mentions (smaller version)
 */
export function ArticleCardCompact({
  title,
  excerpt,
  hero_image_url,
  slug,
}: Pick<ArticleCardProps, "title" | "excerpt" | "hero_image_url" | "slug">) {
  const [imageLoaded, setImageLoaded] = useState(false);

  // Safe handler to avoid React #185 error
  const handleLoad = useCallback(() => {
    setTimeout(() => setImageLoaded(true), 0);
  }, []);

  return (
    <a
      href={`https://lost.london/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block relative rounded-lg overflow-hidden group h-24 shadow-md hover:shadow-lg transition-all"
    >
      {/* Background */}
      <div className="absolute inset-0">
        {hero_image_url ? (
          <img
            src={hero_image_url}
            alt=""
            className={`w-full h-full object-cover transition-opacity ${imageLoaded ? "opacity-100" : "opacity-0"}`}
            onLoad={handleLoad}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-700 to-stone-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-3 flex flex-col justify-end">
        <h4 className="font-semibold text-white text-sm line-clamp-1 drop-shadow group-hover:text-amber-200 transition-colors">
          {title}
        </h4>
        <p className="text-white/70 text-xs line-clamp-1 mt-0.5">{excerpt}</p>
      </div>
    </a>
  );
}
