"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

interface VoiceButtonProps {
  onMessage: (text: string, role?: "user" | "assistant") => void;
}

const SESSION_GREETED_KEY = 'vic_greeted_session';
const SESSION_LAST_INTERACTION_KEY = 'vic_last_interaction';

function getSessionValue(key: string, defaultValue: number | boolean): number | boolean {
  if (typeof window === 'undefined') return defaultValue;
  const stored = sessionStorage.getItem(key);
  if (stored === null) return defaultValue;
  return key.includes('time') ? parseInt(stored, 10) : stored === 'true';
}

function setSessionValue(key: string, value: number | boolean): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(key, String(value));
}

function VoiceButton({ onMessage }: VoiceButtonProps) {
  const { connect, disconnect, status, messages, sendUserInput } = useVoice();
  const [isPending, setIsPending] = useState(false);
  const lastSentMsgId = useRef<string | null>(null);
  const greetedThisSession = useRef(getSessionValue(SESSION_GREETED_KEY, false) as boolean);
  const lastInteractionTime = useRef(getSessionValue(SESSION_LAST_INTERACTION_KEY, 0) as number);

  // Forward messages to CopilotKit for full context
  useEffect(() => {
    const conversationMsgs = messages.filter(
      (m: any) => (m.type === "user_message" || m.type === "assistant_message") && m.message?.content
    );

    if (conversationMsgs.length > 0) {
      const lastMsg = conversationMsgs[conversationMsgs.length - 1] as any;
      const msgId = lastMsg?.id || `${conversationMsgs.length}-${lastMsg?.message?.content?.slice(0, 20)}`;

      if (lastMsg?.message?.content && msgId !== lastSentMsgId.current) {
        const isUser = lastMsg.type === "user_message";
        console.log(`[VIC Voice] Forwarding ${isUser ? 'user' : 'assistant'}:`, lastMsg.message.content.slice(0, 50));
        lastSentMsgId.current = msgId;
        onMessage(lastMsg.message.content, isUser ? "user" : "assistant");
      }
    }
  }, [messages, onMessage]);

  const handleToggle = useCallback(async () => {
    if (status.value === "connected") {
      const now = Date.now();
      lastInteractionTime.current = now;
      setSessionValue(SESSION_LAST_INTERACTION_KEY, now);
      disconnect();
    } else {
      setIsPending(true);
      try {
        const res = await fetch("/api/hume-token");
        const { accessToken } = await res.json();

        const timeSinceLastInteraction = lastInteractionTime.current > 0
          ? Date.now() - lastInteractionTime.current
          : Infinity;
        const isQuickReconnect = timeSinceLastInteraction < 5 * 60 * 1000;
        const wasGreeted = greetedThisSession.current;

        let greetingInstruction = "";
        if (wasGreeted || isQuickReconnect) {
          greetingInstruction = `DO NOT GREET - user has already been greeted. Simply continue the conversation.`;
        } else {
          greetingInstruction = `This is the first connection. Give a warm greeting as Vic Keegan.`;
        }

        const systemPrompt = `You are Vic, the voice of Vic Keegan - a warm London historian.

${greetingInstruction}

Your expertise: 370+ articles about London's hidden history - the Royal Aquarium, Thorney Island, Tyburn, Crystal Palace, and many more forgotten stories.

Keep responses conversational and engaging. Ask follow-up questions to keep the conversation flowing.`;

        const customSessionId = `lost-london-${Date.now()}`;

        await connect({
          auth: { type: "accessToken", value: accessToken },
          configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID || "",
          sessionSettings: {
            type: "session_settings",
            systemPrompt: systemPrompt,
            customSessionId: customSessionId,
          }
        });

        if (!wasGreeted && !isQuickReconnect) {
          setTimeout(() => {
            greetedThisSession.current = true;
            setSessionValue(SESSION_GREETED_KEY, true);
            sendUserInput("Hello Vic!");
          }, 500);
        }
      } catch (e) {
        console.error("Voice connect error:", e);
      } finally {
        setIsPending(false);
      }
    }
  }, [connect, disconnect, status.value, sendUserInput]);

  const isConnected = status.value === "connected";

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-lg ${
        isConnected
          ? "bg-red-500 hover:bg-red-600 animate-pulse"
          : isPending
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-amber-600 hover:bg-amber-700"
      }`}
      title={isConnected ? "Stop listening" : "Talk to VIC"}
    >
      {isPending ? (
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg
          className="w-7 h-7 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          {isConnected ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10h6v4H9z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          )}
        </svg>
      )}
    </button>
  );
}

export function VoiceInput({ onMessage }: { onMessage: (text: string, role?: "user" | "assistant") => void }) {
  return (
    <VoiceProvider
      onError={(err) => console.error("[VIC Voice] Error:", err)}
      onOpen={() => console.log("[VIC Voice] Connected")}
      onClose={(e) => console.log("[VIC Voice] Closed:", e)}
    >
      <VoiceButton onMessage={onMessage} />
    </VoiceProvider>
  );
}
