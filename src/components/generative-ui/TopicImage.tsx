"use client";

interface TopicImageProps {
  query: string;
  hero_image: string;
  brief?: string;
}

/**
 * TopicImage - Display a single historic image for a topic
 * Used when user asks "show me an image of X"
 */
export function TopicImage({ query, hero_image, brief }: TopicImageProps) {
  return (
    <div className="space-y-3">
      {brief && (
        <p className="text-sm text-stone-600 italic">{brief}</p>
      )}
      <div className="rounded-lg overflow-hidden border border-stone-200 shadow-md">
        <img
          src={hero_image}
          alt={query}
          className="w-full h-64 object-cover"
        />
        <div className="p-3 bg-stone-50 text-sm text-stone-600">
          Historic image of {query}
        </div>
      </div>
    </div>
  );
}
