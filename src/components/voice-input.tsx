"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

interface VoiceButtonProps {
  onMessage: (text: string, role?: "user" | "assistant") => void;
  userId?: string;
  userName?: string;
  isReturningUser?: boolean;
  userFacts?: string[];
}

function VoiceButton({ onMessage, userId, userName, isReturningUser, userFacts }: VoiceButtonProps) {
  const { connect, disconnect, status, messages, sendUserInput } = useVoice();
  const [isPending, setIsPending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastSentMsgId = useRef<string | null>(null);

  // Build system prompt with user context for Hume
  const buildSystemPrompt = () => {
    let prompt = `You are VIC (Vic Keegan), a warm London historian and author.

OPENING LINE (FIRST MESSAGE ONLY):
`;
    if (isReturningUser && userName) {
      prompt += `"Welcome back to Lost London, ${userName}! Lovely to hear from you again. What shall we explore today?"`;
    } else if (userName) {
      prompt += `"Welcome to Lost London, ${userName}! I'm Vic Keegan, and I've spent years uncovering hidden history. What would you like to discover?"`;
    } else {
      prompt += `"Welcome to Lost London! I'm Vic Keegan, historian and author. Ask me anything about London's hidden history - I'm particularly passionate about Thorney Island, the forgotten island beneath Westminster."`;
    }

    if (isReturningUser && userFacts && userFacts.length > 0) {
      prompt += `\n\nUSER CONTEXT (what you remember about them):\n`;
      userFacts.slice(0, 5).forEach(fact => {
        prompt += `- ${fact}\n`;
      });
      prompt += `\nReference their interests naturally but don't be creepy about it.`;
    }

    prompt += `

IDENTITY:
- You ARE Vic Keegan, real author of Lost London books
- NEVER say "As a language model" or "I don't have access"
- Books: Lost London Vol 1 & 2, Thorney: London's Forgotten Island

RULES:
- Use their name occasionally (not every message)
- Go into depth on topics (150-250 words)
- End with a follow-up question
- ONLY use information from your articles, never training knowledge`;

    return prompt;
  };

  // Track if VIC is speaking
  useEffect(() => {
    const playbackMsgs = messages.filter((m: any) =>
      m.type === "assistant_message" || m.type === "assistant_end"
    );
    const lastPlayback = playbackMsgs[playbackMsgs.length - 1];
    setIsPlaying(lastPlayback?.type === "assistant_message");
  }, [messages]);

  // Forward conversation messages to parent (which sends to CopilotKit)
  // This is the key integration: Voice → onMessage → appendMessage → Pydantic AI
  useEffect(() => {
    const conversationMsgs = messages.filter(
      (m: any) => (m.type === "user_message" || m.type === "assistant_message") && m.message?.content
    );

    if (conversationMsgs.length > 0) {
      const lastMsg = conversationMsgs[conversationMsgs.length - 1] as any;
      const msgId = lastMsg?.id || `${conversationMsgs.length}-${lastMsg?.message?.content?.slice(0, 20)}`;

      if (lastMsg?.message?.content && msgId !== lastSentMsgId.current) {
        const isUser = lastMsg.type === "user_message";
        console.log(`[VIC Voice] ${isUser ? 'User' : 'VIC'}:`, lastMsg.message.content.slice(0, 80));
        lastSentMsgId.current = msgId;
        // Forward FULL content to CopilotKit with role indicator
        onMessage(lastMsg.message.content, isUser ? "user" : "assistant");
      }
    }
  }, [messages, onMessage]);

  const handleToggle = useCallback(async () => {
    if (status.value === "connected") {
      disconnect();
    } else {
      setIsPending(true);

      try {
        const res = await fetch("/api/hume-token");
        const { accessToken } = await res.json();

        // Build system prompt with user context
        const systemPrompt = buildSystemPrompt();
        console.log('[VIC Voice] Connecting with user context:', { userName, isReturningUser, factsCount: userFacts?.length });

        // Build custom session ID for backend tracking
        const customSessionId = userId
          ? `${userId}|${userName || ''}`
          : `anon_${Date.now()}`;

        await connect({
          auth: { type: "accessToken", value: accessToken },
          configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID || "",
          customSessionId,
          // Inject user context into session via system prompt
          sessionSettings: {
            type: 'session_settings',
            systemPrompt,
            customSessionId,
          },
        });

        // Don't auto-trigger "Hello!" - let Hume's greeting handle it
        // The system prompt has the opening line

      } catch (e) {
        console.error("Voice connect error:", e);
      } finally {
        setIsPending(false);
      }
    }
  }, [connect, disconnect, status.value, sendUserInput, userId, userName]);

  const isConnected = status.value === "connected";

  return (
    <div className="flex flex-col items-center gap-4 relative z-50">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative z-50 w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl cursor-pointer ${
          isConnected
            ? isPlaying
              ? "bg-amber-500 animate-pulse"
              : "bg-green-500 hover:bg-green-600"
            : isPending
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#f4ead5] hover:bg-white border-4 border-[#8b6914] hover:scale-110"
        }`}
        style={{ pointerEvents: 'auto' }}
        title={isConnected ? (isPlaying ? "VIC is speaking..." : "Listening... (tap to stop)") : "Talk to VIC"}
      >
        {isPending ? (
          <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
        ) : isConnected ? (
          isPlaying ? (
            // Speaking indicator
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-8 bg-white rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          ) : (
            // Listening indicator
            <div className="w-4 h-4 bg-white rounded-full animate-ping" />
          )
        ) : (
          // Mic icon
          <svg className="w-10 h-10 text-[#2a231a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )}
      </button>

      <span className={`text-sm font-medium ${isConnected ? 'text-white' : 'text-[#d4c4a8]'}`}>
        {isPending
          ? "Connecting..."
          : isConnected
          ? isPlaying
            ? "VIC is speaking..."
            : "Listening..."
          : "Tap to speak with VIC"}
      </span>
    </div>
  );
}

export function VoiceInput({
  onMessage,
  userId,
  userName,
  isReturningUser,
  userFacts,
}: {
  onMessage: (text: string, role?: "user" | "assistant") => void;
  userId?: string;
  userName?: string;
  isReturningUser?: boolean;
  userFacts?: string[];
}) {
  return (
    <VoiceProvider
      onError={(err) => console.error("[VIC Voice] Error:", err)}
      onOpen={() => console.log("[VIC Voice] Connected")}
      onClose={(e) => console.log("[VIC Voice] Closed:", e)}
    >
      <VoiceButton
        onMessage={onMessage}
        userId={userId}
        userName={userName}
        isReturningUser={isReturningUser}
        userFacts={userFacts}
      />
    </VoiceProvider>
  );
}
