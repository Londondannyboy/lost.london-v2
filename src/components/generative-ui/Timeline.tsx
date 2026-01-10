"use client";

interface TimelineEvent {
  year: number;
  title: string;
  description: string;
  article_id?: string | null;
}

interface TimelineProps {
  era: string;
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

export function Timeline({ era, events, onEventClick }: TimelineProps) {
  return (
    <div className="relative">
      {/* Timeline header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        </div>
        <span className="font-semibold text-amber-800">{era}</span>
      </div>

      {/* Timeline line */}
      <div className="absolute left-3 top-12 bottom-2 w-0.5 bg-gradient-to-b from-amber-400 to-amber-200" />

      {/* Events - clickable cards */}
      <div className="space-y-2">
        {events.map((event, index) => (
          <button
            key={index}
            onClick={() => onEventClick?.(event)}
            className={`
              relative pl-8 pr-3 py-2 w-full text-left rounded-lg
              ${onEventClick ? 'hover:bg-amber-50 cursor-pointer transition-colors' : ''}
              group
            `}
          >
            {/* Timeline dot */}
            <div className={`
              absolute left-1 top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm
              transition-all duration-200
              ${onEventClick ? 'bg-amber-400 group-hover:bg-amber-500 group-hover:scale-110' : 'bg-amber-500'}
            `} />

            <div className="flex items-baseline gap-2">
              <span className="text-amber-700 font-bold text-sm tabular-nums">{event.year}</span>
              <span className="font-medium text-stone-800 text-sm group-hover:text-amber-900 transition-colors">
                {event.title}
              </span>
            </div>
            <p className="text-stone-600 text-xs mt-0.5">{event.description}</p>

            {/* Click hint on hover */}
            {onEventClick && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-amber-600 font-medium">
                Ask VIC →
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
