"use client";

import { UserMessageProps, AssistantMessageProps } from "@copilotkit/react-ui";

/**
 * Custom User Message with avatar and mood indicator
 */
export function CustomUserMessage({ children }: UserMessageProps) {
  // Could extract mood from Hume emotions if passed through
  const moods = ["pondering", "curious", "exploring", "questioning"];
  const randomMood = moods[Math.floor(Math.random() * moods.length)];

  return (
    <div className="flex gap-3 mb-4">
      {/* User Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center border-2 border-stone-300">
          <svg
            className="w-4 h-4 text-stone-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-stone-700">You</span>
          <span className="text-xs text-stone-400 italic">{randomMood}...</span>
        </div>
        <div className="bg-stone-100 rounded-lg rounded-tl-none p-3 text-stone-800">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Custom Assistant Message (VIC) with avatar
 */
export function CustomAssistantMessage({ children, isLoading }: AssistantMessageProps) {
  return (
    <div className="flex gap-3 mb-4">
      {/* VIC Avatar */}
      <div className="flex-shrink-0">
        <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-amber-300">
          <img
            src="/vic-avatar.jpg"
            alt="VIC"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-amber-800">VIC</span>
          {isLoading && (
            <span className="text-xs text-amber-500 italic">thinking...</span>
          )}
        </div>
        <div className="bg-amber-50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-300">
          {children}
        </div>
      </div>
    </div>
  );
}
