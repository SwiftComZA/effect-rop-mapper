/**
 * Purpose: Logical request flow layout - Express -> API -> Controller -> Service -> Repository -> Database
 * Dependencies: D3.js
 * 
 * Example Input:
 * ```
 * new LogicalFlowLayout(nodes, edges, width, height).calculate()
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

export class LogicalFlowLayout {
  private nodes: EffectNode[];
  private edges: EffectEdge[];
  private railway: EffectRailway;
  private width: number;
  private height: number;

  // Logical layer configuration (left to right flow) - OPTIMIZED FOR LARGE DATASETS
  private readonly BASE_LAYER_WIDTH = 250;    // Base layer width
  private readonly MIN_COLUMN_WIDTH = 120;    // Minimum column width
  private readonly LAYER_PADDING = 100;       // Padding between layers
  private readonly NODE_HEIGHT = 45;          // Reasonable node height
  private readonly NODE_PADDING = 15;         // Tighter vertical padding
  private readonly MIN_NODE_SPACING = 35;     // Minimum space between nodes
  private readonly MAX_NODES_PER_COLUMN = 15; // Multi-column layout for large datasets
  private readonly MAX_COLUMNS_PER_LAYER = 8; // Maximum columns per layer

  // Logical layers (left to right)
  private readonly LOGICAL_LAYERS = [
    { key: 'entry', name: 'HTTP Entry', types: ['controller'], color: '#28a745' },
    { key: 'middleware', name: 'Middleware', types: ['middleware'], color: '#6f42c1' },
    { key: 'services', name: 'Business Logic', types: ['service'], color: '#007bff' },
    { key: 'repositories', name: 'Data Access', types: ['repository'], color: '#ffc107' },
    { key: 'workers', name: 'Background', types: ['worker'], color: '#fd7e14' },
    { key: 'utilities', name: 'Utilities', types: ['utility'], color: '#6c757d' },
    { key: 'errors', name: 'Error Types', types: ['error'], color: '#dc3545' }
  ];

  constructor(railway: EffectRailway, width: number, height: number) {
    this.railway = railway;
    this.nodes = railway.nodes;
    this.edges = railway.edges;
    this.width = width;
    this.height = height;
  }

  public calculate(): Map<string, LogicalPosition> {
    const positions = new Map<string, LogicalPosition>();
    
    // Step 1: Group nodes by logical layer
    const layerGroups = this.groupNodesByLogicalLayer();
    
    // Step 2: Position nodes within each layer
    this.positionNodesInLayers(layerGroups, positions);
    
    // Step 3: Apply positions to nodes
    this.applyPositions(positions);
    
    return positions;
  }

  private groupNodesByLogicalLayer(): Map<number, EffectNode[]> {
    const layerGroups = new Map<number, EffectNode[]>();
    
    // Initialize all layers
    for (let i = 0; i < this.LOGICAL_LAYERS.length; i++) {
      layerGroups.set(i, []);
    }
    
    // Assign nodes to layers based on type
    for (const node of this.nodes) {
      const layerIndex = this.LOGICAL_LAYERS.findIndex(layer => 
        layer.types.includes(node.type)
      );
      
      if (layerIndex !== -1) {
        const layerNodes = layerGroups.get(layerIndex) || [];
        layerNodes.push(node);
        layerGroups.set(layerIndex, layerNodes);
      }
    }
    
    return layerGroups;
  }

  private positionNodesInLayers(
    layerGroups: Map<number, EffectNode[]>, 
    positions: Map<string, LogicalPosition>
  ): void {
    let currentLayerStartX = this.LAYER_PADDING;
    
    for (const [layerIndex, layerNodes] of layerGroups) {
      if (layerNodes.length === 0) continue;
      
      // Sort nodes for better visual organization
      const sortedNodes = this.sortNodesForLayer(layerNodes, layerIndex);
      
      // DYNAMIC MULTI-COLUMN LAYOUT FOR LARGE DATASETS
      const nodesPerColumn = Math.min(this.MAX_NODES_PER_COLUMN, sortedNodes.length);
      const numberOfColumns = Math.min(
        Math.ceil(sortedNodes.length / nodesPerColumn), 
        this.MAX_COLUMNS_PER_LAYER
      );
      
      // Calculate actual layer width based on number of columns needed
      const actualLayerWidth = Math.max(
        this.BASE_LAYER_WIDTH,
        numberOfColumns * this.MIN_COLUMN_WIDTH
      );
      
      const columnWidth = actualLayerWidth / numberOfColumns;
      const layerCenterX = currentLayerStartX + (actualLayerWidth / 2);
      
      sortedNodes.forEach((node, nodeIndex) => {
        const columnIndex = Math.floor(nodeIndex / nodesPerColumn);
        const positionInColumn = nodeIndex % nodesPerColumn;
        
        // Calculate X position (column-based)
        const x = currentLayerStartX + (columnIndex * columnWidth) + (columnWidth / 2);
        
        // Calculate Y position with better spacing - account for header area
        const headerHeight = 60; // Space reserved for layer headers
        const availableHeight = this.height - headerHeight - (this.NODE_PADDING * 2);
        const effectiveNodesInColumn = Math.min(nodesPerColumn, sortedNodes.length - (columnIndex * nodesPerColumn));
        
        let y: number;
        if (effectiveNodesInColumn === 1) {
          // Single node - center it in available space below header
          y = headerHeight + (availableHeight / 2);
        } else {
          // Multiple nodes - distribute evenly with minimum spacing
          const maxSpacing = availableHeight / (effectiveNodesInColumn - 1);
          const actualSpacing = Math.max(this.MIN_NODE_SPACING, maxSpacing);
          const totalUsedHeight = (effectiveNodesInColumn - 1) * actualSpacing;
          const startY = headerHeight + ((availableHeight - totalUsedHeight) / 2);
          y = startY + (positionInColumn * actualSpacing);
        }
        
        positions.set(node.id, {
          x,
          y,
          layer: layerIndex,
          position: nodeIndex
        });
      });
      
      // Update layer start position for next layer
      currentLayerStartX += actualLayerWidth + this.LAYER_PADDING;
    }
  }

  private sortNodesForLayer(nodes: EffectNode[], layerIndex: number): EffectNode[] {
    // Sort entry points (controllers) by HTTP method/path
    if (layerIndex === 0) { // Entry layer
      return nodes.sort((a, b) => {
        // PUT entry points first (they're typically the main endpoints)
        if (a.name.includes('GET') && !b.name.includes('GET')) return -1;
        if (!a.name.includes('GET') && b.name.includes('GET')) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    // Sort services by importance (database, logger, etc.)
    if (layerIndex === 2) { // Services layer
      const serviceOrder = ['DatabaseService', 'LoggerService', 'QueueService', 'HttpService'];
      return nodes.sort((a, b) => {
        const aIndex = serviceOrder.findIndex(s => a.name.includes(s));
        const bIndex = serviceOrder.findIndex(s => b.name.includes(s));
        
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    // Default alphabetical sort
    return nodes.sort((a, b) => a.name.localeCompare(b.name));
  }

  private applyPositions(positions: Map<string, LogicalPosition>): void {
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

  // Generate logical flow connections
  public generateLogicalFlows(): Array<{
    id: string;
    path: string;
    type: 'request-flow' | 'data-flow' | 'error-flow';
    from: LogicalPosition;
    to: LogicalPosition;
    label?: string;
  }> {
    const flows: Array<{
      id: string;
      path: string;
      type: 'request-flow' | 'data-flow' | 'error-flow';
      from: LogicalPosition;
      to: LogicalPosition;
      label?: string;
    }> = [];
    
    const positions = new Map<string, LogicalPosition>();
    for (const node of this.nodes) {
      if (node.x !== undefined && node.y !== undefined) {
        positions.set(node.id, {
          x: node.x,
          y: node.y,
          layer: 0, // Will be calculated properly
          position: 0
        });
      }
    }
    
    for (const edge of this.edges) {
      const sourcePos = positions.get(edge.source);
      const targetPos = positions.get(edge.target);
      
      if (sourcePos && targetPos) {
        const flowType = edge.type === 'error' ? 'error-flow' : 
                        edge.type === 'dependency' ? 'request-flow' : 'data-flow';
        
        flows.push({
          id: edge.id,
          path: this.generateFlowPath(sourcePos, targetPos, flowType),
          type: flowType,
          from: sourcePos,
          to: targetPos,
          label: edge.label
        });
      }
    }
    
    return flows;
  }

  private generateFlowPath(
    from: LogicalPosition, 
    to: LogicalPosition, 
    type: 'request-flow' | 'data-flow' | 'error-flow'
  ): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    if (type === 'error-flow') {
      // Error flows arc upward
      const controlY = Math.min(from.y, to.y) - 50;
      const controlX = from.x + dx * 0.5;
      return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
    } else if (Math.abs(dy) < 30) {
      // Straight horizontal flow for same level
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    } else {
      // Smooth curved flow between layers
      const controlX1 = from.x + dx * 0.3;
      const controlX2 = from.x + dx * 0.7;
      return `M ${from.x} ${from.y} C ${controlX1} ${from.y} ${controlX2} ${to.y} ${to.x} ${to.y}`;
    }
  }

  // Generate layer separators
  public generateLayerSeparators(): Array<{
    layer: number;
    name: string;
    color: string;
    x: number;
    width: number;
    labelPath: string;
    separatorPath: string;
  }> {
    const separators: Array<{
      layer: number;
      name: string;
      color: string;
      x: number;
      width: number;
      labelPath: string;
      separatorPath: string;
    }> = [];
    
    const layerGroups = this.groupNodesByLogicalLayer();
    let currentLayerStartX = this.LAYER_PADDING;
    
    for (let i = 0; i < this.LOGICAL_LAYERS.length; i++) {
      const layer = this.LOGICAL_LAYERS[i];
      const layerNodes = layerGroups.get(i) || [];
      
      if (layerNodes.length > 0) {
        // Calculate actual layer width based on nodes
        const nodesPerColumn = Math.min(this.MAX_NODES_PER_COLUMN, layerNodes.length);
        const numberOfColumns = Math.min(
          Math.ceil(layerNodes.length / nodesPerColumn),
          this.MAX_COLUMNS_PER_LAYER
        );
        const actualLayerWidth = Math.max(
          this.BASE_LAYER_WIDTH,
          numberOfColumns * this.MIN_COLUMN_WIDTH
        );
        
        separators.push({
          layer: i,
          name: layer.name,
          color: layer.color,
          x: currentLayerStartX + (actualLayerWidth / 2),
          width: actualLayerWidth,
          labelPath: `M ${currentLayerStartX} 30 L ${currentLayerStartX + actualLayerWidth} 30`,
          separatorPath: `M ${currentLayerStartX + actualLayerWidth} 0 L ${currentLayerStartX + actualLayerWidth} ${this.height}`
        });
        
        currentLayerStartX += actualLayerWidth + this.LAYER_PADDING;
      }
    }
    
    return separators;
  }

  public getLogicalLayers() {
    return this.LOGICAL_LAYERS;
  }
}