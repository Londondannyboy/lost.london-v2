"use client";

interface LocationMapProps {
  location: {
    name: string;
    lat: number;
    lng: number;
    description?: string;
  };
}

export function LocationMap({ location }: LocationMapProps) {
  // Using OpenStreetMap embed for simplicity
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.01},${location.lat - 0.01},${location.lng + 0.01},${location.lat + 0.01}&layer=mapnik&marker=${location.lat},${location.lng}`;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-stone-200">
      <div className="p-4 border-b border-stone-100">
        <h3 className="font-semibold text-lg text-stone-800">{location.name}</h3>
        {location.description && (
          <p className="text-stone-600 text-sm mt-1">{location.description}</p>
        )}
      </div>
      <div className="h-64 w-full">
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          loading="lazy"
          title={`Map of ${location.name}`}
        />
      </div>
      <div className="p-3 bg-stone-50 text-xs text-stone-500">
        Coordinates: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
      </div>
    </div>
  );
}
