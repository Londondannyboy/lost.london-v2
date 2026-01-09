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
}

export function Timeline({ events }: TimelineProps) {
  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-amber-300" />

      {/* Events - compact display */}
      <div className="space-y-3">
        {events.map((event, index) => (
          <div key={index} className="relative pl-8">
            {/* Timeline dot */}
            <div className="absolute left-1 top-1 w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-sm" />

            <div className="flex items-baseline gap-2">
              <span className="text-amber-700 font-bold text-sm">{event.year}</span>
              <span className="font-medium text-stone-800 text-sm">{event.title}</span>
            </div>
            <p className="text-stone-600 text-xs mt-0.5">{event.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
