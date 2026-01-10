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

  // Static map image from OpenStreetMap (more reliable than iframe which gets blocked)
  const staticMapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${location.lat},${location.lng}&zoom=15&size=400x200&markers=${location.lat},${location.lng},red-pushpin`;

  // Google Maps link as primary interactive option
  const googleMapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=16`;

  // OpenStreetMap link
  const osmUrl = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}&zoom=16`;

  return (
    <div className="rounded-lg overflow-hidden border border-blue-200 bg-blue-50">
      {/* Map container - clickable to open in Google Maps */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block h-48 w-full relative group cursor-pointer"
      >
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
            <svg className="w-12 h-12 text-blue-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-600">{location.name}</span>
          </div>
        )}

        {/* Error fallback - show styled placeholder */}
        {imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-cyan-100">
            <svg className="w-10 h-10 text-blue-500 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <h4 className="font-semibold text-blue-800 mb-1">{location.name}</h4>
            <p className="text-xs text-blue-600">{location.lat.toFixed(4)}, {location.lng.toFixed(4)}</p>
          </div>
        )}

        {/* Static map image */}
        <img
          src={staticMapUrl}
          alt={`Map of ${location.name}`}
          className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/20 transition-colors duration-200 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 px-3 py-1.5 rounded-lg text-sm font-medium text-blue-800 shadow-lg">
            Open in Maps
          </span>
        </div>
      </a>

      {/* Location info bar */}
      <div className="p-2 bg-blue-50 flex items-center justify-between border-t border-blue-100">
        <div>
          <div className="text-xs font-medium text-blue-800">{location.name}</div>
          <div className="text-[10px] text-blue-500">
            {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            title="Open in Google Maps"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </a>
          <a
            href={osmUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
            title="Open in OpenStreetMap"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
