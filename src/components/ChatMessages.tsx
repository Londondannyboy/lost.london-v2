"use client";

import { UserMessageProps, AssistantMessageProps } from "@copilotkit/react-ui";
import { createContext, useContext, useMemo } from "react";

// Context for sharing user info with chat components
interface ChatUserContextValue {
  userName?: string;
  userImage?: string;
}

export const ChatUserContext = createContext<ChatUserContextValue>({});

export function useChatUser() {
  return useContext(ChatUserContext);
}

/**
 * Custom User Message with profile avatar and mood indicator
 */
export function CustomUserMessage({ message }: UserMessageProps) {
  const { userName, userImage } = useChatUser();

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

  // Get initials for fallback avatar
  const initials = userName?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="flex gap-3 mb-4">
      {/* User Avatar */}
      <div className="flex-shrink-0">
        {userImage ? (
          <img
            src={userImage}
            alt={userName || "You"}
            className="w-8 h-8 rounded-full object-cover border-2 border-stone-300"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center border-2 border-stone-300 text-stone-600 font-semibold text-sm">
            {initials}
          </div>
        )}
      </div>

      {/* Message Content */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-stone-700">{userName || "You"}</span>
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
