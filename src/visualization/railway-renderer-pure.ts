/**
 * Purpose: Pure functional railway visualization renderer
 * Dependencies: D3.js for SVG generation, Effect node types
 * 
 * Example Input:
 * ```
 * renderRailway(analysisResult, { width: 1200, height: 800 })
 * ```
 * 
 * Expected Output:
 * ```
 * { renderInstructions: [...], eventHandlers: {...}, state: {...} }
 * ```
 */

import type { AnalysisResult, EffectNode, NodeType, EdgeType } from '../types/effect-node.js';

// Rendering configuration
export interface RenderConfig {
  width: number;
  height: number;
  theme?: 'light' | 'dark';
  showLabels?: boolean;
  showMetrics?: boolean;
}

// Render instruction types
export type RenderInstruction = 
  | SvgElementInstruction
  | GroupInstruction
  | PathInstruction
  | TextInstruction
  | CircleInstruction
  | RectInstruction
  | MarkerInstruction
  | PatternInstruction;

export interface SvgElementInstruction {
  type: 'svg-element';
  tag: string;
  attributes: Record<string, string | number>;
  children?: RenderInstruction[];
  id?: string;
}

export interface GroupInstruction {
  type: 'group';
  className: string;
  transform?: string;
  children: RenderInstruction[];
}

export interface PathInstruction {
  type: 'path';
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  markerEnd?: string;
  opacity?: number;
  className?: string;
}

export interface TextInstruction {
  type: 'text';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  textAnchor?: 'start' | 'middle' | 'end';
  fontWeight?: string;
  dy?: string;
}

export interface CircleInstruction {
  type: 'circle';
  cx: number;
  cy: number;
  r: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  className?: string;
}

export interface RectInstruction {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  rx?: number;
  opacity?: number;
}

export interface MarkerInstruction {
  type: 'marker';
  id: string;
  viewBox: string;
  refX: number;
  refY: number;
  markerWidth: number;
  markerHeight: number;
  orient: string;
  path: PathInstruction;
}

export interface PatternInstruction {
  type: 'pattern';
  id: string;
  width: number;
  height: number;
  children: RenderInstruction[];
}

// Event handler definitions
export interface EventHandlers {
  onNodeClick?: (node: EffectNode) => void;
  onNodeHover?: (node: EffectNode | null) => void;
  onEdgeClick?: (edge: EdgeData) => void;
  onEdgeHover?: (edge: EdgeData | null) => void;
  onZoom?: (scale: number, x: number, y: number) => void;
}

// Visualization state
export interface VisualizationState {
  nodes: NodePosition[];
  edges: EdgeData[];
  layers: LayerInfo[];
  metrics: RailwayMetrics;
  selectedNode?: string;
  highlightedPath?: string[];
  zoomLevel: number;
  panX: number;
  panY: number;
}

export interface NodePosition {
  node: EffectNode;
  x: number;
  y: number;
  layer: number;
  column: number;
  isEntryPoint: boolean;
  radius: number;
  color: string;
  icon: string;
}

export interface EdgeData {
  source: string;
  target: string;
  type: EdgeType;
  path: string;
  color: string;
  isHighlighted: boolean;
}

export interface LayerInfo {
  type: NodeType;
  y: number;
  nodeCount: number;
  color: string;
  label: string;
}

export interface RailwayMetrics {
  totalNodes: number;
  totalEdges: number;
  entryPoints: number;
  criticalPaths: number;
  maxDepth: number;
  avgDependencies: number;
}

// Color schemes
const NODE_COLORS: Record<NodeType, string> = {
  controller: '#8B5CF6',
  service: '#3B82F6',
  repository: '#10B981',
  middleware: '#F59E0B',
  worker: '#EF4444',
  utility: '#6B7280',
  error: '#DC2626'
};

const EDGE_COLORS: Record<EdgeType, string> = {
  success: '#10B981',
  error: '#EF4444',
  dependency: '#94A3B8',
  pipe: '#3B82F6'
};

const NODE_ICONS: Record<NodeType, string> = {
  controller: '⚡',
  service: '⚙️',
  repository: '💾',
  middleware: '🔗',
  worker: '👷',
  utility: '🔧',
  error: '⚠️'
};

// Pure function to calculate node positions
const calculateNodePositions = (
  nodes: EffectNode[],
  edges: Array<{ source: string; target: string; type: EdgeType }>,
  width: number,
  height: number,
  entryPoints: string[]
): NodePosition[] => {
  // Build dependency graph
  const dependencyMap = new Map<string, Set<string>>();
  const reverseDependencyMap = new Map<string, Set<string>>();
  
  edges.forEach(edge => {
    if (!dependencyMap.has(edge.source)) {
      dependencyMap.set(edge.source, new Set());
    }
    dependencyMap.get(edge.source)!.add(edge.target);
    
    if (!reverseDependencyMap.has(edge.target)) {
      reverseDependencyMap.set(edge.target, new Set());
    }
    reverseDependencyMap.get(edge.target)!.add(edge.source);
  });
  
  // Calculate layers (topological sort)
  const layers = new Map<string, number>();
  const visited = new Set<string>();
  const calculateLayer = (nodeId: string): number => {
    if (layers.has(nodeId)) return layers.get(nodeId)!;
    if (visited.has(nodeId)) return 0; // Cycle detected
    
    visited.add(nodeId);
    const deps = reverseDependencyMap.get(nodeId) || new Set();
    const maxDepLayer = deps.size === 0 ? -1 : 
      Math.max(...Array.from(deps).map(dep => calculateLayer(dep)));
    
    const layer = maxDepLayer + 1;
    layers.set(nodeId, layer);
    return layer;
  };
  
  nodes.forEach(node => calculateLayer(node.id));
  
  // Group nodes by layer
  const layerGroups = new Map<number, EffectNode[]>();
  nodes.forEach(node => {
    const layer = layers.get(node.id) || 0;
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, []);
    }
    layerGroups.get(layer)!.push(node);
  });
  
  // Calculate positions
  const positions: NodePosition[] = [];
  const layerCount = Math.max(...Array.from(layerGroups.keys())) + 1;
  const layerHeight = height / (layerCount + 1);
  
  layerGroups.forEach((layerNodes, layer) => {
    const columnWidth = width / (layerNodes.length + 1);
    layerNodes.forEach((node, index) => {
      positions.push({
        node,
        x: columnWidth * (index + 1),
        y: layerHeight * (layer + 1),
        layer,
        column: index,
        isEntryPoint: entryPoints.includes(node.id),
        radius: getNodeRadius(node.type),
        color: NODE_COLORS[node.type] || '#6B7280',
        icon: NODE_ICONS[node.type] || '?'
      });
    });
  });
  
  return positions;
};

// Pure function to get node radius
const getNodeRadius = (type: NodeType): number => {
  const radiusMap: Record<NodeType, number> = {
    controller: 20,
    service: 18,
    repository: 16,
    middleware: 15,
    worker: 15,
    utility: 14,
    error: 14
  };
  return radiusMap[type] || 14;
};

// Pure function to calculate edge paths
const calculateEdgePaths = (
  edges: Array<{ source: string; target: string; type: EdgeType }>,
  nodePositions: NodePosition[]
): EdgeData[] => {
  const positionMap = new Map<string, NodePosition>();
  nodePositions.forEach(pos => positionMap.set(pos.node.id, pos));
  
  return edges.map(edge => {
    const sourcePos = positionMap.get(edge.source);
    const targetPos = positionMap.get(edge.target);
    
    if (!sourcePos || !targetPos) {
      return {
        source: edge.source,
        target: edge.target,
        type: edge.type,
        path: '',
        color: EDGE_COLORS[edge.type] || '#CBD5E1',
        isHighlighted: false
      };
    }
    
    // Calculate curved path
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const dr = Math.sqrt(dx * dx + dy * dy);
    
    const path = `M${sourcePos.x},${sourcePos.y} A${dr},${dr} 0 0,1 ${targetPos.x},${targetPos.y}`;
    
    return {
      source: edge.source,
      target: edge.target,
      type: edge.type,
      path,
      color: EDGE_COLORS[edge.type] || '#CBD5E1',
      isHighlighted: false
    };
  });
};

// Pure function to calculate railway metrics
const calculateMetrics = (
  nodes: EffectNode[],
  edges: Array<{ source: string; target: string; type: EdgeType }>,
  entryPoints: string[]
): RailwayMetrics => {
  const dependencyCount = new Map<string, number>();
  edges.forEach(edge => {
    dependencyCount.set(edge.source, (dependencyCount.get(edge.source) || 0) + 1);
  });
  
  const avgDependencies = nodes.length > 0 
    ? Array.from(dependencyCount.values()).reduce((a, b) => a + b, 0) / nodes.length
    : 0;
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    entryPoints: entryPoints.length,
    criticalPaths: 0, // Would need path analysis
    maxDepth: 0, // Would need depth calculation
    avgDependencies: Math.round(avgDependencies * 10) / 10
  };
};

// Pure function to generate render instructions for nodes
const generateNodeInstructions = (positions: NodePosition[]): RenderInstruction[] => {
  return positions.map(pos => ({
    type: 'group' as const,
    className: 'node',
    transform: `translate(${pos.x},${pos.y})`,
    children: [
      {
        type: 'circle' as const,
        cx: 0,
        cy: 0,
        r: pos.radius,
        fill: pos.isEntryPoint ? pos.color : lightenColor(pos.color, 0.1),
        stroke: pos.color,
        strokeWidth: pos.isEntryPoint ? 3 : 2,
        className: `node-circle node-${pos.node.type}`
      },
      {
        type: 'text' as const,
        text: pos.icon,
        x: 0,
        y: 0,
        fontSize: 10,
        fill: '#ffffff',
        textAnchor: 'middle',
        fontWeight: 'bold',
        dy: '0.35em'
      },
      {
        type: 'text' as const,
        text: truncateText(pos.node.name, 12),
        x: 0,
        y: pos.radius + 12,
        fontSize: 8,
        fill: pos.color,
        textAnchor: 'middle',
        fontWeight: '600'
      }
    ]
  }));
};

// Pure function to generate render instructions for edges
const generateEdgeInstructions = (edges: EdgeData[]): RenderInstruction[] => {
  return edges.filter(edge => edge.path).map(edge => ({
    type: 'path' as const,
    d: edge.path,
    stroke: edge.color,
    strokeWidth: edge.isHighlighted ? 3 : 2,
    fill: 'none',
    markerEnd: `url(#arrow-${edge.type})`,
    opacity: edge.isHighlighted ? 1 : 0.7,
    className: `edge edge-${edge.type}`
  }));
};

// Pure function to generate marker definitions
const generateMarkerDefinitions = (): RenderInstruction[] => {
  return Object.entries(EDGE_COLORS).map(([type, color]) => ({
    type: 'marker' as const,
    id: `arrow-${type}`,
    viewBox: '0 -3 6 6',
    refX: 12,
    refY: 0,
    markerWidth: 5,
    markerHeight: 5,
    orient: 'auto',
    path: {
      type: 'path' as const,
      d: 'M0,-3L6,0L0,3',
      stroke: 'none',
      strokeWidth: 0,
      fill: color
    }
  }));
};

// Helper function to lighten color
const lightenColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent * 100);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
};

// Helper function to truncate text
const truncateText = (text: string, maxLength: number): string => {
  return text.length > maxLength ? text.substring(0, maxLength - 2) + '..' : text;
};

// Main pure function to render railway visualization
export const renderRailway = (
  data: AnalysisResult,
  config: RenderConfig
): {
  instructions: RenderInstruction[];
  state: VisualizationState;
  handlers: EventHandlers;
} => {
  // Calculate positions
  const nodePositions = calculateNodePositions(
    data.railway.nodes,
    data.railway.edges,
    config.width,
    config.height,
    data.railway.entryPoints
  );
  
  // Calculate edges
  const edgePaths = calculateEdgePaths(data.railway.edges, nodePositions);
  
  // Calculate metrics
  const metrics = calculateMetrics(
    data.railway.nodes,
    data.railway.edges,
    data.railway.entryPoints
  );
  
  // Generate render instructions
  const instructions: RenderInstruction[] = [
    {
      type: 'svg-element',
      tag: 'defs',
      attributes: {},
      children: generateMarkerDefinitions()
    },
    {
      type: 'group',
      className: 'edges',
      children: generateEdgeInstructions(edgePaths)
    },
    {
      type: 'group',
      className: 'nodes',
      children: generateNodeInstructions(nodePositions)
    }
  ];
  
  // Build state
  const state: VisualizationState = {
    nodes: nodePositions,
    edges: edgePaths,
    layers: [],
    metrics,
    zoomLevel: 1,
    panX: 0,
    panY: 0
  };
  
  // Define event handlers (pure functions that return new state)
  const handlers: EventHandlers = {
    onNodeClick: (_node: EffectNode) => {
      // Return action to handle node click
    },
    onNodeHover: (_node: EffectNode | null) => {
      // Return action to handle node hover
    },
    onZoom: (_scale: number, _x: number, _y: number) => {
      // Return new zoom state
    }
  };
  
  return {
    instructions,
    state,
    handlers
  };
};

// Pure function to filter visualization
export const filterVisualization = (
  state: VisualizationState,
  filterType: 'all' | NodeType,
  searchTerm?: string
): VisualizationState => {
  const filteredNodes = state.nodes.filter(pos => {
    const matchesType = filterType === 'all' || pos.node.type === filterType;
    const matchesSearch = !searchTerm || 
      pos.node.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });
  
  const filteredNodeIds = new Set(filteredNodes.map(n => n.node.id));
  const filteredEdges = state.edges.filter(edge => 
    filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
  );
  
  return {
    ...state,
    nodes: filteredNodes,
    edges: filteredEdges
  };
};

// Pure function to highlight path
export const highlightPath = (
  state: VisualizationState,
  nodeId: string,
  direction: 'upstream' | 'downstream' | 'both'
): VisualizationState => {
  const highlightedNodes = new Set<string>();
  const highlightedEdges = new Set<string>();
  
  // Build edge maps
  const upstreamMap = new Map<string, Set<string>>();
  const downstreamMap = new Map<string, Set<string>>();
  
  state.edges.forEach(edge => {
    if (!downstreamMap.has(edge.source)) {
      downstreamMap.set(edge.source, new Set());
    }
    downstreamMap.get(edge.source)!.add(edge.target);
    
    if (!upstreamMap.has(edge.target)) {
      upstreamMap.set(edge.target, new Set());
    }
    upstreamMap.get(edge.target)!.add(edge.source);
  });
  
  // Traverse graph
  const traverse = (
    id: string,
    map: Map<string, Set<string>>,
    visited: Set<string>
  ) => {
    if (visited.has(id)) return;
    visited.add(id);
    highlightedNodes.add(id);
    
    const connected = map.get(id) || new Set();
    connected.forEach(connectedId => {
      highlightedEdges.add(`${id}-${connectedId}`);
      traverse(connectedId, map, visited);
    });
  };
  
  highlightedNodes.add(nodeId);
  
  if (direction === 'upstream' || direction === 'both') {
    traverse(nodeId, upstreamMap, new Set());
  }
  
  if (direction === 'downstream' || direction === 'both') {
    traverse(nodeId, downstreamMap, new Set());
  }
  
  // Update edge highlighting
  const updatedEdges = state.edges.map(edge => ({
    ...edge,
    isHighlighted: highlightedEdges.has(`${edge.source}-${edge.target}`)
  }));
  
  return {
    ...state,
    edges: updatedEdges,
    highlightedPath: Array.from(highlightedNodes)
  };
};

// Pure function to generate statistics
export const generateStatistics = (state: VisualizationState): Record<string, number> => {
  const stats: Record<string, number> = {
    'Total Nodes': state.metrics.totalNodes,
    'Total Edges': state.metrics.totalEdges,
    'Entry Points': state.metrics.entryPoints,
    'Avg Dependencies': state.metrics.avgDependencies
  };
  
  // Count by type
  const typeCounts = new Map<NodeType, number>();
  state.nodes.forEach(pos => {
    typeCounts.set(pos.node.type, (typeCounts.get(pos.node.type) || 0) + 1);
  });
  
  typeCounts.forEach((count, type) => {
    stats[`${type} nodes`] = count;
  });
  
  return stats;
};

// Pure function to export visualization data
export const exportVisualization = (
  state: VisualizationState,
  format: 'json' | 'svg' | 'png'
): string | Blob => {
  if (format === 'json') {
    return JSON.stringify({
      nodes: state.nodes.map(n => ({
        id: n.node.id,
        name: n.node.name,
        type: n.node.type,
        x: n.x,
        y: n.y
      })),
      edges: state.edges.map(e => ({
        source: e.source,
        target: e.target,
        type: e.type
      })),
      metrics: state.metrics
    }, null, 2);
  }
  
  // For SVG/PNG export, would need to generate complete SVG string
  return '';
};