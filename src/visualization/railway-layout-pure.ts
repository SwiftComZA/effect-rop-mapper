/**
 * Purpose: Pure functional railway/BPMN-style layout algorithm for Effect TS visualization
 * Dependencies: None (pure functions)
 * 
 * Example Input:
 * ```
 * calculateRailwayLayout(railway, 1200, 800)
 * ```
 * 
 * Expected Output:
 * ```
 * Map of node positions in railway-style swim lanes with linear flow
 * ```
 */

import type { EffectNode, EffectEdge, EffectRailway } from '../types/effect-node.js';

export interface RailwayPosition {
  x: number;
  y: number;
  lane: number;
  stage: number;
}

export interface RailwayLayoutConfig {
  laneHeight?: number;
  lanePadding?: number;
  stageWidth?: number;
  stagePadding?: number;
  nodeSpacing?: number;
}

// Default configuration
const DEFAULT_CONFIG: Required<RailwayLayoutConfig> = {
  laneHeight: 120,
  lanePadding: 40,
  stageWidth: 200,
  stagePadding: 60,
  nodeSpacing: 40
};

// Lane order definition (swim lanes like BPMN)
const LANE_ORDER = [
  'controllers',  // Lane 0 - Entry points (HTTP endpoints)
  'middleware',   // Lane 1 - Request processing
  'services',     // Lane 2 - Business logic
  'repositories', // Lane 3 - Data access
  'workers',      // Lane 4 - Background processing
  'utilities',    // Lane 5 - Helper functions
  'errors'        // Lane 6 - Error handling
] as const;

// Pure function to assign nodes to lanes
const assignNodesToLanes = (nodes: EffectNode[]): Map<number, EffectNode[]> => {
  const lanes = new Map<number, EffectNode[]>();
  
  // Initialize all lanes
  for (let i = 0; i < LANE_ORDER.length; i++) {
    lanes.set(i, []);
  }
  
  // Assign nodes to lanes based on type
  nodes.forEach(node => {
    const layerKey = (node.type + 's') as typeof LANE_ORDER[number];
    const laneIndex = LANE_ORDER.indexOf(layerKey);
    
    if (laneIndex !== -1) {
      const laneNodes = lanes.get(laneIndex) || [];
      lanes.set(laneIndex, [...laneNodes, node]);
    }
  });
  
  return lanes;
};

// Pure function to calculate flow stages
const calculateFlowStages = (
  nodes: EffectNode[],
  edges: EffectEdge[],
  lanes: Map<number, EffectNode[]>
): Map<string, number> => {
  const stages = new Map<string, number>();
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();
  
  // Initialize maps
  nodes.forEach(node => {
    inDegree.set(node.id, 0);
    adjacencyList.set(node.id, []);
  });
  
  // Build adjacency list and calculate in-degrees
  edges.forEach(edge => {
    const targets = adjacencyList.get(edge.source) || [];
    adjacencyList.set(edge.source, [...targets, edge.target]);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });
  
  // Topological sort to determine stages
  const queue: string[] = [];
  
  // Find all nodes with no incoming edges (starting points)
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
      stages.set(nodeId, 0);
    }
  });
  
  // Process queue
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentStage = stages.get(current) || 0;
    const neighbors = adjacencyList.get(current) || [];
    
    neighbors.forEach(neighbor => {
      // Update stage to be at least one more than the current node
      const neighborStage = Math.max(
        stages.get(neighbor) || 0,
        currentStage + 1
      );
      stages.set(neighbor, neighborStage);
      
      // Decrease in-degree and add to queue if it becomes 0
      const newDegree = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDegree);
      
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    });
  }
  
  // Handle any disconnected nodes
  nodes.forEach(node => {
    if (!stages.has(node.id)) {
      stages.set(node.id, 0);
    }
  });
  
  return stages;
};

// Pure function to position nodes within lanes and stages
const positionNodes = (
  lanes: Map<number, EffectNode[]>,
  stages: Map<string, number>,
  width: number,
  height: number,
  config: Required<RailwayLayoutConfig>
): Map<string, RailwayPosition> => {
  const positions = new Map<string, RailwayPosition>();
  
  // Calculate the maximum stage number
  const maxStage = Math.max(...Array.from(stages.values()), 0);
  const stageCount = maxStage + 1;
  
  // Calculate stage width based on available space
  const effectiveWidth = width - (2 * config.stagePadding);
  const calculatedStageWidth = effectiveWidth / stageCount;
  const actualStageWidth = Math.max(calculatedStageWidth, config.stageWidth);
  
  // Position nodes in each lane
  lanes.forEach((laneNodes, laneIndex) => {
    // Group nodes by stage within this lane
    const nodesByStage = new Map<number, EffectNode[]>();
    
    laneNodes.forEach(node => {
      const stage = stages.get(node.id) || 0;
      const stageNodes = nodesByStage.get(stage) || [];
      nodesByStage.set(stage, [...stageNodes, node]);
    });
    
    // Position nodes within each stage
    nodesByStage.forEach((stageNodes, stage) => {
      const nodesInStage = stageNodes.length;
      
      stageNodes.forEach((node, index) => {
        const x = config.stagePadding + (stage * actualStageWidth) + (actualStageWidth / 2);
        
        // Calculate y position within the lane
        const laneY = config.lanePadding + (laneIndex * (config.laneHeight + config.lanePadding));
        const nodeOffset = nodesInStage === 1 
          ? 0 
          : ((index - (nodesInStage - 1) / 2) * config.nodeSpacing);
        const y = laneY + (config.laneHeight / 2) + nodeOffset;
        
        positions.set(node.id, {
          x,
          y,
          lane: laneIndex,
          stage
        });
      });
    });
  });
  
  return positions;
};

// Pure function to apply positions to nodes (returns new nodes with positions)
const applyPositionsToNodes = (
  nodes: EffectNode[],
  positions: Map<string, RailwayPosition>
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

// Pure function to optimize edge crossings
const optimizeEdgeCrossings = (
  positions: Map<string, RailwayPosition>,
  edges: EffectEdge[]
): Map<string, RailwayPosition> => {
  // Create a copy of positions
  const optimizedPositions = new Map(positions);
  
  // Count edge crossings for current layout
  const countCrossings = (pos: Map<string, RailwayPosition>): number => {
    let crossings = 0;
    
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const edge1 = edges[i];
        const edge2 = edges[j];
        
        const pos1Start = pos.get(edge1.source);
        const pos1End = pos.get(edge1.target);
        const pos2Start = pos.get(edge2.source);
        const pos2End = pos.get(edge2.target);
        
        if (pos1Start && pos1End && pos2Start && pos2End) {
          // Check if edges cross (simplified check)
          if (pos1Start.stage < pos2Start.stage && pos1End.stage > pos2End.stage) {
            crossings++;
          } else if (pos2Start.stage < pos1Start.stage && pos2End.stage > pos1End.stage) {
            crossings++;
          }
        }
      }
    }
    
    return crossings;
  };
  
  // Simple optimization: try swapping nodes in the same lane and stage
  const currentCrossings = countCrossings(optimizedPositions);
  
  // Group positions by lane and stage
  const nodesByLaneStage = new Map<string, string[]>();
  optimizedPositions.forEach((pos, nodeId) => {
    const key = `${pos.lane}-${pos.stage}`;
    const nodes = nodesByLaneStage.get(key) || [];
    nodesByLaneStage.set(key, [...nodes, nodeId]);
  });
  
  // Try swapping nodes within the same lane and stage
  nodesByLaneStage.forEach(nodeIds => {
    if (nodeIds.length > 1) {
      // Try different permutations (simplified - just try reversing)
      const testPositions = new Map(optimizedPositions);
      const positions = nodeIds.map(id => optimizedPositions.get(id)!);
      const reversed = [...positions].reverse();
      
      nodeIds.forEach((id, index) => {
        testPositions.set(id, reversed[index]);
      });
      
      if (countCrossings(testPositions) < currentCrossings) {
        // Apply the better layout
        nodeIds.forEach((id, index) => {
          optimizedPositions.set(id, reversed[index]);
        });
      }
    }
  });
  
  return optimizedPositions;
};

// Main pure function to calculate railway layout
export const calculateRailwayLayout = (
  railway: EffectRailway,
  width: number,
  height: number,
  config?: RailwayLayoutConfig
): {
  positions: Map<string, RailwayPosition>;
  nodes: EffectNode[];
  metrics: RailwayLayoutMetrics;
} => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Step 1: Assign nodes to lanes
  const lanes = assignNodesToLanes(railway.nodes);
  
  // Step 2: Calculate flow stages
  const stages = calculateFlowStages(railway.nodes, railway.edges, lanes);
  
  // Step 3: Position nodes
  const positions = positionNodes(lanes, stages, width, height, finalConfig);
  
  // Step 4: Optimize edge crossings
  const optimizedPositions = optimizeEdgeCrossings(positions, railway.edges);
  
  // Step 5: Apply positions to nodes
  const positionedNodes = applyPositionsToNodes(railway.nodes, optimizedPositions);
  
  // Calculate metrics
  const metrics = calculateLayoutMetrics(optimizedPositions, railway.edges);
  
  return {
    positions: optimizedPositions,
    nodes: positionedNodes,
    metrics
  };
};

// Layout metrics interface
export interface RailwayLayoutMetrics {
  laneCount: number;
  stageCount: number;
  edgeCrossings: number;
  averageEdgeLength: number;
  nodesPerLane: Map<number, number>;
  nodesPerStage: Map<number, number>;
}

// Pure function to calculate layout metrics
const calculateLayoutMetrics = (
  positions: Map<string, RailwayPosition>,
  edges: EffectEdge[]
): RailwayLayoutMetrics => {
  const nodesPerLane = new Map<number, number>();
  const nodesPerStage = new Map<number, number>();
  let maxLane = 0;
  let maxStage = 0;
  
  // Count nodes per lane and stage
  positions.forEach(pos => {
    nodesPerLane.set(pos.lane, (nodesPerLane.get(pos.lane) || 0) + 1);
    nodesPerStage.set(pos.stage, (nodesPerStage.get(pos.stage) || 0) + 1);
    maxLane = Math.max(maxLane, pos.lane);
    maxStage = Math.max(maxStage, pos.stage);
  });
  
  // Calculate average edge length
  let totalEdgeLength = 0;
  let edgeCount = 0;
  
  edges.forEach(edge => {
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    
    if (sourcePos && targetPos) {
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      totalEdgeLength += length;
      edgeCount++;
    }
  });
  
  const averageEdgeLength = edgeCount > 0 ? totalEdgeLength / edgeCount : 0;
  
  // Count edge crossings (simplified)
  let edgeCrossings = 0;
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const edge1 = edges[i];
      const edge2 = edges[j];
      
      const pos1Start = positions.get(edge1.source);
      const pos1End = positions.get(edge1.target);
      const pos2Start = positions.get(edge2.source);
      const pos2End = positions.get(edge2.target);
      
      if (pos1Start && pos1End && pos2Start && pos2End) {
        // Simplified crossing check
        if (pos1Start.stage < pos2Start.stage && pos1End.stage > pos2End.stage) {
          edgeCrossings++;
        }
      }
    }
  }
  
  return {
    laneCount: maxLane + 1,
    stageCount: maxStage + 1,
    edgeCrossings,
    averageEdgeLength: Math.round(averageEdgeLength),
    nodesPerLane,
    nodesPerStage
  };
};

// Pure function to get lane label
export const getLaneLabel = (laneIndex: number): string => {
  const labels = [
    'Controllers',
    'Middleware',
    'Services',
    'Repositories',
    'Workers',
    'Utilities',
    'Errors'
  ];
  return labels[laneIndex] || `Lane ${laneIndex}`;
};

// Pure function to get lane color
export const getLaneColor = (laneIndex: number): string => {
  const colors = [
    '#E8F5E9',  // Controllers - Light Green
    '#FFF3E0',  // Middleware - Light Orange
    '#E3F2FD',  // Services - Light Blue
    '#F3E5F5',  // Repositories - Light Purple
    '#FFEBEE',  // Workers - Light Red
    '#F5F5F5',  // Utilities - Light Gray
    '#FFF9C4'   // Errors - Light Yellow
  ];
  return colors[laneIndex] || '#F5F5F5';
};