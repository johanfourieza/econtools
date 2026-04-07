import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CoAuthorLink {
  source: string;
  target: string;
  weight: number;
}

interface CoAuthorNetworkGraphProps {
  links: CoAuthorLink[];
  uniqueAuthors: Set<string> | number;
}

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

interface Edge {
  source: string;
  target: string;
  weight: number;
}

// Generate a consistent color based on author name
function getAuthorColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

export function CoAuthorNetworkGraph({ links, uniqueAuthors }: CoAuthorNetworkGraphProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animationRef = useRef<number>();
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Build nodes and edges from co-author links
  const { nodes, edges, maxConnections } = useMemo(() => {
    const authorSet = new Set<string>();
    
    // Collect all unique authors from links
    links.forEach(link => {
      authorSet.add(link.source);
      authorSet.add(link.target);
    });

    // Create connection counts
    const connectionCount: Record<string, number> = {};
    links.forEach(link => {
      connectionCount[link.source] = (connectionCount[link.source] || 0) + link.weight;
      connectionCount[link.target] = (connectionCount[link.target] || 0) + link.weight;
    });

    const maxConn = Math.max(...Object.values(connectionCount), 1);

    // Initialize nodes with random positions
    const graphNodes: Node[] = Array.from(authorSet).map(author => ({
      id: author,
      x: Math.random() * 400 - 200,
      y: Math.random() * 300 - 150,
      vx: 0,
      vy: 0,
      connections: connectionCount[author] || 1,
    }));

    const graphEdges: Edge[] = links.map(link => ({
      source: link.source,
      target: link.target,
      weight: link.weight,
    }));

    return { nodes: graphNodes, edges: graphEdges, maxConnections: maxConn };
  }, [links]);

  // Reset simulation
  const resetSimulation = useCallback(() => {
    nodesRef.current = nodes.map(n => ({
      ...n,
      x: Math.random() * 400 - 200,
      y: Math.random() * 300 - 150,
      vx: 0,
      vy: 0,
    }));
    edgesRef.current = [...edges];
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [nodes, edges]);

  // Initialize nodes
  useEffect(() => {
    nodesRef.current = nodes.map(n => ({ ...n }));
    edgesRef.current = [...edges];
  }, [nodes, edges]);

  // Force simulation and rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodeMap = new Map<string, Node>();

    const simulate = () => {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      
      // Update node map
      nodeMap.clear();
      currentNodes.forEach(n => nodeMap.set(n.id, n));

      // Apply forces
      const repulsion = 2000;
      const attraction = 0.01;
      const damping = 0.9;
      const centerForce = 0.01;

      // Repulsion between nodes
      for (let i = 0; i < currentNodes.length; i++) {
        for (let j = i + 1; j < currentNodes.length; j++) {
          const a = currentNodes[i];
          const b = currentNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Attraction along edges
      currentEdges.forEach(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = dist * attraction * edge.weight;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        source.vx += fx;
        source.vy += fy;
        target.vx -= fx;
        target.vy -= fy;
      });

      // Center force
      currentNodes.forEach(node => {
        node.vx -= node.x * centerForce;
        node.vy -= node.y * centerForce;
      });

      // Update positions
      currentNodes.forEach(node => {
        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;
      });

      // Render
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      
      ctx.save();
      ctx.translate(width / 2 + pan.x, height / 2 + pan.y);
      ctx.scale(zoom, zoom);

      // Draw edges
      const maxWeight = Math.max(...currentEdges.map(e => e.weight), 1);
      currentEdges.forEach(edge => {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) return;
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = 'rgba(120, 120, 120, 0.4)';
        ctx.lineWidth = Math.max(0.5, (edge.weight / maxWeight) * 3);
        ctx.stroke();
      });

      // Draw nodes
      currentNodes.forEach(node => {
        const radius = Math.max(4, Math.min(15, (node.connections / maxConnections) * 12 + 4));
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = getAuthorColor(node.id);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Draw labels
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      currentNodes.forEach(node => {
        const radius = Math.max(4, Math.min(15, (node.connections / maxConnections) * 12 + 4));
        ctx.fillStyle = 'hsl(var(--foreground))';
        
        // Truncate long names
        let label = node.id;
        if (label.length > 15) {
          label = label.substring(0, 12) + '...';
        }
        ctx.fillText(label, node.x, node.y + radius + 3);
      });

      ctx.restore();

      animationRef.current = requestAnimationFrame(simulate);
    };

    simulate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes.length, zoom, pan, maxConnections]);

  // Mouse handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  if (links.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        No co-author connections to visualize
      </div>
    );
  }

  const containerHeight = isExpanded ? 400 : 250;

  return (
    <div className="relative">
      {/* Controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={resetSimulation}
          title="Reset view"
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(z => Math.min(z * 1.2, 3))}
          title="Zoom in"
        >
          <ZoomIn className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setZoom(z => Math.max(z / 1.2, 0.3))}
          title="Zoom out"
        >
          <ZoomOut className="h-3 w-3" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsExpanded(!isExpanded)}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
      </div>

      {/* Canvas Graph */}
      <div 
        className="rounded-lg overflow-hidden border border-border bg-background/50"
        style={{ height: containerHeight }}
      >
        <canvas
          ref={canvasRef}
          width={600}
          height={containerHeight}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Node size = collaboration frequency • Edge thickness = shared papers</span>
        <span>{nodes.length} authors • {edges.length} connections</span>
      </div>
    </div>
  );
}
