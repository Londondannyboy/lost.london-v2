"use client";

import { UserMessageProps, AssistantMessageProps } from "@copilotkit/react-ui";
import { useMemo } from "react";

/**
 * Custom User Message with avatar and mood indicator
 */
export function CustomUserMessage({ message }: UserMessageProps) {
  // Stable mood per message (based on content hash)
  const mood = useMemo(() => {
    const moods = ["pondering", "curious", "exploring", "questioning", "mulling"];
    const content = typeof message?.content === "string"
      ? message.content
      : JSON.stringify(message?.content || "");
    const hash = content.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    return moods[hash % moods.length];
  }, [message?.content]);

  // Extract text content
  const textContent = useMemo(() => {
    if (!message?.content) return "";
    if (typeof message.content === "string") return message.content;
    // Handle array of content parts
    return (message.content as any[])
      .map((part: any) => (part.type === "text" ? part.text : ""))
      .filter(Boolean)
      .join("\n");
  }, [message?.content]);

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
          <span className="text-xs text-stone-400 italic">{mood}...</span>
        </div>
        <div className="bg-stone-100 rounded-lg rounded-tl-none p-3 text-stone-800">
          {textContent}
        </div>
      </div>
    </div>
  );
}

/**
 * Custom Assistant Message (VIC) with avatar
 */
export function CustomAssistantMessage({ message, isLoading, isGenerating }: AssistantMessageProps) {
  // Extract text content
  const textContent = useMemo(() => {
    if (!message?.content) return "";
    if (typeof message.content === "string") return message.content;
    return "";
  }, [message?.content]);

  // Get generative UI if available
  const generativeUI = message?.generativeUI?.();

  return (
    <div className="flex gap-3 mb-4">
      {/* VIC Avatar */}
      <div className="flex-shrink-0">
        <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${isGenerating ? "border-amber-400 animate-pulse" : "border-amber-300"}`}>
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
          {isGenerating && !isLoading && (
            <span className="text-xs text-amber-500 italic">speaking...</span>
          )}
        </div>
        <div className="bg-amber-50 rounded-lg rounded-tl-none p-3 text-stone-800 border-l-2 border-amber-300 whitespace-pre-wrap">
          {textContent}
          {generativeUI}
        </div>
      </div>
    </div>
  );
}
