'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph3D to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center bg-gray-900 rounded-lg">
      <div className="text-white/50">Loading 3D graph...</div>
    </div>
  ),
});

interface Interest {
  topic: string;
  count: number;
}

interface ZepFact {
  fact: string;
  source?: string;
  timestamp?: string;
}

interface InterestGraph3DProps {
  interests: Interest[];
  facts?: ZepFact[] | string[];
  userName?: string;
  onClearHistory?: () => void;
}

interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  type: 'user' | 'topic' | 'era' | 'location';
}

interface GraphLink {
  source: string;
  target: string;
  value: number;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export function InterestGraph3D({ interests, facts = [], userName, onClearHistory }: InterestGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });

  // Build graph data from interests and facts
  useEffect(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeMap = new Map<string, boolean>();

    // Central user node
    const userId = 'user-center';
    nodes.push({
      id: userId,
      name: userName || 'You',
      val: 30,
      color: '#f59e0b', // Amber
      type: 'user',
    });
    nodeMap.set(userId, true);

    // Add interest nodes
    const maxCount = Math.max(...interests.map(i => i.count), 1);
    interests.forEach((interest, i) => {
      const nodeId = `topic-${i}`;
      if (!nodeMap.has(interest.topic)) {
        nodes.push({
          id: nodeId,
          name: interest.topic,
          val: 10 + (interest.count / maxCount) * 20,
          color: getTopicColor(interest.topic),
          type: 'topic',
        });
        nodeMap.set(interest.topic, true);

        // Link to user
        links.push({
          source: userId,
          target: nodeId,
          value: interest.count,
        });
      }
    });

    // Parse facts to extract entities and relationships
    const factsArray = facts.map(f => typeof f === 'string' ? f : f.fact);
    factsArray.forEach((fact, i) => {
      if (!fact) return;

      // Extract eras (Victorian, Georgian, Tudor, etc.)
      const eraMatch = fact.match(/(Victorian|Georgian|Tudor|Elizabethan|Medieval|Roman|Stuart|Edwardian)/i);
      if (eraMatch) {
        const era = eraMatch[1];
        const eraId = `era-${era.toLowerCase()}`;
        if (!nodeMap.has(eraId)) {
          nodes.push({
            id: eraId,
            name: era,
            val: 15,
            color: '#8b5cf6', // Purple for eras
            type: 'era',
          });
          nodeMap.set(eraId, true);
          links.push({
            source: userId,
            target: eraId,
            value: 1,
          });
        }
      }

      // Extract locations (Westminster, Southwark, etc.)
      const locationMatch = fact.match(/(Westminster|Southwark|City of London|Tower|Bankside|Mayfair|Chelsea|Lambeth|Greenwich|Bloomsbury|Covent Garden|Whitechapel|Spitalfields)/i);
      if (locationMatch) {
        const location = locationMatch[1];
        const locId = `loc-${location.toLowerCase().replace(/\s+/g, '-')}`;
        if (!nodeMap.has(locId)) {
          nodes.push({
            id: locId,
            name: location,
            val: 12,
            color: '#10b981', // Green for locations
            type: 'location',
          });
          nodeMap.set(locId, true);
          links.push({
            source: userId,
            target: locId,
            value: 1,
          });
        }
      }
    });

    setGraphData({ nodes, links });
  }, [interests, facts, userName]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 400,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Could navigate to topic or show details
    console.log('Clicked node:', node);
  }, []);

  if (interests.length === 0 && (!facts || facts.length === 0)) {
    return null;
  }

  return (
    <div className="bg-gray-900 rounded-xl overflow-hidden mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h2 className="font-serif font-bold text-white text-lg flex items-center gap-2">
          <span className="text-xl">🌐</span> Your Knowledge Graph
        </h2>
        {onClearHistory && (
          <button
            onClick={onClearHistory}
            className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded border border-red-800 hover:border-red-600 transition-colors"
          >
            Clear History
          </button>
        )}
      </div>

      {/* 3D Graph */}
      <div ref={containerRef} className="h-[400px] bg-gray-900">
        <ForceGraph3D
          graphData={graphData}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#111827"
          nodeLabel={(node: any) => `${node.name}${node.type !== 'user' ? ` (${node.type})` : ''}`}
          nodeColor={(node: any) => node.color}
          nodeVal={(node: any) => node.val}
          nodeOpacity={0.9}
          linkColor={() => 'rgba(255,255,255,0.2)'}
          linkWidth={1}
          linkOpacity={0.4}
          onNodeClick={(node: any) => handleNodeClick(node as GraphNode)}
          enableNodeDrag={true}
          enableNavigationControls={true}
          showNavInfo={false}
        />
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-gray-400">You</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-stone-500" />
          <span className="text-gray-400">Topics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-gray-400">Eras</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-gray-400">Locations</span>
        </div>
      </div>
    </div>
  );
}

// Helper: Assign colors based on topic category
function getTopicColor(topic: string): string {
  const lower = topic.toLowerCase();

  // Places
  if (/palace|abbey|tower|bridge|station|building|house|hall/i.test(lower)) {
    return '#78716c'; // Stone
  }

  // Events/History
  if (/war|battle|fire|plague|coronation|execution/i.test(lower)) {
    return '#dc2626'; // Red
  }

  // People
  if (/king|queen|lord|sir|prince|princess|duke/i.test(lower)) {
    return '#7c3aed'; // Purple
  }

  // Rivers/Water
  if (/river|fleet|thames|tyburn|walbrook/i.test(lower)) {
    return '#0ea5e9'; // Blue
  }

  // Entertainment
  if (/theatre|music|hall|pleasure|garden|aquarium/i.test(lower)) {
    return '#f97316'; // Orange
  }

  // Default stone color
  return '#78716c';
}
