"use client";

/**
 * TOPIC CHANGE CONFIRMATION - Human-in-the-Loop Component
 *
 * Allows users to confirm topic changes with visual UI buttons.
 * This implements Pydantic AI HITL pattern via frontend rendering.
 *
 * Flow:
 * 1. VIC detects user wants to change topic → sets pending_topic in session
 * 2. VIC asks "Shall we leave X and explore Y?"
 * 3. This component renders with Switch/Stay buttons
 * 4. User clicks Switch → confirms topic change, updates Zep
 * 5. User clicks Stay → rejects, continues with current topic
 */

import { useState, useCallback } from "react";
import { ArrowRight, RotateCcw, Loader2 } from "lucide-react";

interface TopicChangeConfirmationProps {
  currentTopic: string;
  newTopic: string;
  userId?: string;
  userName?: string;
  sessionId?: string;
  onConfirm?: (newTopic: string) => void;
  onReject?: (currentTopic: string) => void;
}

export function TopicChangeConfirmation({
  currentTopic,
  newTopic,
  userId,
  userName,
  sessionId,
  onConfirm,
  onReject,
}: TopicChangeConfirmationProps) {
  const [status, setStatus] = useState<"pending" | "switching" | "switched" | "staying">("pending");
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = useCallback(async () => {
    setStatus("switching");
    setError(null);

    try {
      // 1. Store the topic change in Zep (new interest)
      if (userId) {
        await fetch("/api/zep/user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            action: "topic_interest",
            name: userName,
            topic: newTopic,
            note: `Changed from ${currentTopic}`,
          }),
        });
        console.log(`[TopicChange] Stored in Zep: ${currentTopic} → ${newTopic}`);
      }

      // 2. Notify CLM about the topic change confirmation
      // This is optional - the next "yes" message will trigger the confirmation
      // But we can pre-confirm for faster response
      if (sessionId) {
        try {
          await fetch("/api/copilotkit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "confirm_topic_change",
              sessionId,
              newTopic,
              currentTopic,
            }),
          });
        } catch {
          // Non-critical - CLM will handle "yes" anyway
        }
      }

      setStatus("switched");
      onConfirm?.(newTopic);
      console.log(`[TopicChange] Confirmed switch to: ${newTopic}`);
    } catch (err) {
      console.error("[TopicChange] Error:", err);
      setError("Failed to switch topic");
      setStatus("pending");
    }
  }, [currentTopic, newTopic, userId, userName, sessionId, onConfirm]);

  const handleStay = useCallback(() => {
    setStatus("staying");
    onReject?.(currentTopic);
    console.log(`[TopicChange] Staying on: ${currentTopic}`);
  }, [currentTopic, onReject]);

  // Already handled - show confirmation
  if (status === "switched") {
    return (
      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <ArrowRight className="w-4 h-4 text-blue-600" />
        <span className="text-blue-700">
          Now exploring <strong>{newTopic}</strong>
        </span>
      </div>
    );
  }

  if (status === "staying") {
    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <RotateCcw className="w-4 h-4 text-amber-600" />
        <span className="text-amber-700">
          Continuing with <strong>{currentTopic}</strong>
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="text-sm text-blue-800 mb-3 font-medium">
        Change topic?
      </div>

      {/* Topic transition visualization */}
      <div className="flex items-center gap-3 mb-4">
        {/* Current topic */}
        <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-300">
          {currentTopic}
        </span>

        {/* Arrow */}
        <ArrowRight className="w-5 h-5 text-blue-400" />

        {/* New topic */}
        <span className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-300">
          {newTopic}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleSwitch}
          disabled={status === "switching"}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {status === "switching" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Switching...
            </>
          ) : (
            <>
              <ArrowRight className="w-4 h-4" />
              Switch to {newTopic}
            </>
          )}
        </button>

        <button
          onClick={handleStay}
          disabled={status === "switching"}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border border-amber-300"
        >
          <RotateCcw className="w-4 h-4" />
          Stay on {currentTopic}
        </button>
      </div>
    </div>
  );
}

/**
 * Detect topic change from VIC's response
 * Returns { isTopicChange, currentTopic, newTopic } if VIC is asking about topic change
 */
export function detectTopicChangeRequest(text: string): {
  isTopicChange: boolean;
  currentTopic?: string;
  newTopic?: string;
} {
  // Pattern: "Shall we leave X behind and explore Y instead?"
  const patterns = [
    /shall we leave (.+?) behind and explore (.+?) instead/i,
    /shall we move from (.+?) to (.+?)\?/i,
    /want to switch from (.+?) to (.+?)\?/i,
    /leave (.+?) and explore (.+?)\?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return {
        isTopicChange: true,
        currentTopic: match[1].trim(),
        newTopic: match[2].trim(),
      };
    }
  }

  return { isTopicChange: false };
}
