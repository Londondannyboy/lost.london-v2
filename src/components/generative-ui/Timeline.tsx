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

export function Timeline({ era, events }: TimelineProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-stone-200">
      <div className="p-4 bg-amber-50 border-b border-amber-100">
        <h3 className="font-semibold text-lg text-stone-800">{era}</h3>
        <p className="text-stone-600 text-sm">{events.length} key events</p>
      </div>
      <div className="p-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-amber-200" />

          {/* Events */}
          <div className="space-y-6">
            {events.map((event, index) => (
              <div key={index} className="relative pl-10">
                {/* Timeline dot */}
                <div className="absolute left-2 w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow" />

                <div className="bg-stone-50 rounded-lg p-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-amber-700 font-bold">{event.year}</span>
                    <span className="font-semibold text-stone-800">{event.title}</span>
                  </div>
                  <p className="text-stone-600 text-sm">{event.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
