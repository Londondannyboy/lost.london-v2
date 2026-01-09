"use client";

import { useState, useEffect } from "react";

interface LocationMapProps {
  location: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
  };
}

export function LocationMap({ location }: LocationMapProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [showFallback, setShowFallback] = useState(false);

  // Timeout to show fallback if iframe doesn't load
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        setShowFallback(true);
      }
    }, 3000); // 3 seconds timeout
    return () => clearTimeout(timer);
  }, [iframeLoaded]);

  // OpenStreetMap embed URL
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.008},${location.lat - 0.005},${location.lng + 0.008},${location.lat + 0.005}&layer=mapnik&marker=${location.lat},${location.lng}`;

  // Google Maps link as primary fallback (always works)
  const googleMapsUrl = `https://www.google.com/maps?q=${location.lat},${location.lng}&z=16`;

  // OpenStreetMap link
  const osmUrl = `https://www.openstreetmap.org/?mlat=${location.lat}&mlon=${location.lng}&zoom=16`;

  return (
    <div className="rounded-lg overflow-hidden border border-blue-200 bg-blue-50">
      {/* Map container */}
      <div className="h-48 w-full relative">
        {/* Loading/fallback placeholder - always visible until iframe loads */}
        {!iframeLoaded && !iframeError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200 animate-pulse">
            <svg className="w-12 h-12 text-blue-400 mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-600">Loading map...</span>
          </div>
        )}

        {/* Error/fallback state - styled placeholder with links */}
        {(iframeError || showFallback) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-blue-50 to-cyan-100">
            <div className="bg-white/80 rounded-lg p-4 text-center shadow-sm">
              <svg className="w-10 h-10 text-blue-500 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              <h4 className="font-semibold text-blue-800 mb-1">{location.name}</h4>
              <p className="text-xs text-blue-600 mb-3">
                {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
              <div className="flex gap-2 justify-center">
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded hover:bg-blue-600 transition-colors"
                >
                  Google Maps
                </a>
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-white text-blue-600 px-3 py-1.5 rounded border border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  OpenStreetMap
                </a>
              </div>
            </div>
          </div>
        )}

        {/* OpenStreetMap iframe */}
        {!iframeError && (
          <iframe
            src={mapUrl}
            width="100%"
            height="100%"
            style={{ border: 0, opacity: iframeLoaded ? 1 : 0 }}
            loading="lazy"
            title={`Map of ${location.name}`}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setIframeError(true)}
          />
        )}
      </div>

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
