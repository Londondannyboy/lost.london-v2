"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

interface ToolResult {
  type: "article" | "articles" | "map" | "timeline";
  data: any;
}

interface VoiceButtonProps {
  onMessage: (text: string, role?: "user" | "assistant") => void;
  onToolResult?: (result: ToolResult) => void;
}

function VoiceButton({ onMessage, onToolResult }: VoiceButtonProps) {
  const { connect, disconnect, status, messages, sendUserInput, sendToolMessage } = useVoice();
  const [isPending, setIsPending] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const lastSentMsgId = useRef<string | null>(null);
  const processedToolCalls = useRef<Set<string>>(new Set());

  // Track if VIC is speaking
  useEffect(() => {
    const playbackMsgs = messages.filter((m: any) =>
      m.type === "assistant_message" || m.type === "assistant_end"
    );
    const lastPlayback = playbackMsgs[playbackMsgs.length - 1];
    // VIC is speaking if last message is assistant_message (not assistant_end)
    setIsPlaying(lastPlayback?.type === "assistant_message");
  }, [messages]);

  // Forward conversation messages to parent
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
        onMessage(lastMsg.message.content, isUser ? "user" : "assistant");
      }
    }
  }, [messages, onMessage]);

  // Handle Hume tool calls - this is where we get search results etc.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1] as any;
    if (!lastMessage) return;

    // Check for tool_call
    const isToolCall = lastMessage.type === 'tool_call' ||
                       lastMessage.type === 'tool_call_message' ||
                       lastMessage.tool_call_id;

    if (!isToolCall) return;

    const toolCallId = lastMessage.toolCallId || lastMessage.tool_call_id;
    if (!toolCallId || processedToolCalls.current.has(toolCallId)) return;

    processedToolCalls.current.add(toolCallId);
    console.log('[VIC Voice] Tool call received:', lastMessage);

    const handleToolCall = async () => {
      const name = lastMessage.name || lastMessage.tool_name || lastMessage.function?.name;
      const parameters = lastMessage.parameters || lastMessage.function?.arguments;

      let args: Record<string, any> = {};
      try {
        args = typeof parameters === 'string' ? JSON.parse(parameters) : (parameters || {});
      } catch (e) {
        console.error('[VIC Voice] Failed to parse tool parameters:', parameters);
      }

      console.log('[VIC Voice] Processing tool:', name, 'with args:', args);

      try {
        let result: any;

        switch (name) {
          case 'search_knowledge':
          case 'search_lost_london':
            // Call our backend search API
            const searchRes = await fetch('/api/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ query: args.query, limit: 5 }),
            });
            result = await searchRes.json();

            // Forward to CopilotKit UI
            if (result.articles && onToolResult) {
              onToolResult({
                type: 'articles',
                data: { articles: result.articles, query: args.query }
              });
            }
            break;

          case 'show_map':
          case 'get_location':
            // Return location data for UI
            result = { found: true, location: args.location_name };
            if (onToolResult) {
              onToolResult({ type: 'map', data: { location: args.location_name } });
            }
            break;

          case 'show_timeline':
            result = { found: true, era: args.era };
            if (onToolResult) {
              onToolResult({ type: 'timeline', data: { era: args.era } });
            }
            break;

          default:
            console.warn('[VIC Voice] Unknown tool:', name);
            result = { error: `Unknown tool: ${name}` };
        }

        // Send result back to Hume
        sendToolMessage({
          type: 'tool_response',
          toolCallId: toolCallId,
          content: JSON.stringify(result),
        });

      } catch (error) {
        console.error('[VIC Voice] Tool error:', error);
        sendToolMessage({
          type: 'tool_error',
          toolCallId: toolCallId,
          error: 'Tool execution failed',
          content: '',
        });
      }
    };

    handleToolCall();
  }, [messages, sendToolMessage, onToolResult]);

  const handleToggle = useCallback(async () => {
    if (status.value === "connected") {
      disconnect();
    } else {
      setIsPending(true);
      processedToolCalls.current.clear();

      try {
        const res = await fetch("/api/hume-token");
        const { accessToken } = await res.json();

        await connect({
          auth: { type: "accessToken", value: accessToken },
          configId: process.env.NEXT_PUBLIC_HUME_CONFIG_ID || "",
        });

        // Trigger greeting
        setTimeout(() => {
          sendUserInput("Hello!");
        }, 500);

      } catch (e) {
        console.error("Voice connect error:", e);
      } finally {
        setIsPending(false);
      }
    }
  }, [connect, disconnect, status.value, sendUserInput]);

  const isConnected = status.value === "connected";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl ${
          isConnected
            ? isPlaying
              ? "bg-amber-500 animate-pulse"
              : "bg-green-500 hover:bg-green-600"
            : isPending
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-[#f4ead5] hover:bg-white border-2 border-[#8b6914]"
        }`}
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
  onToolResult
}: {
  onMessage: (text: string, role?: "user" | "assistant") => void;
  onToolResult?: (result: ToolResult) => void;
}) {
  return (
    <VoiceProvider
      onError={(err) => console.error("[VIC Voice] Error:", err)}
      onOpen={() => console.log("[VIC Voice] Connected")}
      onClose={(e) => console.log("[VIC Voice] Closed:", e)}
    >
      <VoiceButton onMessage={onMessage} onToolResult={onToolResult} />
    </VoiceProvider>
  );
}

export type { ToolResult };
