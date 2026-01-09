"use client";

import { useState, useEffect, useCallback } from "react";

interface DebugData {
  last_request: {
    timestamp?: string;
    stage?: string;
    teaser_match?: {
      title: string;
      location?: string;
      era?: string;
      hook?: string;
    } | null;
    zep_context?: {
      is_returning: boolean;
      facts: string[];
      user_name_from_zep?: string;
    };
    user_name_resolved?: string;
    user_id?: string;
    was_cached?: boolean;
    response?: string;
    session_key?: string;
  };
  cache_status: {
    loaded: boolean;
    keywords_count: number;
    sample_keywords: string[];
  };
  session_states: Record<string, {
    user_name?: string;
    last_topic?: string;
    greeted_this_session?: boolean;
    zep_facts?: string[];
    is_returning?: boolean;
    last_suggested_topic?: string;
  }>;
  prompts: {
    voice_system_prompt: string;
    vic_system_prompt_preview: string;
  };
  request_history?: any[];
}

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "https://vic-agent-production.up.railway.app";

export function DebugPanel({ userId }: { userId?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"request" | "zep" | "cache" | "session">("request");

  const fetchDebugData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${AGENT_URL}/debug/full`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDebugData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch debug data");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearZepMemory = useCallback(async () => {
    if (!userId) {
      setError("No user ID available");
      return;
    }
    if (!confirm(`Clear all Zep memory for user ${userId}? This will remove all stored facts and history.`)) {
      return;
    }
    try {
      const res = await fetch(`${AGENT_URL}/debug/zep/${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("Zep memory cleared! Refresh the page to start fresh.");
      } else {
        setError(data.error || "Failed to clear Zep memory");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear Zep memory");
    }
  }, [userId]);

  // Auto-refresh when panel is open
  useEffect(() => {
    if (isOpen) {
      fetchDebugData();
      const interval = setInterval(fetchDebugData, 3000); // Refresh every 3s
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchDebugData]);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-4 z-50 bg-gray-800 text-white text-xs px-3 py-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Open Debug Panel"
      >
        Debug
      </button>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-96 max-w-full z-50 bg-gray-900 text-white shadow-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <h2 className="font-bold text-sm">VIC Debug Panel</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDebugData}
            className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded"
            disabled={loading}
          >
            {loading ? "..." : "Refresh"}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {(["request", "zep", "cache", "session"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 text-xs py-2 px-3 capitalize ${
              activeTab === tab ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-900/50 text-red-300 text-xs border-b border-red-800">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 text-xs font-mono space-y-3">
        {!debugData ? (
          <div className="text-gray-500">Loading...</div>
        ) : activeTab === "request" ? (
          /* Last Request Tab */
          <div className="space-y-3">
            <Section title="Last Request">
              <KV label="Time" value={debugData.last_request.timestamp} />
              <KV label="Stage" value={debugData.last_request.stage} highlight />
              <KV label="User" value={debugData.last_request.user_name_resolved} />
              <KV label="Session" value={debugData.last_request.session_key} />
              <KV label="Cached" value={debugData.last_request.was_cached ? "Yes" : "No"} />
            </Section>

            {debugData.last_request.teaser_match && (
              <Section title="Teaser Match (Stage 1)">
                <KV label="Title" value={debugData.last_request.teaser_match.title} highlight />
                <KV label="Location" value={debugData.last_request.teaser_match.location} />
                <KV label="Era" value={debugData.last_request.teaser_match.era} />
                <KV label="Hook" value={debugData.last_request.teaser_match.hook} />
              </Section>
            )}

            {debugData.last_request.response && (
              <Section title="Response">
                <p className="text-green-300 whitespace-pre-wrap">
                  {debugData.last_request.response}
                </p>
              </Section>
            )}
          </div>
        ) : activeTab === "zep" ? (
          /* Zep Context Tab */
          <div className="space-y-3">
            <Section title="Zep Context">
              <KV label="User ID" value={userId || debugData.last_request.user_id} />
              <KV label="Is Returning" value={debugData.last_request.zep_context?.is_returning ? "Yes" : "No"} />
              <KV label="Name from Zep" value={debugData.last_request.zep_context?.user_name_from_zep} />
            </Section>

            <Section title="Zep Facts">
              {debugData.last_request.zep_context?.facts?.length ? (
                <ul className="space-y-1">
                  {debugData.last_request.zep_context.facts.map((fact, i) => (
                    <li key={i} className="text-yellow-300">
                      {i + 1}. {fact}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500">No facts stored</p>
              )}
            </Section>

            {userId && (
              <button
                onClick={clearZepMemory}
                className="w-full bg-red-700 hover:bg-red-600 text-white py-2 px-3 rounded text-xs font-semibold"
              >
                Clear Zep Memory (Fix Contamination)
              </button>
            )}
          </div>
        ) : activeTab === "cache" ? (
          /* Cache Status Tab */
          <div className="space-y-3">
            <Section title="Keyword Cache">
              <KV label="Loaded" value={debugData.cache_status.loaded ? "Yes" : "No"} highlight />
              <KV label="Keywords" value={debugData.cache_status.keywords_count.toString()} />
            </Section>

            <Section title="Sample Keywords">
              <div className="flex flex-wrap gap-1">
                {debugData.cache_status.sample_keywords.map((kw, i) => (
                  <span key={i} className="bg-gray-700 px-1.5 py-0.5 rounded text-green-300">
                    {kw}
                  </span>
                ))}
              </div>
            </Section>

            <Section title="Prompts">
              <p className="text-gray-400 text-[10px] whitespace-pre-wrap">
                {debugData.prompts.voice_system_prompt}
              </p>
            </Section>
          </div>
        ) : activeTab === "session" ? (
          /* Session States Tab */
          <div className="space-y-3">
            {Object.entries(debugData.session_states).map(([sessionId, state]) => (
              <Section key={sessionId} title={`Session: ${sessionId.slice(0, 20)}...`}>
                <KV label="User" value={state.user_name} />
                <KV label="Last Topic" value={state.last_topic} />
                <KV label="Greeted" value={state.greeted_this_session ? "Yes" : "No"} />
                <KV label="Returning" value={state.is_returning ? "Yes" : "No"} />
                <KV label="Last Suggestion" value={state.last_suggested_topic} highlight />
                {state.zep_facts && state.zep_facts.length > 0 && (
                  <div className="mt-1">
                    <span className="text-gray-500">Facts: </span>
                    <span className="text-yellow-300">{state.zep_facts.join(", ")}</span>
                  </div>
                )}
              </Section>
            ))}
            {Object.keys(debugData.session_states).length === 0 && (
              <p className="text-gray-500">No active sessions</p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-800 rounded p-2">
      <h3 className="text-gray-400 text-[10px] uppercase tracking-wide mb-1">{title}</h3>
      {children}
    </div>
  );
}

function KV({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500">{label}:</span>
      <span className={highlight ? "text-cyan-300" : "text-white"}>{value}</span>
    </div>
  );
}
