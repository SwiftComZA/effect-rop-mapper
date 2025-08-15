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

  // Dynamic logical layers based on actual folders
  private LOGICAL_LAYERS: Array<{ key: string; name: string; types: string[]; color: string }> = [];

  constructor(railway: EffectRailway, width: number, height: number) {
    this.railway = railway;
    this.nodes = railway.nodes;
    this.edges = railway.edges;
    this.width = width;
    this.height = height;
    
    // Build dynamic layers based on actual node types/folders
    this.buildDynamicLayers();
  }
  
  private buildDynamicLayers(): void {
    // Calculate average dependencies for each type/folder
    const typeStats = new Map<string, { count: number; totalDeps: number; avgDeps: number }>();
    
    for (const node of this.nodes) {
      const stats = typeStats.get(node.type) || { count: 0, totalDeps: 0, avgDeps: 0 };
      const nodeDeps = (node.metrics?.callsCount || 0);
      stats.count++;
      stats.totalDeps += nodeDeps;
      stats.avgDeps = stats.totalDeps / stats.count;
      typeStats.set(node.type, stats);
    }
    
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
    
    console.log('📊 Folder dependency order (least to most):');
    sortedTypes.forEach((type, index) => {
      const stats = typeStats.get(type)!;
      console.log(`  ${index + 1}. ${type}: ${stats.avgDeps.toFixed(2)} avg deps (${stats.count} functions)`);
    });
    
    // Create layers for each type with nodes
    this.LOGICAL_LAYERS = sortedTypes.map((type, index) => ({
      key: type,
      name: this.formatLayerName(type),
      types: [type],
      color: this.getColorForType(type)
    }));
  }
  
  private formatLayerName(type: string): string {
    // Format the folder name for display
    return type
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
  
  private getColorForType(type: string): string {
    // Predefined colors for common types
    const colorMap: Record<string, string> = {
      'routes': '#28a745',
      'controllers': '#28a745',
      'middleware': '#6f42c1',
      'services': '#007bff',
      'service': '#007bff',
      'repositories': '#ffc107',
      'repository': '#ffc107',
      'workers': '#fd7e14',
      'worker': '#fd7e14',
      'utils': '#6c757d',
      'utilities': '#6c757d',
      'utility': '#6c757d',
      'errors': '#dc3545',
      'error': '#dc3545',
      'config': '#17a2b8',
      'schemas': '#e83e8c',
      'types': '#20c997',
      'tests': '#563d7c',
      'examples': '#795548',
      'scripts': '#9e9e9e',
      'prompts': '#ff9800'
    };
    
    // Return predefined color or generate one
    if (colorMap[type]) {
      return colorMap[type];
    }
    
    // Generate a consistent color for unknown types
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
      hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    const saturation = 65 + (Math.abs(hash >> 8) % 20);
    const lightness = 45 + (Math.abs(hash >> 16) % 15);
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
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
      // Dynamic width based on node count - grows with more nodes
      const dynamicWidth = Math.max(
        this.MIN_COLUMN_WIDTH,
        this.BASE_LAYER_WIDTH / Math.max(1, 15 / sortedNodes.length)
      );
      const actualLayerWidth = Math.max(
        this.BASE_LAYER_WIDTH,
        numberOfColumns * dynamicWidth
      );
      
      const columnWidth = actualLayerWidth / numberOfColumns;
      const layerCenterX = currentLayerStartX + (actualLayerWidth / 2);
      
      sortedNodes.forEach((node, nodeIndex) => {
        const columnIndex = Math.floor(nodeIndex / nodesPerColumn);
        const positionInColumn = nodeIndex % nodesPerColumn;
        
        // Calculate X position (column-based)
        const x = currentLayerStartX + (columnIndex * columnWidth) + (columnWidth / 2);
        
        // Calculate Y position with better spacing - account for header area
        const headerHeight = 80; // Increased space for layer headers to avoid overlap
        const bottomPadding = 40; // Space at bottom
        const availableHeight = this.height - headerHeight - bottomPadding;
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
    // Sort nodes within each layer by their dependency count (least to most)
    return nodes.sort((a, b) => {
      const aDeps = a.metrics?.callsCount || 0;
      const bDeps = b.metrics?.callsCount || 0;
      
      // Primary sort: by dependency count (ascending)
      if (aDeps !== bDeps) {
        return aDeps - bDeps;
      }
      
      // Secondary sort: by called-by count (descending - more popular functions first)
      const aCalledBy = a.metrics?.calledByCount || 0;
      const bCalledBy = b.metrics?.calledByCount || 0;
      if (aCalledBy !== bCalledBy) {
        return bCalledBy - aCalledBy;
      }
      
      // Tertiary sort: alphabetically
      return a.name.localeCompare(b.name);
    });
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