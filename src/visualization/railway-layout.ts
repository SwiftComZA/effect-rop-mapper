/**
 * Purpose: Railway/BPMN-style layout algorithm for Effect TS visualization
 * Dependencies: D3.js
 * 
 * Example Input:
 * ```
 * new RailwayLayout(nodes, edges, width, height).calculate()
 * ```
 * 
 * Expected Output:
 * ```
 * Positioned nodes in railway-style swim lanes with linear flow
 * ```
 */

import type { EffectNode, EffectEdge, EffectRailway } from '../types/effect-node.js';

export interface RailwayPosition {
  x: number;
  y: number;
  lane: number;
  stage: number;
}

export class RailwayLayout {
  private nodes: EffectNode[];
  private edges: EffectEdge[];
  private railway: EffectRailway;
  private width: number;
  private height: number;

  // Layout configuration
  private readonly LANE_HEIGHT = 120;
  private readonly LANE_PADDING = 40;
  private readonly STAGE_WIDTH = 200;
  private readonly STAGE_PADDING = 60;
  private readonly NODE_SPACING = 40;

  // Lane assignments (swim lanes like BPMN)
  private readonly LANE_ORDER = [
    'controllers',  // Lane 0 - Entry points (HTTP endpoints)
    'middleware',   // Lane 1 - Request processing
    'services',     // Lane 2 - Business logic
    'repositories', // Lane 3 - Data access
    'workers',      // Lane 4 - Background processing
    'utilities',    // Lane 5 - Helper functions
    'errors'        // Lane 6 - Error handling
  ] as const;

  constructor(railway: EffectRailway, width: number, height: number) {
    this.railway = railway;
    this.nodes = railway.nodes;
    this.edges = railway.edges;
    this.width = width;
    this.height = height;
  }

  public calculate(): Map<string, RailwayPosition> {
    const positions = new Map<string, RailwayPosition>();
    
    // Step 1: Assign nodes to lanes based on their type
    const lanes = this.assignNodesToLanes();
    
    // Step 2: Determine flow stages (left-to-right progression)
    const stages = this.calculateFlowStages(lanes);
    
    // Step 3: Position nodes within their lanes and stages
    this.positionNodes(lanes, stages, positions);
    
    // Step 4: Apply positions to nodes
    this.applyPositions(positions);
    
    return positions;
  }

  private assignNodesToLanes(): Map<number, EffectNode[]> {
    const lanes = new Map<number, EffectNode[]>();
    
    // Initialize all lanes
    for (let i = 0; i < this.LANE_ORDER.length; i++) {
      lanes.set(i, []);
    }
    
    // Assign nodes to lanes based on type
    for (const node of this.nodes) {
      const layerKey = (node.type + 's') as keyof typeof this.railway.layers;
      const laneIndex = this.LANE_ORDER.indexOf(layerKey);
      
      if (laneIndex !== -1) {
        const laneNodes = lanes.get(laneIndex) || [];
        laneNodes.push(node);
        lanes.set(laneIndex, laneNodes);
      }
    }
    
    return lanes;
  }

  private calculateFlowStages(lanes: Map<number, EffectNode[]>): Map<string, number> {
    const stages = new Map<string, number>();
    
    // Start with entry points (controllers) at stage 0
    const entryPoints = this.railway.entryPoints;
    for (const entryPointId of entryPoints) {
      stages.set(entryPointId, 0);
    }
    
    // Use topological sort to determine stages based on dependencies
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const calculateStage = (nodeId: string): number => {
      if (visiting.has(nodeId)) {
        // Cycle detected - assign current max stage + 1
        return Math.max(...Array.from(stages.values())) + 1;
      }
      
      if (visited.has(nodeId)) {
        return stages.get(nodeId) || 0;
      }
      
      visiting.add(nodeId);
      
      // Find all nodes that this node depends on
      const dependencies = this.edges
        .filter(edge => edge.target === nodeId && edge.type === 'dependency')
        .map(edge => edge.source);
      
      let maxDependencyStage = -1;
      for (const depId of dependencies) {
        const depStage = calculateStage(depId);
        maxDependencyStage = Math.max(maxDependencyStage, depStage);
      }
      
      // This node's stage is one more than its highest dependency
      const nodeStage = maxDependencyStage + 1;
      stages.set(nodeId, nodeStage);
      
      visiting.delete(nodeId);
      visited.add(nodeId);
      
      return nodeStage;
    };
    
    // Calculate stages for all nodes
    for (const node of this.nodes) {
      if (!stages.has(node.id)) {
        calculateStage(node.id);
      }
    }
    
    // Ensure entry points are at stage 0
    for (const entryPointId of entryPoints) {
      stages.set(entryPointId, 0);
    }
    
    return stages;
  }

  private positionNodes(
    lanes: Map<number, EffectNode[]>, 
    stages: Map<string, number>, 
    positions: Map<string, RailwayPosition>
  ): void {
    const maxStage = Math.max(...Array.from(stages.values()));
    const stageWidth = (this.width - this.STAGE_PADDING * 2) / (maxStage + 1);
    
    // Position nodes in each lane
    for (const [laneIndex, laneNodes] of lanes) {
      const laneY = this.LANE_PADDING + (laneIndex * this.LANE_HEIGHT);
      
      // Group nodes by stage within this lane
      const stageGroups = new Map<number, EffectNode[]>();
      for (const node of laneNodes) {
        const nodeStage = stages.get(node.id) || 0;
        const stageGroup = stageGroups.get(nodeStage) || [];
        stageGroup.push(node);
        stageGroups.set(nodeStage, stageGroup);
      }
      
      // Position nodes within each stage group
      for (const [stageIndex, stageNodes] of stageGroups) {
        const stageX = this.STAGE_PADDING + (stageIndex * stageWidth);
        const nodeCount = stageNodes.length;
        const nodeSpacing = Math.min(this.NODE_SPACING, (this.LANE_HEIGHT - 40) / Math.max(nodeCount - 1, 1));
        const startY = laneY + (this.LANE_HEIGHT - (nodeCount - 1) * nodeSpacing) / 2;
        
        stageNodes.forEach((node, nodeIndex) => {
          const x = stageX + stageWidth / 2; // Center in stage
          const y = startY + (nodeIndex * nodeSpacing);
          
          positions.set(node.id, {
            x,
            y,
            lane: laneIndex,
            stage: stageIndex
          });
        });
      }
    }
  }

  private applyPositions(positions: Map<string, RailwayPosition>): void {
    for (const node of this.nodes) {
      const position = positions.get(node.id);
      if (position) {
        node.x = position.x;
        node.y = position.y;
        node.fx = position.x; // Fix position for static layout
        node.fy = position.y;
      }
    }
  }

  // Generate railway track paths between nodes
  public generateRailwayTracks(): Array<{
    id: string;
    path: string;
    type: 'main-track' | 'branch-track' | 'error-track';
    from: RailwayPosition;
    to: RailwayPosition;
  }> {
    const tracks: Array<{
      id: string;
      path: string;
      type: 'main-track' | 'branch-track' | 'error-track';
      from: RailwayPosition;
      to: RailwayPosition;
    }> = [];
    
    const positions = new Map<string, RailwayPosition>();
    for (const node of this.nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        positions.set(node.id, {
          x: node.x,
          y: node.y,
          lane: 0, // Will be calculated properly
          stage: 0
        });
      }
    }
    
    for (const edge of this.edges) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      
      if (sourcePos && targetPos) {
        const trackType = edge.type === 'error' ? 'error-track' : 
                         edge.type === 'dependency' ? 'main-track' : 'branch-track';
        
        tracks.push({
          id: edge.id,
          path: this.generateTrackPath(sourcePos, targetPos, trackType),
          type: trackType,
          from: sourcePos,
          to: targetPos
        });
      }
    }
    
    return tracks;
  }

  private generateTrackPath(
    from: RailwayPosition, 
    to: RailwayPosition, 
    type: 'main-track' | 'branch-track' | 'error-track'
  ): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    if (type === 'error-track') {
      // Error tracks branch upward/downward
      const controlX = from.x + dx * 0.3;
      const controlY = from.y + (dy > 0 ? -30 : 30);
      return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
    } else if (Math.abs(dy) < 20) {
      // Straight horizontal track for same-lane connections
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    } else {
      // Railway-style curved connection between lanes
      const controlX1 = from.x + dx * 0.4;
      const controlX2 = from.x + dx * 0.6;
      return `M ${from.x} ${from.y} C ${controlX1} ${from.y} ${controlX2} ${to.y} ${to.x} ${to.y}`;
    }
  }

  // Generate lane separators (like BPMN swim lanes)
  public generateLaneSeparators(): Array<{
    lane: number;
    name: string;
    y: number;
    path: string;
  }> {
    const separators: Array<{
      lane: number;
      name: string;
      y: number;
      path: string;
    }> = [];
    
    for (let i = 0; i < this.LANE_ORDER.length; i++) {
      const laneY = this.LANE_PADDING + (i * this.LANE_HEIGHT);
      const layerKey = this.LANE_ORDER[i];
      const layerName = layerKey.charAt(0).toUpperCase() + layerKey.slice(1, -1); // Remove 's' and capitalize
      
      separators.push({
        lane: i,
        name: layerName,
        y: laneY,
        path: `M 0 ${laneY - this.LANE_HEIGHT/2} L ${this.width} ${laneY - this.LANE_HEIGHT/2}`
      });
    }
    
    return separators;
  }
}