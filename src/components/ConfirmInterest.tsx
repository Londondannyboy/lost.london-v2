"use client";

/**
 * CONFIRM INTEREST - Human-in-the-Loop Component
 *
 * Allows users to confirm/skip before storing interests to Zep memory.
 * This implements Pydantic AI HITL pattern via frontend rendering.
 *
 * Flow:
 * 1. Agent detects topic interest → emits propose_interest tool call
 * 2. This component renders with topic chips
 * 3. User confirms → stored to Zep with validation
 * 4. User skips → nothing stored
 */

import { useState, useCallback } from "react";
import { Check, X, Loader2 } from "lucide-react";

interface InterestData {
  topic: string;
  era?: string;
  location?: string;
}

interface ConfirmInterestProps {
  interest: InterestData;
  userId: string;
  userName?: string;
  onConfirm?: (interest: InterestData) => void;
  onSkip?: () => void;
}

export function ConfirmInterest({
  interest,
  userId,
  userName,
  onConfirm,
  onSkip,
}: ConfirmInterestProps) {
  const [status, setStatus] = useState<"pending" | "storing" | "stored" | "skipped">("pending");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = useCallback(async () => {
    if (!interest.topic || interest.topic.length < 3) {
      setError("Topic too short to store");
      return;
    }

    setStatus("storing");
    setError(null);

    try {
      // Store topic interest with Zod validation on backend
      const response = await fetch("/api/zep/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          action: "topic_interest",
          name: userName,
          topic: interest.topic,
          era: interest.era,
          location: interest.location,
        }),
      });

      const result = await response.json();

      if (result.success && result.validated) {
        setStatus("stored");
        onConfirm?.(interest);
        console.log(`[ConfirmInterest] Stored: ${interest.topic} (validated)`);
      } else {
        setError(result.reason || "Failed to store");
        setStatus("pending");
      }
    } catch (err) {
      console.error("[ConfirmInterest] Error:", err);
      setError("Network error");
      setStatus("pending");
    }
  }, [interest, userId, userName, onConfirm]);

  const handleSkip = useCallback(() => {
    setStatus("skipped");
    onSkip?.();
    console.log(`[ConfirmInterest] Skipped: ${interest.topic}`);
  }, [interest.topic, onSkip]);

  // Already handled
  if (status === "stored") {
    return (
      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
        <Check className="w-4 h-4 text-emerald-600" />
        <span className="text-emerald-700">
          Added <strong>{interest.topic}</strong> to your interests
        </span>
      </div>
    );
  }

  if (status === "skipped") {
    return null; // Don't show anything after skip
  }

  return (
    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg shadow-sm">
      {/* Header */}
      <div className="text-sm text-amber-800 mb-3 font-medium">
        Remember this interest?
      </div>

      {/* Interest chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Topic chip - primary */}
        <span className="inline-flex items-center px-3 py-1.5 bg-amber-100 text-amber-800 rounded-full text-sm font-medium border border-amber-300">
          {interest.topic}
        </span>

        {/* Era chip - secondary */}
        {interest.era && (
          <span className="inline-flex items-center px-3 py-1.5 bg-stone-100 text-stone-700 rounded-full text-sm border border-stone-300">
            {interest.era}
          </span>
        )}

        {/* Location chip - secondary */}
        {interest.location && (
          <span className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200">
            {interest.location}
          </span>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-sm text-red-600 mb-3">{error}</div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={status === "storing"}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {status === "storing" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Remember
            </>
          )}
        </button>

        <button
          onClick={handleSkip}
          disabled={status === "storing"}
          className="flex items-center gap-1.5 px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Skip
        </button>
      </div>
    </div>
  );
}

/**
 * Wrapper for when interest data comes from tool call result
 */
interface ConfirmInterestFromToolProps {
  result: {
    topic?: string;
    era?: string;
    location?: string | { name?: string };
    query?: string;
  };
  userId: string;
  userName?: string;
  onConfirm?: (interest: InterestData) => void;
  onSkip?: () => void;
}

export function ConfirmInterestFromTool({
  result,
  userId,
  userName,
  onConfirm,
  onSkip,
}: ConfirmInterestFromToolProps) {
  // Extract interest data from tool result
  const locationStr = typeof result.location === "string"
    ? result.location
    : (result.location as { name?: string })?.name;

  const interest: InterestData = {
    topic: result.topic || result.query || "",
    era: result.era,
    location: locationStr,
  };

  // Don't render if no topic
  if (!interest.topic || interest.topic.length < 3) {
    return null;
  }

  return (
    <ConfirmInterest
      interest={interest}
      userId={userId}
      userName={userName}
      onConfirm={onConfirm}
      onSkip={onSkip}
    />
  );
}
