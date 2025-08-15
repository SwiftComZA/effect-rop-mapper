/**
 * Purpose: Pure functional logical request flow layout
 * Dependencies: None (pure functions)
 * 
 * Example Input:
 * ```
 * calculateLogicalFlowLayout(railway, 1200, 800)
 * ```
 * 
 * Expected Output:
 * ```
 * Positioned nodes showing actual request flow through layers
 * ```
 */

import type { EffectNode, EffectEdge, EffectRailway } from '../types/effect-node.js';

export interface LogicalPosition {
  x: number;
  y: number;
  layer: number;
  position: number;
}

export interface LogicalFlowConfig {
  baseLayerWidth?: number;
  minColumnWidth?: number;
  layerPadding?: number;
  nodeHeight?: number;
  nodePadding?: number;
  minNodeSpacing?: number;
  maxNodesPerColumn?: number;
  maxColumnsPerLayer?: number;
}

export interface LogicalLayer {
  key: string;
  name: string;
  types: string[];
  color: string;
}

export interface LogicalFlowMetrics {
  layerCount: number;
  totalColumns: number;
  averageNodesPerLayer: number;
  maxNodesInLayer: number;
  flowComplexity: number;
}

// Default configuration
const DEFAULT_CONFIG: Required<LogicalFlowConfig> = {
  baseLayerWidth: 250,
  minColumnWidth: 120,
  layerPadding: 100,
  nodeHeight: 45,
  nodePadding: 15,
  minNodeSpacing: 35,
  maxNodesPerColumn: 15,
  maxColumnsPerLayer: 8
};

// Pure function to format layer name
const formatLayerName = (type: string): string => {
  // Convert snake_case or kebab-case to Title Case
  return type
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
};

// Pure function to get color for type
const getColorForType = (type: string): string => {
  const colorMap: Record<string, string> = {
    controller: '#8B5CF6',
    service: '#3B82F6',
    repository: '#10B981',
    middleware: '#F59E0B',
    worker: '#EF4444',
    utility: '#6B7280',
    error: '#DC2626'
  };
  
  // Generate a color based on string hash if not in map
  if (!colorMap[type]) {
    const hash = type.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  }
  
  return colorMap[type];
};

// Pure function to build dynamic layers
const buildDynamicLayers = (nodes: EffectNode[]): LogicalLayer[] => {
  // Calculate average dependencies for each type
  const typeStats = new Map<string, { count: number; totalDeps: number; avgDeps: number }>();
  
  nodes.forEach(node => {
    const stats = typeStats.get(node.type) || { count: 0, totalDeps: 0, avgDeps: 0 };
    const nodeDeps = (node.metrics?.callsCount || 0);
    stats.count++;
    stats.totalDeps += nodeDeps;
    stats.avgDeps = stats.totalDeps / stats.count;
    typeStats.set(node.type, stats);
  });
  
  // Sort types by average dependencies (least to most)
  const sortedTypes = Array.from(typeStats.keys()).sort((a, b) => {
    const aStats = typeStats.get(a)!;
    const bStats = typeStats.get(b)!;
    
    // Primary sort: by average dependencies (ascending)
    if (aStats.avgDeps !== bStats.avgDeps) {
      return aStats.avgDeps - bStats.avgDeps;
    }
    
    // Secondary sort: by total dependencies
    if (aStats.totalDeps !== bStats.totalDeps) {
      return aStats.totalDeps - bStats.totalDeps;
    }
    
    // Tertiary sort: alphabetically
    return a.localeCompare(b);
  });
  
  // Create layers for each type with nodes
  return sortedTypes.map(type => ({
    key: type,
    name: formatLayerName(type),
    types: [type],
    color: getColorForType(type)
  }));
};

// Pure function to assign nodes to layers
const assignNodesToLayers = (
  nodes: EffectNode[],
  layers: LogicalLayer[]
): Map<number, EffectNode[]> => {
  const layerNodes = new Map<number, EffectNode[]>();
  
  // Initialize all layers
  layers.forEach((_, index) => {
    layerNodes.set(index, []);
  });
  
  // Assign nodes to layers based on type
  nodes.forEach(node => {
    const layerIndex = layers.findIndex(layer => 
      layer.types.includes(node.type)
    );
    
    if (layerIndex !== -1) {
      const currentNodes = layerNodes.get(layerIndex) || [];
      layerNodes.set(layerIndex, [...currentNodes, node]);
    }
  });
  
  return layerNodes;
};

// Pure function to sort nodes within layers
const sortNodesInLayers = (
  layerNodes: Map<number, EffectNode[]>,
  edges: EffectEdge[]
): Map<number, EffectNode[]> => {
  const sortedLayers = new Map<number, EffectNode[]>();
  
  // Build dependency graph
  const dependencyCount = new Map<string, number>();
  const dependentCount = new Map<string, number>();
  
  edges.forEach(edge => {
    dependencyCount.set(edge.source, (dependencyCount.get(edge.source) || 0) + 1);
    dependentCount.set(edge.target, (dependentCount.get(edge.target) || 0) + 1);
  });
  
  // Sort each layer
  layerNodes.forEach((nodes, layer) => {
    const sorted = [...nodes].sort((a, b) => {
      // Primary: Entry points first
      const aIsEntry = dependentCount.get(a.id) === 0;
      const bIsEntry = dependentCount.get(b.id) === 0;
      if (aIsEntry !== bIsEntry) return aIsEntry ? -1 : 1;
      
      // Secondary: By number of dependents (most dependents first)
      const aDeps = dependentCount.get(a.id) || 0;
      const bDeps = dependentCount.get(b.id) || 0;
      if (aDeps !== bDeps) return bDeps - aDeps;
      
      // Tertiary: By name
      return a.name.localeCompare(b.name);
    });
    
    sortedLayers.set(layer, sorted);
  });
  
  return sortedLayers;
};

// Pure function to calculate multi-column layout
const calculateMultiColumnLayout = (
  nodes: EffectNode[],
  layerWidth: number,
  config: Required<LogicalFlowConfig>
): { columns: EffectNode[][]; columnWidth: number } => {
  const totalNodes = nodes.length;
  
  // Calculate number of columns needed
  const columnsNeeded = Math.min(
    Math.ceil(totalNodes / config.maxNodesPerColumn),
    config.maxColumnsPerLayer
  );
  
  // Calculate nodes per column
  const nodesPerColumn = Math.ceil(totalNodes / columnsNeeded);
  const columnWidth = Math.max(
    layerWidth / columnsNeeded,
    config.minColumnWidth
  );
  
  // Distribute nodes into columns
  const columns: EffectNode[][] = [];
  for (let i = 0; i < columnsNeeded; i++) {
    const start = i * nodesPerColumn;
    const end = Math.min(start + nodesPerColumn, totalNodes);
    columns.push(nodes.slice(start, end));
  }
  
  return { columns, columnWidth };
};

// Pure function to position nodes
const positionNodes = (
  layerNodes: Map<number, EffectNode[]>,
  layers: LogicalLayer[],
  width: number,
  height: number,
  config: Required<LogicalFlowConfig>
): Map<string, LogicalPosition> => {
  const positions = new Map<string, LogicalPosition>();
  
  // Calculate layer positions
  const totalLayers = layers.length;
  const layerSpacing = width / (totalLayers + 1);
  
  layerNodes.forEach((nodes, layerIndex) => {
    if (nodes.length === 0) return;
    
    // Calculate layer X position
    const layerX = config.layerPadding + (layerIndex * layerSpacing);
    const layerWidth = config.baseLayerWidth;
    
    // Calculate multi-column layout
    const { columns, columnWidth } = calculateMultiColumnLayout(
      nodes,
      layerWidth,
      config
    );
    
    // Position nodes in columns
    columns.forEach((columnNodes, columnIndex) => {
      const columnX = layerX + (columnIndex * columnWidth);
      
      // Calculate vertical spacing
      const availableHeight = height - (2 * config.nodePadding);
      const nodeSpacing = Math.max(
        config.minNodeSpacing,
        availableHeight / (columnNodes.length + 1)
      );
      
      columnNodes.forEach((node, nodeIndex) => {
        const y = config.nodePadding + ((nodeIndex + 1) * nodeSpacing);
        
        positions.set(node.id, {
          x: columnX,
          y,
          layer: layerIndex,
          position: nodeIndex + (columnIndex * config.maxNodesPerColumn)
        });
      });
    });
  });
  
  return positions;
};

// Pure function to apply positions to nodes
const applyPositionsToNodes = (
  nodes: EffectNode[],
  positions: Map<string, LogicalPosition>
): EffectNode[] => {
  return nodes.map(node => {
    const position = positions.get(node.id);
    if (position) {
      return {
        ...node,
        x: position.x,
        y: position.y
      };
    }
    return node;
  });
};

// Pure function to calculate flow paths
const calculateFlowPaths = (
  edges: EffectEdge[],
  positions: Map<string, LogicalPosition>
): Array<{ edge: EffectEdge; path: string }> => {
  return edges.map(edge => {
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    
    if (!sourcePos || !targetPos) {
      return { edge, path: '' };
    }
    
    // Create curved path for better visualization
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    const controlX = sourcePos.x + (dx / 2);
    const controlY = sourcePos.y + (dy / 2);
    
    const path = `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;
    
    return { edge, path };
  });
};

// Pure function to calculate metrics
const calculateMetrics = (
  layerNodes: Map<number, EffectNode[]>,
  edges: EffectEdge[],
  positions: Map<string, LogicalPosition>
): LogicalFlowMetrics => {
  const layerCount = layerNodes.size;
  let totalColumns = 0;
  let totalNodes = 0;
  let maxNodesInLayer = 0;
  
  layerNodes.forEach(nodes => {
    const nodeCount = nodes.length;
    totalNodes += nodeCount;
    maxNodesInLayer = Math.max(maxNodesInLayer, nodeCount);
    
    // Count columns in this layer
    const columnsInLayer = Math.ceil(nodeCount / DEFAULT_CONFIG.maxNodesPerColumn);
    totalColumns += columnsInLayer;
  });
  
  const averageNodesPerLayer = layerCount > 0 ? totalNodes / layerCount : 0;
  
  // Calculate flow complexity (number of cross-layer edges)
  let crossLayerEdges = 0;
  edges.forEach(edge => {
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    
    if (sourcePos && targetPos && Math.abs(targetPos.layer - sourcePos.layer) > 1) {
      crossLayerEdges++;
    }
  });
  
  const flowComplexity = edges.length > 0 ? crossLayerEdges / edges.length : 0;
  
  return {
    layerCount,
    totalColumns,
    averageNodesPerLayer: Math.round(averageNodesPerLayer * 10) / 10,
    maxNodesInLayer,
    flowComplexity: Math.round(flowComplexity * 100) / 100
  };
};

// Main pure function to calculate logical flow layout
export const calculateLogicalFlowLayout = (
  railway: EffectRailway,
  width: number,
  height: number,
  config?: LogicalFlowConfig
): {
  positions: Map<string, LogicalPosition>;
  nodes: EffectNode[];
  layers: LogicalLayer[];
  flowPaths: Array<{ edge: EffectEdge; path: string }>;
  metrics: LogicalFlowMetrics;
} => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Build dynamic layers
  const layers = buildDynamicLayers(railway.nodes);
  
  // Assign nodes to layers
  const layerNodes = assignNodesToLayers(railway.nodes, layers);
  
  // Sort nodes within layers
  const sortedLayerNodes = sortNodesInLayers(layerNodes, railway.edges);
  
  // Position nodes
  const positions = positionNodes(
    sortedLayerNodes,
    layers,
    width,
    height,
    finalConfig
  );
  
  // Apply positions to nodes
  const positionedNodes = applyPositionsToNodes(railway.nodes, positions);
  
  // Calculate flow paths
  const flowPaths = calculateFlowPaths(railway.edges, positions);
  
  // Calculate metrics
  const metrics = calculateMetrics(sortedLayerNodes, railway.edges, positions);
  
  return {
    positions,
    nodes: positionedNodes,
    layers,
    flowPaths,
    metrics
  };
};

// Pure function to get layer boundaries for rendering
export const getLayerBoundaries = (
  layer: LogicalLayer,
  layerIndex: number,
  positions: Map<string, LogicalPosition>,
  width: number,
  height: number
): {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
} => {
  // Find all positions in this layer
  const layerPositions: LogicalPosition[] = [];
  positions.forEach(pos => {
    if (pos.layer === layerIndex) {
      layerPositions.push(pos);
    }
  });
  
  if (layerPositions.length === 0) {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      color: layer.color,
      label: layer.name
    };
  }
  
  // Calculate bounding box
  const minX = Math.min(...layerPositions.map(p => p.x)) - 20;
  const maxX = Math.max(...layerPositions.map(p => p.x)) + 20;
  const minY = Math.min(...layerPositions.map(p => p.y)) - 20;
  const maxY = Math.max(...layerPositions.map(p => p.y)) + 20;
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    color: layer.color,
    label: layer.name
  };
};

// Pure function to optimize edge routing
export const optimizeEdgeRouting = (
  flowPaths: Array<{ edge: EffectEdge; path: string }>,
  positions: Map<string, LogicalPosition>
): Array<{ edge: EffectEdge; path: string }> => {
  return flowPaths.map(({ edge, path }) => {
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    
    if (!sourcePos || !targetPos) {
      return { edge, path };
    }
    
    // Use different curve types based on edge type
    let optimizedPath: string;
    
    if (edge.type === 'dependency') {
      // Straight line for dependencies
      optimizedPath = `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
    } else if (edge.type === 'error-handling') {
      // Curved path for error handling
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const controlX = sourcePos.x + (dx * 0.7);
      const controlY = sourcePos.y;
      
      optimizedPath = `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;
    } else {
      // Default curved path
      optimizedPath = path;
    }
    
    return { edge, path: optimizedPath };
  });
};