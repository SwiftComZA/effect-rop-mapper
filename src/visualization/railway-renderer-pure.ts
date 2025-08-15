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

// Predefined color palette for folders
const COLOR_PALETTE = [
  '#28a745', // Green
  '#007bff', // Blue
  '#6f42c1', // Purple
  '#ffc107', // Yellow
  '#fd7e14', // Orange
  '#dc3545', // Red
  '#17a2b8', // Cyan
  '#e83e8c', // Pink
  '#20c997', // Teal
  '#563d7c', // Dark Purple
  '#795548', // Brown
  '#ff9800', // Deep Orange
  '#3B82F6', // Light Blue
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Magenta
  '#06B6D4', // Sky Blue
];

// Map to store folder -> color assignments
const folderColorMap = new Map<string, string>();
let colorIndex = 0;

// Function to get consistent color for a folder
const getNodeColorByFolder = (folder: string): string => {
  // Check if we already assigned a color to this folder
  if (folderColorMap.has(folder)) {
    return folderColorMap.get(folder)!;
  }
  
  // Assign next color from palette
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  folderColorMap.set(folder, color);
  colorIndex++;
  
  return color;
};

// Color schemes - fallback for legacy code
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


// Layout constants based on original implementation
const LAYOUT_CONFIG = {
  BASE_LAYER_WIDTH: 250,
  MIN_COLUMN_WIDTH: 120,
  LAYER_PADDING: 100,
  NODE_HEIGHT: 45,
  NODE_PADDING: 15,
  MIN_NODE_SPACING: 35,
  MAX_NODES_PER_COLUMN: 15,
  MAX_COLUMNS_PER_LAYER: 8,
  HEADER_HEIGHT: 80,
  BOTTOM_PADDING: 40
};

// Pure function to calculate node positions with proper spacing and multi-column layout
const calculateNodePositions = (
  nodes: EffectNode[],
  edges: Array<{ source: string; target: string; type: EdgeType }>,
  width: number,
  height: number,
  entryPoints: string[]
): NodePosition[] => {
  // Calculate relationship counts for each node
  const relationshipCounts = new Map<string, number>();
  nodes.forEach(node => {
    relationshipCounts.set(node.id, 0);
  });
  edges.forEach(edge => {
    relationshipCounts.set(edge.source, (relationshipCounts.get(edge.source) || 0) + 1);
    relationshipCounts.set(edge.target, (relationshipCounts.get(edge.target) || 0) + 1);
  });
  
  // Group nodes by folder/subfolder structure
  const nodesByFolder = new Map<string, EffectNode[]>();
  
  nodes.forEach(node => {
    let folder = node.folder || 'root';
    
    if (!node.folder && node.filePath) {
      const pathParts = node.filePath.split('/').filter(p => p);
      if (pathParts.length > 1) {
        folder = pathParts.slice(0, Math.min(2, pathParts.length - 1)).join('/');
      }
    }
    
    if (!nodesByFolder.has(folder)) {
      nodesByFolder.set(folder, []);
    }
    nodesByFolder.get(folder)!.push(node);
  });
  
  // Calculate average relationships per folder to sort folders
  const folderAverageRelationships = new Map<string, number>();
  nodesByFolder.forEach((nodes, folder) => {
    const totalRelationships = nodes.reduce((sum, node) => 
      sum + (relationshipCounts.get(node.id) || 0), 0
    );
    folderAverageRelationships.set(folder, totalRelationships / nodes.length);
  });
  
  // Sort folders by average relationship count (least connected on left, most on right)
  const sortedFolders = Array.from(nodesByFolder.keys()).sort((a, b) => {
    const avgA = folderAverageRelationships.get(a) || 0;
    const avgB = folderAverageRelationships.get(b) || 0;
    return avgA - avgB;
  });
  
  const positions: NodePosition[] = [];
  let currentLayerStartX = LAYOUT_CONFIG.LAYER_PADDING;
  
  sortedFolders.forEach((folder, folderIndex) => {
    const nodesInFolder = nodesByFolder.get(folder) || [];
    
    // Sort nodes within folder - MOST dependencies on LEFT, LEAST on RIGHT
    const sortedNodes = [...nodesInFolder].sort((a, b) => {
      const aRels = relationshipCounts.get(a.id) || 0;
      const bRels = relationshipCounts.get(b.id) || 0;
      
      // Primary sort: by relationship count (DESCENDING - most dependencies first)
      if (aRels !== bRels) return bRels - aRels;
      
      // Secondary sort: entry points first
      const aIsEntry = entryPoints.includes(a.id);
      const bIsEntry = entryPoints.includes(b.id);
      if (aIsEntry && !bIsEntry) return -1;
      if (!aIsEntry && bIsEntry) return 1;
      
      // Tertiary sort by name for consistency
      return a.name.localeCompare(b.name);
    });
    
    // DYNAMIC MULTI-COLUMN LAYOUT FOR LARGE DATASETS
    const nodesPerColumn = Math.min(LAYOUT_CONFIG.MAX_NODES_PER_COLUMN, sortedNodes.length);
    const numberOfColumns = Math.min(
      Math.ceil(sortedNodes.length / nodesPerColumn), 
      LAYOUT_CONFIG.MAX_COLUMNS_PER_LAYER
    );
    
    // Calculate actual layer width based on number of columns needed
    const dynamicWidth = Math.max(
      LAYOUT_CONFIG.MIN_COLUMN_WIDTH,
      LAYOUT_CONFIG.BASE_LAYER_WIDTH / Math.max(1, 15 / sortedNodes.length)
    );
    const actualLayerWidth = Math.max(
      LAYOUT_CONFIG.BASE_LAYER_WIDTH,
      numberOfColumns * dynamicWidth
    );
    
    const columnWidth = actualLayerWidth / numberOfColumns;
    
    sortedNodes.forEach((node, nodeIndex) => {
      const columnIndex = Math.floor(nodeIndex / nodesPerColumn);
      const positionInColumn = nodeIndex % nodesPerColumn;
      
      // Calculate X position (column-based)
      const x = currentLayerStartX + (columnIndex * columnWidth) + (columnWidth / 2);
      
      // Calculate Y position with proper spacing
      const availableHeight = height - LAYOUT_CONFIG.HEADER_HEIGHT - LAYOUT_CONFIG.BOTTOM_PADDING;
      const effectiveNodesInColumn = Math.min(nodesPerColumn, sortedNodes.length - (columnIndex * nodesPerColumn));
      
      let y: number;
      if (effectiveNodesInColumn === 1) {
        // Single node - center it in available space below header
        y = LAYOUT_CONFIG.HEADER_HEIGHT + (availableHeight / 2);
      } else {
        // Multiple nodes - distribute evenly with minimum spacing
        const maxSpacing = availableHeight / (effectiveNodesInColumn - 1);
        const actualSpacing = Math.max(LAYOUT_CONFIG.MIN_NODE_SPACING, maxSpacing);
        const totalUsedHeight = (effectiveNodesInColumn - 1) * actualSpacing;
        const startY = LAYOUT_CONFIG.HEADER_HEIGHT + ((availableHeight - totalUsedHeight) / 2);
        y = startY + (positionInColumn * actualSpacing);
      }
      
      // Get color based on folder
      const folderColor = getNodeColorByFolder(folder);
      
      positions.push({
        node,
        x,
        y,
        layer: folderIndex,
        column: nodeIndex,
        isEntryPoint: entryPoints.includes(node.id),
        radius: 16,
        color: folderColor,
        icon: ''
      });
    });
    
    // Update layer start position for next layer
    currentLayerStartX += actualLayerWidth + LAYOUT_CONFIG.LAYER_PADDING;
  });
  
  console.log('📊 Layout Summary:');
  sortedFolders.forEach((folder, index) => {
    const nodes = nodesByFolder.get(folder) || [];
    const avgDeps = folderAverageRelationships.get(folder) || 0;
    console.log(`  ${index + 1}. ${folder}: ${nodes.length} nodes, ${avgDeps.toFixed(1)} avg dependencies`);
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
    className: `node node-${pos.node.type}`,
    transform: `translate(${pos.x},${pos.y})`,
    children: [
      // Outer ring for entry points
      pos.isEntryPoint ? {
        type: 'circle' as const,
        cx: 0,
        cy: 0,
        r: pos.radius + 3,
        fill: 'none',
        stroke: pos.color,
        strokeWidth: 2,
        opacity: 0.3,
        className: 'entry-point-ring'
      } : null,
      // Main node circle
      {
        type: 'circle' as const,
        cx: 0,
        cy: 0,
        r: pos.radius,
        fill: '#ffffff',
        stroke: pos.color,
        strokeWidth: 2,
        className: `node-circle`
      },
      // Colored inner circle
      {
        type: 'circle' as const,
        cx: 0,
        cy: 0,
        r: pos.radius - 6,
        fill: pos.color,
        stroke: 'none',
        strokeWidth: 0,
        opacity: 0.15,
        className: 'node-inner'
      },
      // Node name label
      {
        type: 'text' as const,
        text: truncateText(pos.node.name, 15),
        x: 0,
        y: pos.radius + 14,
        fontSize: 10,
        fill: '#374151',
        textAnchor: 'middle',
        fontWeight: '500'
      }
    ].filter(Boolean)
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

// Pure function to generate folder backgrounds
const generateFolderBackgrounds = (
  positions: NodePosition[],
  width: number,
  height: number
): RenderInstruction[] => {
  // Group positions by folder
  const folderGroups = new Map<string, NodePosition[]>();
  
  positions.forEach(pos => {
    const folder = pos.node.folder || 'root';
    if (!folderGroups.has(folder)) {
      folderGroups.set(folder, []);
    }
    folderGroups.get(folder)!.push(pos);
  });
  
  // Sort folders by layer order (already sorted by relationship count)
  const sortedFolders: string[] = [];
  const layerToFolder = new Map<number, string>();
  positions.forEach(pos => {
    const folder = pos.node.folder || 'root';
    if (!layerToFolder.has(pos.layer)) {
      layerToFolder.set(pos.layer, folder);
      sortedFolders.push(folder);
    }
  });
  
  // Use layout constants for consistent sizing
  const containerTop = LAYOUT_CONFIG.HEADER_HEIGHT - 30;
  const containerBottom = height - LAYOUT_CONFIG.BOTTOM_PADDING;
  const containerHeight = containerBottom - containerTop;
  const containerPadding = 30;
  
  return sortedFolders.map((folder, index) => {
    const folderPositions = folderGroups.get(folder) || [];
    if (folderPositions.length === 0) return null;
    
    // Calculate consistent container dimensions
    const minX = Math.min(...folderPositions.map(p => p.x)) - containerPadding;
    const maxX = Math.max(...folderPositions.map(p => p.x)) + containerPadding;
    
    // Use consistent height for all containers
    const rectY = containerTop;
    const rectHeight = containerHeight;
    
    // Get folder color
    const folderColor = getNodeColorByFolder(folder);
    
    return {
      type: 'group' as const,
      className: 'folder-group',
      children: [
        // Background rectangle with consistent height
        {
          type: 'rect' as const,
          x: minX,
          y: rectY,
          width: maxX - minX,
          height: rectHeight,
          fill: folderColor,
          stroke: folderColor,
          strokeWidth: 1,
          rx: 8,
          opacity: 0.05
        },
        // Border for definition
        {
          type: 'rect' as const,
          x: minX,
          y: rectY,
          width: maxX - minX,
          height: rectHeight,
          fill: 'none',
          stroke: folderColor,
          strokeWidth: 1,
          rx: 8,
          opacity: 0.2
        },
        // Top accent bar
        {
          type: 'rect' as const,
          x: minX,
          y: rectY,
          width: maxX - minX,
          height: 3,
          fill: folderColor,
          stroke: 'none',
          strokeWidth: 0,
          rx: 0,
          opacity: 0.4
        },
        // Folder label
        {
          type: 'text' as const,
          text: folder.toUpperCase(),
          x: (minX + maxX) / 2,
          y: rectY + 25,
          fontSize: 11,
          fill: folderColor,
          textAnchor: 'middle',
          fontWeight: 'bold'
        },
        // Node count label
        {
          type: 'text' as const,
          text: `${folderPositions.length} function${folderPositions.length !== 1 ? 's' : ''}`,
          x: (minX + maxX) / 2,
          y: rectY + 40,
          fontSize: 9,
          fill: '#9CA3AF',
          textAnchor: 'middle',
          fontWeight: 'normal'
        }
      ]
    };
  }).filter(Boolean) as RenderInstruction[];
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
  
  // Generate folder backgrounds
  const folderBackgrounds = generateFolderBackgrounds(nodePositions, config.width, config.height);
  
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
      className: 'folder-backgrounds',
      children: folderBackgrounds
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
    onNodeClick: (node: EffectNode) => {
      console.log('Node clicked:', node);
      
      // Show the code inspection panel
      const panel = document.getElementById('code-inspection-panel');
      if (panel) {
        panel.classList.add('visible');
      }
      
      // Update node information
      const nodeInfo = document.getElementById('node-info');
      if (nodeInfo) {
        nodeInfo.innerHTML = `
          <strong>${node.name}</strong><br>
          <span style="color: #666;">Type:</span> ${node.type}<br>
          <span style="color: #666;">File:</span> ${node.filePath}:${node.line}<br>
          <span style="color: #666;">Folder:</span> ${node.folder || 'root'}<br>
          ${node.description ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #555;">${node.description}</div>` : ''}
        `;
      }
      
      // Update effect signature if available
      const effectSignature = document.getElementById('effect-signature');
      if (effectSignature && node.effectSignature) {
        const sig = node.effectSignature;
        effectSignature.innerHTML = `
          <div class="code-block">
Effect&lt;${sig.success || 'unknown'}, ${(sig.error || []).join(' | ') || 'never'}, ${(sig.dependencies || []).join(' & ') || 'never'}&gt;
          </div>
        `;
      } else if (effectSignature) {
        effectSignature.innerHTML = `<div style="color: #666; font-style: italic;">No Effect signature available</div>`;
      }
      
      // Calculate and display dependencies
      const upstreamNodes: EffectNode[] = [];
      const downstreamNodes: EffectNode[] = [];
      
      console.log('Total edges in data:', data.railway.edges.length);
      console.log('Current node ID:', node.id);
      console.log('Sample edges:', data.railway.edges.slice(0, 5));
      
      // Find upstream dependencies (nodes that this node depends on)
      data.railway.edges.forEach(edge => {
        if (edge.target === node.id) {
          const sourceNode = data.railway.nodes.find(n => n.id === edge.source);
          if (sourceNode) {
            upstreamNodes.push(sourceNode);
          }
        }
      });
      
      // Find downstream dependents (nodes that depend on this node)
      data.railway.edges.forEach(edge => {
        if (edge.source === node.id) {
          const targetNode = data.railway.nodes.find(n => n.id === edge.target);
          if (targetNode) {
            downstreamNodes.push(targetNode);
          }
        }
      });
      
      console.log('Found upstream nodes:', upstreamNodes.length);
      console.log('Found downstream nodes:', downstreamNodes.length);
      console.log('Upstream nodes:', upstreamNodes);
      console.log('Downstream nodes:', downstreamNodes);
      
      // Update upstream dependencies
      const upstreamDeps = document.getElementById('upstream-deps');
      if (upstreamDeps) {
        upstreamDeps.innerHTML = '';
        if (upstreamNodes.length > 0) {
          upstreamNodes.slice(0, 5).forEach((depNode: EffectNode) => {
            const li = document.createElement('li');
            li.className = 'upstream';
            li.innerHTML = `
              <strong>${depNode.name}</strong> (${depNode.type})<br>
              <span style="font-size: 0.8rem; color: #666;">${depNode.filePath.split('/').pop()}:${depNode.line}</span>
            `;
            upstreamDeps.appendChild(li);
          });
          if (upstreamNodes.length > 5) {
            const li = document.createElement('li');
            li.className = 'upstream';
            li.innerHTML = `<span style="color: #666; font-style: italic;">... and ${upstreamNodes.length - 5} more upstream dependencies</span>`;
            upstreamDeps.appendChild(li);
          }
        } else {
          upstreamDeps.innerHTML = '<li style="color: #666; font-style: italic;">No upstream dependencies</li>';
        }
      }
      
      // Update downstream dependents  
      const downstreamDeps = document.getElementById('downstream-deps');
      if (downstreamDeps) {
        downstreamDeps.innerHTML = '';
        if (downstreamNodes.length > 0) {
          downstreamNodes.slice(0, 5).forEach((depNode: EffectNode) => {
            const li = document.createElement('li');
            li.className = 'downstream';
            li.innerHTML = `
              <strong>${depNode.name}</strong> (${depNode.type})<br>
              <span style="font-size: 0.8rem; color: #666;">${depNode.filePath.split('/').pop()}:${depNode.line}</span>
            `;
            downstreamDeps.appendChild(li);
          });
          if (downstreamNodes.length > 5) {
            const li = document.createElement('li');
            li.className = 'downstream';
            li.innerHTML = `<span style="color: #666; font-style: italic;">... and ${downstreamNodes.length - 5} more downstream dependents</span>`;
            downstreamDeps.appendChild(li);
          }
        } else {
          downstreamDeps.innerHTML = '<li style="color: #666; font-style: italic;">No downstream dependents</li>';
        }
      }
      
      // Update modification guide
      const modificationGuide = document.getElementById('modification-steps');
      if (modificationGuide) {
        modificationGuide.innerHTML = `
          <div class="guide-step">
            <span class="step-number">1</span>
            <strong>Impact Assessment:</strong> ${upstreamNodes.length} upstream dependencies, ${downstreamNodes.length} downstream dependents
          </div>
          <div class="guide-step">
            <span class="step-number">2</span>
            <strong>Risk Level:</strong> ${downstreamNodes.length > 3 ? 'HIGH' : downstreamNodes.length > 1 ? 'MEDIUM' : 'LOW'} - ${downstreamNodes.length > 3 ? 'Proceed with caution, comprehensive testing required' : downstreamNodes.length > 1 ? 'Standard precautions apply' : 'Low risk modification'}
          </div>
          <div class="guide-step">
            <span class="step-number">3</span>
            <strong>Function:</strong> <code>${node.name}</code> in <code>${node.filePath}:${node.line}</code>
          </div>
        `;
      }
    },
    onNodeHover: (_node: EffectNode | null) => {
      // Tooltip handled by bridge
    },
    onZoom: (_scale: number, _x: number, _y: number) => {
      // Zoom handled by bridge
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