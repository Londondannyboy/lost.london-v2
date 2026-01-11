"use client";

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
  onClick?: () => void;
}

/**
 * ArticleCard with full-bleed image background
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
  const gradients = [
    "from-amber-800 via-amber-900 to-stone-900",
    "from-stone-700 via-amber-800 to-stone-900",
    "from-amber-700 via-stone-800 to-amber-900",
    "from-stone-800 via-amber-700 to-stone-800",
  ];
  const gradientClass = gradients[index % gradients.length];

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      window.open(`https://lost.london/${slug}`, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="block relative rounded-xl overflow-hidden group cursor-pointer h-48 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] w-full text-left"
    >
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        {hero_image_url ? (
          <img
            src={hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="absolute inset-0 p-4 flex flex-col justify-end pointer-events-none">
        <div className="absolute top-3 left-3 right-3 flex items-center gap-2 flex-wrap">
          {date_range && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/90 text-white text-xs font-medium rounded-full shadow-lg">
              {date_range}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-full border border-white/30">
              {location}
            </span>
          )}
        </div>

        <div>
          <h3 className="font-bold text-white text-lg leading-tight mb-1 line-clamp-2 drop-shadow-lg group-hover:text-amber-200 transition-colors">
            {title}
          </h3>
          <p className="text-white/80 text-sm line-clamp-2 leading-relaxed drop-shadow">
            {excerpt}
          </p>
        </div>

        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <span className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-lg">
            {onClick ? 'Ask VIC' : 'Read'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        {onClick && (
          <a
            href={`https://lost.london/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors pointer-events-auto"
            title="Read full article"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
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
      className="block relative rounded-lg overflow-hidden group h-24 shadow-md hover:shadow-lg transition-all"
    >
      <div className="absolute inset-0">
        {hero_image_url ? (
          <img
            src={hero_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-700 to-stone-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      <div className="absolute inset-0 p-3 flex flex-col justify-end">
        <h4 className="font-semibold text-white text-sm line-clamp-1 drop-shadow group-hover:text-amber-200 transition-colors">
          {title}
        </h4>
        <p className="text-white/70 text-xs line-clamp-1 mt-0.5">{excerpt}</p>
      </div>
    </a>
  );
}
