'use client';

interface Interest {
  topic: string;
  count: number;
}

interface InterestGraphProps {
  interests: Interest[];
  userName?: string;
}

export function InterestGraph({ interests, userName }: InterestGraphProps) {
  if (interests.length === 0) {
    return null;
  }

  // Calculate sizes based on count
  const maxCount = Math.max(...interests.map(i => i.count));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
      <h2 className="font-serif font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
        <span>🕸️</span> Your Interest Graph
      </h2>

      {/* Visual graph representation */}
      <div className="relative bg-gradient-to-br from-stone-50 to-amber-50 rounded-lg p-8 min-h-[300px]">
        {/* Center node - User */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center text-white font-bold shadow-lg border-4 border-white">
            {userName ? userName[0].toUpperCase() : 'You'}
          </div>
          <div className="text-center mt-1 text-sm font-medium text-gray-700">
            {userName || 'You'}
          </div>
        </div>

        {/* Interest nodes arranged in a circle */}
        {interests.slice(0, 8).map((interest, i) => {
          const total = Math.min(interests.length, 8);
          const angle = (i * 360) / total - 90; // Start from top
          const radius = 120; // Distance from center
          const x = Math.cos((angle * Math.PI) / 180) * radius;
          const y = Math.sin((angle * Math.PI) / 180) * radius;

          // Size based on count
          const size = 40 + (interest.count / maxCount) * 30;

          return (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
              }}
            >
              {/* Connection line */}
              <svg
                className="absolute left-1/2 top-1/2 -z-10"
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  transform: `translate(-${radius}px, -${radius}px)`,
                }}
              >
                <line
                  x1={radius}
                  y1={radius}
                  x2={radius - x}
                  y2={radius - y}
                  stroke="#d4a574"
                  strokeWidth="2"
                  strokeDasharray="4"
                  opacity="0.5"
                />
              </svg>

              {/* Interest node */}
              <div
                className="rounded-full bg-stone-700 flex items-center justify-center text-white text-xs font-medium shadow-md hover:scale-110 transition-transform cursor-pointer"
                style={{ width: size, height: size }}
                title={`${interest.topic} (${interest.count} mentions)`}
              >
                <span className="text-center px-1 leading-tight truncate">
                  {interest.topic.length > 10 ? interest.topic.slice(0, 8) + '...' : interest.topic}
                </span>
              </div>

              {/* Count badge */}
              {interest.count > 1 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                  {interest.count}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span>You</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-stone-700" />
          <span>Topics discussed</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-amber-500">— —</span>
          <span>Connection</span>
        </div>
      </div>
    </div>
  );
}
