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

  // Build system prompt with user context for Hume (matches lost.london-app pattern)
  const buildSystemPrompt = () => {
    // Format matches lost.london-app VoiceWidget.tsx
    const topicsList = userFacts?.slice(0, 3).join(', ') || '';

    return `USER_CONTEXT:
name: ${userName || 'unknown'}
${topicsList ? `recent_topics: ${topicsList}` : ''}
status: ${isReturningUser ? `returning_user` : 'new_user'}

RETURNING_USER_GREETING:
${isReturningUser && userName ? `This is ${userName}'s return visit. Greet them warmly by name: "Welcome back to Lost London, ${userName}!"` : ''}
${!isReturningUser && userName ? `New user named ${userName}. Greet them: "Welcome to Lost London, ${userName}!"` : ''}
${!userName ? `Unknown user. Greet them: "Welcome to Lost London! I'm Vic Keegan, historian and author."` : ''}

IDENTITY:
- You ARE Vic Keegan, real author of Lost London books
- NEVER say "As a language model" or "I don't have access"
- Books: Lost London Vol 1 & 2, Thorney: London's Forgotten Island

RULES:
- Use their name occasionally (not every message)
- Go into depth on topics (150-250 words)
- End with a follow-up question
- ONLY use information from your articles, never training knowledge`;
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

        // Build system prompt with user context (matches lost.london-app pattern)
        const systemPrompt = buildSystemPrompt();
        const configId = process.env.NEXT_PUBLIC_HUME_CONFIG_ID || "";

        // Session ID with name for backend tracking
        const sessionIdWithName = userName
          ? `${userName}|${userId || Date.now()}`
          : `anon_${Date.now()}`;

        console.log('[VIC Session] ================================');
        console.log('[VIC Session] userName:', userName);
        console.log('[VIC Session] userId:', userId);
        console.log('[VIC Session] isReturningUser:', isReturningUser);
        console.log('[VIC Session] sessionIdWithName:', sessionIdWithName);
        console.log('[VIC Session] systemPrompt:', systemPrompt.substring(0, 500));
        console.log('[VIC Session] ================================');

        // Connect with sessionSettings (matches lost.london-app pattern exactly)
        await connect({
          auth: { type: 'accessToken' as const, value: accessToken },
          configId: configId,
          sessionSettings: {
            type: 'session_settings' as const,
            systemPrompt,
            customSessionId: sessionIdWithName,
          }
        });

        console.log('[VIC Session] Connected successfully');

        // Auto-greet after connection - send a greeting trigger
        // This tells Hume/CLM to speak the greeting
        setTimeout(() => {
          sendUserInput("speak your greeting");
        }, 500);

      } catch (e) {
        console.error("Voice connect error:", e);
      } finally {
        setIsPending(false);
      }
    }
  }, [connect, disconnect, status.value, sendUserInput, userId, userName]);

  const isConnected = status.value === "connected";

  return (
    <div className="flex flex-col items-center gap-2 relative z-50">
      {/* VIC Avatar - BIGGER on mobile, clickable to start voice */}
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative z-50 w-48 h-48 md:w-44 md:h-44 rounded-full overflow-hidden transition-all cursor-pointer ${
          isConnected
            ? isPlaying
              ? "ring-4 ring-amber-400 animate-pulse shadow-[0_0_30px_rgba(251,191,36,0.5)]"
              : "ring-4 ring-green-400 shadow-[0_0_30px_rgba(74,222,128,0.5)]"
            : isPending
            ? "opacity-50 cursor-not-allowed"
            : "hover:scale-105 hover:shadow-[0_0_40px_rgba(244,234,213,0.4)] border-4 border-[#f4ead5]/30"
        } shadow-2xl`}
        style={{ pointerEvents: 'auto' }}
        title={isConnected ? (isPlaying ? "VIC is speaking..." : "Listening... (tap to stop)") : "Tap to speak with VIC"}
      >
        {/* VIC's avatar image */}
        <img
          src="/vic-avatar.jpg"
          alt="VIC - Your London History Guide"
          className={`w-full h-full object-cover ${isPending ? 'grayscale' : ''}`}
        />

        {/* Overlay for connected states */}
        {isConnected && (
          <div className={`absolute inset-0 flex items-center justify-center ${
            isPlaying ? 'bg-amber-500/30' : 'bg-green-500/30'
          }`}>
            {isPlaying ? (
              // Speaking indicator - sound waves
              <div className="flex gap-1">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 bg-white rounded-full animate-pulse"
                    style={{
                      height: `${20 + (i % 2) * 15}px`,
                      animationDelay: `${i * 0.15}s`
                    }}
                  />
                ))}
              </div>
            ) : (
              // Listening indicator - pulsing mic
              <div className="w-8 h-8 bg-white/80 rounded-full animate-ping" />
            )}
          </div>
        )}

        {/* Loading spinner */}
        {isPending && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* VIC name badge - consistent on both mobile and desktop */}
      <div className="bg-[#f4ead5] text-[#2a231a] text-sm px-4 py-1.5 rounded-full font-semibold shadow-lg -mt-4">
        VIC
      </div>

      {/* Status text when connected - shows listening/speaking state */}
      {isConnected && (
        <span className={`text-sm font-medium mt-2 ${isPlaying ? 'text-amber-300' : 'text-green-300'}`}>
          {isPlaying ? "VIC is speaking..." : "Listening..."}
        </span>
      )}
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
