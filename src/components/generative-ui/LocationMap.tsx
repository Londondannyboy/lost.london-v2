"use client";

import { useState, useCallback } from "react";

interface LocationMapProps {
  location: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
  };
}

export function LocationMap({ location }: LocationMapProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Safe handlers to avoid React #185 error
  const handleImageLoad = useCallback(() => {
    setTimeout(() => setImageLoaded(true), 0);
  }, []);
  const handleImageError = useCallback(() => {
    setTimeout(() => setImageError(true), 0);
  }, []);

  // Try multiple static map sources for reliability
  // 1. OpenStreetMap static map (vintage/yellow style)
  const osmStaticUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.005},${location.lat - 0.003},${location.lng + 0.005},${location.lat + 0.003}&layer=mapnik&marker=${location.lat},${location.lng}`;

  // 2. Stamen/Stadia watercolor (vintage look)
  const stadiaUrl = `https://tiles.stadiamaps.com/static/stamen_watercolor?center=${location.lng},${location.lat}&zoom=15&size=400x200&markers=color:red|${location.lat},${location.lng}&apikey=`;

  // 3. Geoapify static map (reliable, no key needed for low volume)
  const geoapifyUrl = `https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&width=400&height=200&center=lonlat:${location.lng},${location.lat}&zoom=15&marker=lonlat:${location.lng},${location.lat};type:awesome;color:%238b6914;size:large`;

  // Google Maps link
  const googleMapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=16`;

  // OpenStreetMap link
  const osmUrl = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}&zoom=16`;

  return (
    <div className="rounded-xl overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-stone-50 shadow-md">
      {/* Map container - clickable */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-48 w-full relative group cursor-pointer"
      >
        {/* Loading state - styled placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200 animate-pulse z-10">
            <svg className="w-10 h-10 text-amber-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-amber-700">{location.name}</span>
          </div>
        )}

        {/* Error state - show fallback with map-like background */}
        {imageError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[url('/London%20Map%20with%20River.jpg')] bg-cover bg-center">
            <div className="absolute inset-0 bg-amber-900/60" />
            <div className="relative z-10 bg-white/95 rounded-lg p-4 text-center shadow-lg">
              <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-red-500 border-4 border-white shadow-md" />
              <h4 className="font-bold text-amber-900 mb-1">{location.name}</h4>
              <p className="text-xs text-amber-600">
                {location.lat.toFixed(4)}°N, {Math.abs(location.lng).toFixed(4)}°W
              </p>
            </div>
          </div>
        )}

        {/* OpenStreetMap iframe - works well on most browsers */}
        {/* pointer-events: none allows clicks to pass through to parent <a> tag */}
        {!imageError && (
          <iframe
            src={osmStaticUrl}
            width="100%"
            height="100%"
            style={{
              border: 0,
              opacity: imageLoaded ? 1 : 0,
              filter: 'sepia(20%) saturate(110%)',  // Slight vintage look
              pointerEvents: 'none'  // Allow clicks to pass through to parent link
            }}
            loading="lazy"
            title={`Map of ${location.name}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="transition-opacity duration-300"
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-amber-900/0 group-hover:bg-amber-900/20 transition-colors duration-200 flex items-center justify-center pointer-events-none z-20">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/95 px-4 py-2 rounded-lg text-sm font-semibold text-amber-800 shadow-lg">
            Open in Maps →
          </span>
        </div>
      </a>

      {/* Location info bar - amber themed */}
      <div className="p-3 bg-gradient-to-r from-amber-50 to-stone-50 flex items-center justify-between border-t border-amber-100">
        <div>
          <div className="text-sm font-semibold text-amber-900">{location.name}</div>
          {location.description && (
            <div className="text-xs text-amber-600 line-clamp-1">{location.description}</div>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full hover:bg-amber-200 transition-colors font-medium"
            title="Open in Google Maps"
          >
            Google
          </a>
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-stone-100 text-stone-700 px-3 py-1.5 rounded-full hover:bg-stone-200 transition-colors font-medium"
            title="Open in OpenStreetMap"
          >
            OSM
          </a>
        </div>
      </div>
    </div>
  );
}
