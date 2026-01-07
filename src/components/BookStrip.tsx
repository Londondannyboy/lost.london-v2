'use client';

import { useState, useEffect } from 'react';

export function BookStrip() {
  const [isVisible, setIsVisible] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Check if user has dismissed the strip in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('bookStripDismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('bookStripDismissed', 'true');
  };

  if (dismissed) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-amber-900 text-white py-3 z-40 transition-transform duration-300 ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/lost-london-cover-1.jpg"
            alt="Lost London book"
            className="w-10 h-14 rounded shadow-md object-cover hidden sm:block"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="font-medium text-sm sm:text-base">Own the Lost London books</span>
            <span className="text-amber-200 text-xs sm:text-sm hidden sm:inline">
              by Vic Keegan
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://www.waterstones.com/author/vic-keegan/4942784"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-amber-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded font-medium hover:bg-gray-100 transition-colors text-sm whitespace-nowrap"
          >
            Buy at Waterstones
          </a>
          <button
            onClick={handleDismiss}
            className="text-amber-200 hover:text-white p-1 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
