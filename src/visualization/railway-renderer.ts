/**
 * Purpose: D3.js-based railway visualization renderer for Effect TS patterns
 * Dependencies: D3.js
 * 
 * Example Input:
 * ```
 * new RailwayRenderer(svgElement).render(railwayData)
 * ```
 * 
 * Expected Output:
 * ```
 * Interactive D3 visualization showing Effect nodes and connections
 * ```
 */

import * as d3 from 'd3';
import { LogicalFlowLayout } from './logical-flow-layout.js';
import { LLMTreeGenerator } from '../export/llm-tree-generator.js';
import { EffectCalculator } from '../calculator/effect-calculator.js';
import type { 
  EffectNode, 
  EffectEdge, 
  EffectRailway, 
  NodeType, 
  EdgeType, 
  AnalysisResult 
} from '../types/effect-node.js';

export class RailwayRenderer {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private width: number;
  private height: number;
  private simulation: d3.Simulation<EffectNode, EffectEdge> | null = null;
  private currentData: AnalysisResult | null = null;
  private filteredNodes: EffectNode[] = [];
  private filteredEdges: EffectEdge[] = [];
  private zoomBehavior: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private selectedNode: EffectNode | null = null;
  private highlightedNodes: Set<string> = new Set();

  private nodeColors: Record<NodeType, string> = {
    controller: '#28a745',
    service: '#007bff', 
    repository: '#ffc107',
    middleware: '#6f42c1',
    worker: '#fd7e14',
    error: '#dc3545',
    utility: '#6c757d'
  };

  private edgeColors: Record<EdgeType, string> = {
    success: '#28a745',
    error: '#dc3545', 
    dependency: '#007bff',
    pipe: '#6c757d'
  };

  constructor(svgElement: SVGSVGElement) {
    this.svg = d3.select(svgElement);
    
    // RESPONSIVE SIZING FOR LARGE DATASETS - Calculate based on content
    this.width = Math.max(svgElement.clientWidth || 1200, 4000); // Much wider for large datasets
    this.height = Math.max(svgElement.clientHeight || 800, 1400); // Taller for large datasets
    
    // Clear existing content
    this.svg.selectAll('*').remove();
    
    // Setup SVG dimensions
    this.svg
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');
    
    // Create main container first
    this.container = this.svg.append('g');
    
    // Add zoom and pan with better controls for large datasets
    this.zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8]) // Allow more zoom out and zoom in
      .on('zoom', (event) => {
        this.container.attr('transform', event.transform);
      });
    
    this.svg.call(this.zoomBehavior)
      .on('click', (event) => {
        // Clear highlighting when clicking on empty space
        if (event.target === this.svg.node()) {
          this.clearHighlighting();
          this.hideCodeInspectionPanel();
        }
      });
    
    // Set initial zoom after container is created
    setTimeout(() => {
      const initialScale = 0.3; // Start more zoomed out for large datasets
      if (this.zoomBehavior) {
        this.svg.call(
          this.zoomBehavior.transform,
          d3.zoomIdentity.scale(initialScale).translate(100, 100)
        );
      }
    }, 100);
    
    // Add definitions for arrowheads and patterns
    this.setupDefinitions();
  }

  private setupDefinitions(): void {
    const defs = this.svg.append('defs');
    
    // Arrow markers for different edge types - smaller and cleaner
    Object.entries(this.edgeColors).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -3 6 6')
        .attr('refX', 12) // Closer to the node
        .attr('refY', 0)
        .attr('markerWidth', 5) // Smaller width
        .attr('markerHeight', 5) // Smaller height
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth') // Scale with stroke width
        .append('path')
        .attr('d', 'M0,-3L6,0L0,3') // Smaller arrow path
        .attr('fill', color)
        .attr('stroke', 'none');
    });
    
    // Add highlighted arrow markers (slightly larger for highlighted edges)
    Object.entries(this.edgeColors).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}-highlighted`)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 14)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .attr('markerUnits', 'strokeWidth')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4')
        .attr('fill', color)
        .attr('stroke', 'none');
    });
    
    // Add patterns for special nodes
    const pattern = defs.append('pattern')
      .attr('id', 'entry-point-pattern')
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 4)
      .attr('height', 4);
    
    pattern.append('rect')
      .attr('width', 4)
      .attr('height', 4)
      .attr('fill', '#fff');
      
    pattern.append('path')
      .attr('d', 'M 0,4 l 4,-4 M -1,1 l 2,-2 M 3,5 l 2,-2')
      .attr('stroke', '#28a745')
      .attr('stroke-width', 1);
  }

  public render(data: AnalysisResult): void {
    this.currentData = data;
    this.filteredNodes = [...data.railway.nodes];
    this.filteredEdges = [...data.railway.edges];
    
    this.renderVisualization();
    this.updateStatistics();
  }

  private renderVisualization(): void {
    if (!this.currentData) return;
    
    // Clear existing elements
    this.container.selectAll('*').remove();
    
    // Setup railway layout
    this.setupLayout();
    
    // Render nodes (railway stations)
    this.renderNodes();
  }

  private setupLayout(): void {
    // Always use railway layout
    this.setupRailwayLayout();
  }

  private setupRailwayLayout(): void {
    // Stop any existing simulation
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    
    if (!this.currentData) return;
    
    // Create logical flow layout calculator
    const logicalLayout = new LogicalFlowLayout(
      {
        ...this.currentData.railway,
        nodes: this.filteredNodes,
        edges: this.filteredEdges
      },
      this.width,
      this.height
    );
    
    // Calculate positions
    logicalLayout.calculate();
    
    // Render logical flow elements
    this.renderLogicalFlows(logicalLayout);
    this.renderLogicalLayers(logicalLayout);
  }

  private renderNodes(): void {
    const nodeGroup = this.container.append('g').attr('class', 'nodes');
    
    const node = nodeGroup.selectAll('.node')
      .data(this.filteredNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .style('cursor', 'pointer');
    
    // COMPACT NODE DESIGN FOR LARGE DATASETS
    
    // Main node circle - smaller and cleaner
    node.append('circle')
      .attr('r', (d: EffectNode) => this.getNodeRadius(d.type))
      .attr('fill', (d: EffectNode) => {
        const isEntryPoint = this.currentData!.railway.entryPoints.includes(d.id);
        return isEntryPoint ? this.nodeColors[d.type] : this.lightenColor(this.nodeColors[d.type], 0.1);
      })
      .attr('stroke', (d: EffectNode) => this.nodeColors[d.type])
      .attr('stroke-width', (d: EffectNode) => {
        const isEntryPoint = this.currentData!.railway.entryPoints.includes(d.id);
        return isEntryPoint ? 3 : 2;
      })
      .style('filter', 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))');
    
    // Compact icon - smaller
    node.append('text')
      .text((d: EffectNode) => this.getNodeIcon(d.type))
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '10px')
      .attr('fill', '#fff')
      .attr('font-weight', 'bold')
      .attr('pointer-events', 'none');
    
    // Compact label - only show on hover or for important nodes
    node.filter((d: EffectNode) => this.isImportantNode(d))
      .append('text')
      .text((d: EffectNode) => this.truncateText(d.name, 12))
      .attr('text-anchor', 'middle')
      .attr('dy', '2.2em')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('fill', (d: EffectNode) => this.nodeColors[d.type])
      .attr('pointer-events', 'none')
      .style('text-shadow', '0 1px 2px rgba(255,255,255,0.9)');
    
    // Add interaction handlers
    node.on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip())
      .on('click', (event, d) => this.onNodeClick(d));
    
    // Apply positions and dragging for force layout
    if (this.simulation) {
      const drag = d3.drag<SVGGElement, EffectNode>()
        .on('start', (event, d) => {
          if (!event.active) this.simulation!.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) this.simulation!.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        });
      
      node.call(drag);
      
      this.simulation.on('tick', () => {
        node.attr('transform', (d: EffectNode) => `translate(${d.x},${d.y})`);
      });
    } else {
      // Static positioning for non-force layouts
      node.attr('transform', (d: EffectNode) => `translate(${d.x},${d.y})`);
    }
  }


  public filterByType(type: string): void {
    if (!this.currentData) return;
    
    // Clear any highlighting when filtering
    this.clearHighlighting();
    this.hideCodeInspectionPanel();
    
    if (type === 'all') {
      this.filteredNodes = [...this.currentData.railway.nodes];
      this.filteredEdges = [...this.currentData.railway.edges];
    } else {
      this.filteredNodes = this.currentData.railway.nodes.filter(node => node.type === type);
      const nodeIds = new Set(this.filteredNodes.map(n => n.id));
      this.filteredEdges = this.currentData.railway.edges.filter(edge => 
        nodeIds.has(edge.source) && nodeIds.has(edge.target)
      );
    }
    
    this.renderVisualization();
  }

  public updateLayout(layoutType: string): void {
    this.renderVisualization();
  }

  // ZOOM CONTROLS FOR LARGE DATASETS
  public zoomIn(): void {
    if (this.zoomBehavior) {
      this.svg.call(
        this.zoomBehavior.scaleBy,
        1.5
      );
    }
  }

  public zoomOut(): void {
    if (this.zoomBehavior) {
      this.svg.call(
        this.zoomBehavior.scaleBy,
        1 / 1.5
      );
    }
  }

  public zoomToFit(): void {
    if (!this.zoomBehavior) return;
    
    // Calculate bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const node of this.filteredNodes) {
      if (node.x !== undefined && node.y !== undefined) {
        minX = Math.min(minX, node.x - 50);
        minY = Math.min(minY, node.y - 50);
        maxX = Math.max(maxX, node.x + 50);
        maxY = Math.max(maxY, node.y + 50);
      }
    }
    
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    
    if (contentWidth > 0 && contentHeight > 0) {
      const scale = Math.min(
        (this.width * 0.9) / contentWidth,
        (this.height * 0.9) / contentHeight
      );
      
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      this.svg.call(
        this.zoomBehavior.transform,
        d3.zoomIdentity
          .translate(this.width / 2, this.height / 2)
          .scale(scale)
          .translate(-centerX, -centerY)
      );
    }
  }

  private getNodeIcon(type: NodeType): string {
    const icons: Record<NodeType, string> = {
      controller: '🌐', // Web/HTTP entry point
      service: '⚙️',   // Business logic processing
      repository: '💾', // Data storage access
      middleware: '🔗', // Request pipeline
      worker: '⚡',     // Background processing
      error: '🚨',      // Error/exception
      utility: '🛠️'    // Helper functions
    };
    return icons[type] || '📦';
  }

  private getNodeRadius(type: NodeType): number {
    // COMPACT SIZES FOR LARGE DATASETS
    const radii: Record<NodeType, number> = {
      controller: 14,   // Entry points - slightly larger
      service: 12,      // Services - medium
      repository: 12,   // Repositories - medium
      middleware: 10,   // Middleware - smaller
      worker: 11,       // Workers - medium-small
      error: 8,         // Errors - smallest
      utility: 9        // Utilities - small
    };
    return radii[type] || 10;
  }

  private isImportantNode(node: EffectNode): boolean {
    // Only show labels for important nodes to reduce clutter
    return node.type === 'controller' || // All HTTP entry points
           this.currentData!.railway.entryPoints.includes(node.id) || // Entry points
           node.name.includes('Service') || // Core services
           node.name.includes('Repository') || // Data access
           node.name.includes('Error'); // Error types
  }

  private lightenColor(color: string, amount: number): string {
    // Lighten hex colors for non-entry-point nodes
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, Math.floor((num >> 16) + amount * 255));
    const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + amount * 255));
    const b = Math.min(255, Math.floor((num & 0x0000FF) + amount * 255));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private truncateText(text: string, maxLength: number): string {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  private showTooltip(event: MouseEvent, node: EffectNode): void {
    const tooltip = document.getElementById('tooltip')!;
    
    tooltip.innerHTML = `
      <strong>${node.name}</strong><br>
      <strong>Type:</strong> ${node.type}<br>
      <strong>File:</strong> ${node.filePath.split('/').pop()}<br>
      <strong>Line:</strong> ${node.line}<br>
      ${node.description ? `<strong>Description:</strong> ${node.description}<br>` : ''}
      ${node.effectSignature ? `
        <strong>Success Type:</strong> ${node.effectSignature.success}<br>
        <strong>Error Types:</strong> ${node.effectSignature.error.join(', ') || 'None'}<br>
        <strong>Dependencies:</strong> ${node.effectSignature.dependencies.join(', ') || 'None'}
      ` : ''}
    `;
    
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
  }

  private hideTooltip(): void {
    const tooltip = document.getElementById('tooltip')!;
    tooltip.style.display = 'none';
  }

  private onNodeClick(node: EffectNode): void {
    console.log('Node clicked:', node);
    
    // Toggle selection
    if (this.selectedNode?.id === node.id) {
      this.clearHighlighting();
      this.hideCodeInspectionPanel();
    } else {
      this.selectedNode = node;
      this.highlightNodeAndConnections(node);
      this.showCodeInspectionPanel(node);
    }
  }
  
  private highlightNodeAndConnections(selectedNode: EffectNode): void {
    this.highlightedNodes.clear();
    
    // Add the selected node
    this.highlightedNodes.add(selectedNode.id);
    
    // Find ALL upstream dependencies (what this node depends on, recursively)
    const upstreamNodes = this.getAllUpstreamDependencies(selectedNode.id);
    upstreamNodes.forEach(nodeId => this.highlightedNodes.add(nodeId));
    
    // Find ALL downstream dependents (what depends on this node, recursively) 
    const downstreamNodes = this.getAllDownstreamDependents(selectedNode.id);
    downstreamNodes.forEach(nodeId => this.highlightedNodes.add(nodeId));
    
    console.log(`🔍 Selected: ${selectedNode.name}`);
    console.log(`⬆️ Upstream dependencies: ${upstreamNodes.length} nodes`);
    console.log(`⬇️ Downstream dependents: ${downstreamNodes.length} nodes`);
    console.log(`📊 Total highlighted: ${this.highlightedNodes.size} nodes`);
    
    // Apply visual highlighting
    this.updateNodeHighlighting();
    this.updateEdgeHighlighting();
  }
  
  private getConnectedNodes(nodeId: string): string[] {
    const connected = new Set<string>();
    
    for (const edge of this.filteredEdges) {
      if (edge.source === nodeId) {
        connected.add(edge.target);
      }
      if (edge.target === nodeId) {
        connected.add(edge.source);
      }
    }
    
    return Array.from(connected);
  }
  
  private getAllUpstreamDependencies(nodeId: string): string[] {
    const visited = new Set<string>();
    const upstream = new Set<string>();
    
    const traverseUpstream = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) {
        return;
      }
      visited.add(currentNodeId);
      
      // Find nodes this current node depends on (edge.target === currentNodeId)
      for (const edge of this.filteredEdges) {
        if (edge.target === currentNodeId && !visited.has(edge.source)) {
          upstream.add(edge.source);
          traverseUpstream(edge.source); // Recurse to find dependencies of dependencies
        }
      }
    };
    
    traverseUpstream(nodeId);
    return Array.from(upstream);
  }
  
  private getAllDownstreamDependents(nodeId: string): string[] {
    const visited = new Set<string>();
    const downstream = new Set<string>();
    
    const traverseDownstream = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) {
        return;
      }
      visited.add(currentNodeId);
      
      // Find nodes that depend on this current node (edge.source === currentNodeId)
      for (const edge of this.filteredEdges) {
        if (edge.source === currentNodeId && !visited.has(edge.target)) {
          downstream.add(edge.target);
          traverseDownstream(edge.target); // Recurse to find dependents of dependents
        }
      }
    };
    
    traverseDownstream(nodeId);
    return Array.from(downstream);
  }
  
  private updateNodeHighlighting(): void {
    this.container.selectAll('.node circle')
      .classed('highlighted', (d: EffectNode) => d.id === this.selectedNode?.id)
      .classed('connected', (d: EffectNode) => this.highlightedNodes.has(d.id))
      .classed('dimmed', (d: EffectNode) => !this.highlightedNodes.has(d.id));
  }
  
  private updateEdgeHighlighting(): void {
    if (!this.container.select('.logical-flows').empty()) {
      this.container.select('.logical-flows').selectAll('path')
        .style('display', (d: any, i: number, nodes: any[]) => {
          const pathElement = nodes[i];
          const edgeId = pathElement.getAttribute('data-edge-id');
          
          // Find the corresponding edge in our data
          const edge = this.filteredEdges.find(e => e.id === edgeId);
          
          if (edge) {
            // Show if BOTH source and target are in the highlighted set
            const bothNodesHighlighted = this.highlightedNodes.has(edge.source) && this.highlightedNodes.has(edge.target);
            return bothNodesHighlighted ? 'block' : 'none';
          }
          
          return 'none';
        })
        .style('stroke-width', (d: any, i: number, nodes: any[]) => {
          const pathElement = nodes[i];
          const edgeId = pathElement.getAttribute('data-edge-id');
          const edge = this.filteredEdges.find(e => e.id === edgeId);
          
          if (edge && this.highlightedNodes.has(edge.source) && this.highlightedNodes.has(edge.target)) {
            return '3px'; // Slightly thicker for highlighted edges
          }
          return '2px';
        })
        .style('opacity', (d: any, i: number, nodes: any[]) => {
          const pathElement = nodes[i];
          const edgeId = pathElement.getAttribute('data-edge-id');
          const edge = this.filteredEdges.find(e => e.id === edgeId);
          
          if (edge && this.highlightedNodes.has(edge.source) && this.highlightedNodes.has(edge.target)) {
            return '1.0'; // Full opacity for connected edges
          }
          return '0.7';
        })
        .attr('marker-end', (d: any, i: number, nodes: any[]) => {
          const pathElement = nodes[i];
          const edgeId = pathElement.getAttribute('data-edge-id');
          const edge = this.filteredEdges.find(e => e.id === edgeId);
          
          if (edge && this.highlightedNodes.has(edge.source) && this.highlightedNodes.has(edge.target)) {
            // Use highlighted arrows for connected edges
            const edgeType = this.getEdgeTypeFromFlow(pathElement.classList.contains('request-flow') ? 'request-flow' : 
                            pathElement.classList.contains('error-flow') ? 'error-flow' : 'data-flow');
            return `url(#arrow-${edgeType}-highlighted)`;
          } else {
            // Use regular arrows
            const edgeType = this.getEdgeTypeFromFlow(pathElement.classList.contains('request-flow') ? 'request-flow' : 
                            pathElement.classList.contains('error-flow') ? 'error-flow' : 'data-flow');
            return `url(#arrow-${edgeType})`;
          }
        });
    }
  }
  
  private clearHighlighting(): void {
    this.selectedNode = null;
    this.highlightedNodes.clear();
    
    this.container.selectAll('.node circle')
      .classed('highlighted', false)
      .classed('connected', false)
      .classed('dimmed', false);
      
    if (!this.container.select('.logical-flows').empty()) {
      this.container.select('.logical-flows').selectAll('path')
        .style('display', 'block') // Show all edges again
        .style('stroke-width', '2px') // Reset stroke width
        .style('opacity', '0.7') // Reset opacity
        .attr('marker-end', (d: any, i: number, nodes: any[]) => {
          // Reset to regular arrows
          const pathElement = nodes[i];
          const edgeType = this.getEdgeTypeFromFlow(pathElement.classList.contains('request-flow') ? 'request-flow' : 
                          pathElement.classList.contains('error-flow') ? 'error-flow' : 'data-flow');
          return `url(#arrow-${edgeType})`;
        });
    }
  }
  
  private showCodeInspectionPanel(node: EffectNode): void {
    const panel = document.getElementById('code-inspection-panel')!;
    panel.classList.add('visible');
    
    // Update node information
    const nodeInfo = document.getElementById('node-info')!;
    nodeInfo.innerHTML = `
      <div><strong>Name:</strong> ${node.name}</div>
      <div><strong>Type:</strong> <span style="color: ${this.nodeColors[node.type]}; font-weight: bold;">${node.type}</span></div>
      <div><strong>File:</strong> ${node.filePath}</div>
      <div><strong>Line:</strong> ${node.line}</div>
      ${node.description ? `<div><strong>Description:</strong> ${node.description}</div>` : ''}
      
      <div style="margin-top: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button onclick="window.exportLLMAnalysis('${node.id}')" 
                style="background: #007bff; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          🤖 Export for LLM
        </button>
        <button onclick="window.generateEffectExtension('${node.id}')" 
                style="background: #28a745; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          🧮 Effect Calculator
        </button>
        <button onclick="window.exportSystemOverview()" 
                style="background: #6f42c1; color: white; border: none; padding: 0.5rem 1rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
          📊 System Overview
        </button>
      </div>
    `;
    
    // Update effect signature
    const effectSig = document.getElementById('effect-signature')!;
    if (node.effectSignature) {
      effectSig.innerHTML = `
        <div class="code-block">Effect&lt;${node.effectSignature.success}, ${node.effectSignature.error.join(' | ') || 'never'}, ${node.effectSignature.dependencies.join(' & ') || 'never'}&gt;</div>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #666;">
          <div><strong>Success (A):</strong> ${node.effectSignature.success}</div>
          <div><strong>Errors (E):</strong> ${node.effectSignature.error.join(', ') || 'None'}</div>
          <div><strong>Dependencies (R):</strong> ${node.effectSignature.dependencies.join(', ') || 'None'}</div>
        </div>
      `;
    } else {
      effectSig.innerHTML = '<div style="color: #666;">No Effect signature available</div>';
    }
    
    // Update dependencies
    this.updateDependenciesDisplay(node);
    
    // Update modification guide
    this.updateModificationGuide(node);
  }
  
  private updateDependenciesDisplay(node: EffectNode): void {
    const upstreamList = document.getElementById('upstream-deps')!;
    const downstreamList = document.getElementById('downstream-deps')!;
    
    // Get COMPLETE transitive dependency chains
    const upstreamNodeIds = this.getAllUpstreamDependencies(node.id);
    const downstreamNodeIds = this.getAllDownstreamDependents(node.id);
    
    // Convert IDs to node objects and organize by depth/layer
    const upstreamNodes = this.getNodesWithDepthInfo(upstreamNodeIds, node.id, 'upstream');
    const downstreamNodes = this.getNodesWithDepthInfo(downstreamNodeIds, node.id, 'downstream');
    
    // Populate upstream dependencies with hierarchical structure
    upstreamList.innerHTML = upstreamNodes.length > 0 ? 
      `<div style="margin-bottom: 0.5rem; font-weight: bold; color: #007bff;">📊 Complete Dependency Chain (${upstreamNodes.length} nodes)</div>` +
      upstreamNodes.map(nodeInfo => `
        <li class="upstream" style="margin-left: ${nodeInfo.depth * 20}px; border-left: ${nodeInfo.depth > 0 ? '2px solid rgba(0,123,255,0.2)' : 'none'}; padding-left: ${nodeInfo.depth > 0 ? '10px' : '0'};">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: ${this.nodeColors[nodeInfo.node.type]}; font-size: 1.2rem;">${this.getNodeIcon(nodeInfo.node.type)}</span>
            <div>
              <strong>${nodeInfo.node.name}</strong> 
              <span style="background: ${this.nodeColors[nodeInfo.node.type]}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${nodeInfo.node.type}</span>
              ${nodeInfo.depth > 0 ? `<span style="color: #6c757d; font-size: 0.75rem; margin-left: 0.25rem;">⤷ depth ${nodeInfo.depth}</span>` : ''}
              <br><small style="color: #666;">${nodeInfo.node.filePath.split('/').pop()}:${nodeInfo.node.line}</small>
            </div>
          </div>
        </li>
      `).join('') :
      '<li style="color: #666; font-style: italic;">No upstream dependencies</li>';
    
    // Populate downstream dependencies with hierarchical structure
    downstreamList.innerHTML = downstreamNodes.length > 0 ?
      `<div style="margin-bottom: 0.5rem; font-weight: bold; color: #28a745;">📊 Complete Impact Chain (${downstreamNodes.length} nodes)</div>` +
      downstreamNodes.map(nodeInfo => `
        <li class="downstream" style="margin-left: ${nodeInfo.depth * 20}px; border-left: ${nodeInfo.depth > 0 ? '2px solid rgba(40,167,69,0.2)' : 'none'}; padding-left: ${nodeInfo.depth > 0 ? '10px' : '0'};">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: ${this.nodeColors[nodeInfo.node.type]}; font-size: 1.2rem;">${this.getNodeIcon(nodeInfo.node.type)}</span>
            <div>
              <strong>${nodeInfo.node.name}</strong> 
              <span style="background: ${this.nodeColors[nodeInfo.node.type]}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${nodeInfo.node.type}</span>
              ${nodeInfo.depth > 0 ? `<span style="color: #6c757d; font-size: 0.75rem; margin-left: 0.25rem;">⤷ depth ${nodeInfo.depth}</span>` : ''}
              <br><small style="color: #666;">${nodeInfo.node.filePath.split('/').pop()}:${nodeInfo.node.line}</small>
            </div>
          </div>
        </li>
      `).join('') :
      '<li style="color: #666; font-style: italic;">No downstream dependents</li>';
  }
  
  private updateModificationGuide(node: EffectNode): void {
    const guideDiv = document.getElementById('modification-steps')!;
    
    const steps = this.generateModificationSteps(node);
    
    guideDiv.innerHTML = steps.map((step, index) => `
      <div class="guide-step">
        <span class="step-number">${index + 1}</span>
        <strong>${step.title}</strong>
        <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #555;">${step.description}</div>
        ${step.code ? `<div class="code-block" style="margin-top: 0.5rem; font-size: 0.8rem;">${step.code}</div>` : ''}
      </div>
    `).join('');
  }
  
  private generateModificationSteps(node: EffectNode): Array<{title: string; description: string; code?: string}> {
    const steps = [];
    
    // Base steps based on node type
    switch (node.type) {
      case 'controller':
        steps.push(
          {
            title: 'Update Route Handler',
            description: 'Modify the HTTP route handler to include your new functionality.',
            code: `// In ${node.filePath}\nrouter.get('${node.name.includes('GET') ? node.name.split(' ')[1] : '/endpoint'}', (req, res) => {\n  // Add your modifications here\n});`
          },
          {
            title: 'Update Effect Signature',
            description: 'If adding new dependencies or error types, update the Effect signature.',
            code: node.effectSignature ? `Effect<${node.effectSignature.success}, YourNewError | ${node.effectSignature.error.join(' | ')}, YourNewDep & ${node.effectSignature.dependencies.join(' & ')}>` : 'Effect<YourSuccessType, YourErrorType, YourDependencies>'
          }
        );
        break;
        
      case 'service':
        steps.push(
          {
            title: 'Modify Service Implementation',
            description: 'Update the service method to include new functionality.',
            code: `// In ${node.filePath}\nexport const ${node.name} = Context.Tag<${node.name}>()\n\nconst make = (): ${node.name} => ({\n  // Add your new methods here\n});`
          },
          {
            title: 'Update Context Providers',
            description: 'Ensure all consumers provide the updated service dependencies.'
          }
        );
        break;
        
      case 'repository':
        steps.push(
          {
            title: 'Update Database Schema',
            description: 'If adding new fields, create a database migration first.',
            code: `-- Create migration file\nALTER TABLE your_table ADD COLUMN new_field VARCHAR(255);`
          },
          {
            title: 'Modify Repository Methods',
            description: 'Update CRUD operations to handle new fields.',
            code: `// In ${node.filePath}\nexport const create = (data: YourNewType) =>\n  Effect.gen(function* () {\n    // Add new field handling\n    yield* DatabaseService\n  });`
          }
        );
        break;
        
      default:
        steps.push(
          {
            title: 'Modify Implementation',
            description: `Update the ${node.type} implementation in ${node.filePath}`,
          },
          {
            title: 'Test Changes',
            description: 'Run tests to ensure your modifications work correctly.'
          }
        );
    }
    
    // Add unique upstream impact analysis
    const upstreamNodes = this.getUniqueUpstreamNodes(node.id);
    if (upstreamNodes.length > 0) {
      const nodeNames = upstreamNodes.slice(0, 3).map(n => n.name).join(', ');
      const extraCount = upstreamNodes.length > 3 ? ` and ${upstreamNodes.length - 3} others` : '';
      steps.push({
        title: 'Check Upstream Impact',
        description: `Your changes may affect: ${nodeNames}${extraCount}. Review these components for compatibility.`
      });
    }
    
    // Add unique downstream impact analysis
    const downstreamNodes = this.getUniqueDownstreamNodes(node.id);
    if (downstreamNodes.length > 0) {
      const nodeNames = downstreamNodes.slice(0, 3).map(n => n.name).join(', ');
      const extraCount = downstreamNodes.length > 3 ? ` and ${downstreamNodes.length - 3} others` : '';
      steps.push({
        title: 'Update Downstream Dependencies',
        description: `Update these dependent components: ${nodeNames}${extraCount}`
      });
    }
    
    return steps;
  }
  
  private getUniqueUpstreamNodes(nodeId: string): EffectNode[] {
    const upstreamMap = new Map<string, EffectNode>();
    for (const edge of this.filteredEdges) {
      if (edge.target === nodeId) {
        const sourceNode = this.filteredNodes.find(n => n.id === edge.source);
        if (sourceNode) {
          upstreamMap.set(sourceNode.id, sourceNode);
        }
      }
    }
    return Array.from(upstreamMap.values());
  }
  
  private getUniqueDownstreamNodes(nodeId: string): EffectNode[] {
    const downstreamMap = new Map<string, EffectNode>();
    for (const edge of this.filteredEdges) {
      if (edge.source === nodeId) {
        const targetNode = this.filteredNodes.find(n => n.id === edge.target);
        if (targetNode) {
          downstreamMap.set(targetNode.id, targetNode);
        }
      }
    }
    return Array.from(downstreamMap.values());
  }

  private getNodesWithDepthInfo(nodeIds: string[], rootNodeId: string, direction: 'upstream' | 'downstream'): Array<{node: EffectNode, depth: number}> {
    const result: Array<{node: EffectNode, depth: number}> = [];
    const visited = new Set<string>();
    
    // Calculate depth for each node using BFS
    const calculateDepth = (startNodeId: string) => {
      const queue: Array<{nodeId: string, depth: number}> = [{nodeId: startNodeId, depth: 0}];
      const depthMap = new Map<string, number>();
      const queueVisited = new Set<string>();
      
      while (queue.length > 0) {
        const {nodeId, depth} = queue.shift()!;
        
        if (queueVisited.has(nodeId)) continue;
        queueVisited.add(nodeId);
        depthMap.set(nodeId, depth);
        
        // Find next level nodes
        for (const edge of this.filteredEdges) {
          const nextNodeId = direction === 'upstream' 
            ? (edge.target === nodeId ? edge.source : null)
            : (edge.source === nodeId ? edge.target : null);
            
          if (nextNodeId && !queueVisited.has(nextNodeId) && nodeIds.includes(nextNodeId)) {
            queue.push({nodeId: nextNodeId, depth: depth + 1});
          }
        }
      }
      
      return depthMap;
    };
    
    // Calculate depths from the root node
    const depthMap = calculateDepth(rootNodeId);
    
    // Convert node IDs to node objects with depth information
    for (const nodeId of nodeIds) {
      const node = this.filteredNodes.find(n => n.id === nodeId);
      if (node && !visited.has(nodeId)) {
        visited.add(nodeId);
        result.push({
          node,
          depth: depthMap.get(nodeId) || 0
        });
      }
    }
    
    // Sort by depth first, then by type and name
    result.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.node.type !== b.node.type) return a.node.type.localeCompare(b.node.type);
      return a.node.name.localeCompare(b.node.name);
    });
    
    return result;
  }
  
  private getUpstreamNodes(nodeId: string): EffectNode[] {
    const upstream: EffectNode[] = [];
    for (const edge of this.filteredEdges) {
      if (edge.target === nodeId) {
        const sourceNode = this.filteredNodes.find(n => n.id === edge.source);
        if (sourceNode) upstream.push(sourceNode);
      }
    }
    return upstream;
  }
  
  private getDownstreamNodes(nodeId: string): EffectNode[] {
    const downstream: EffectNode[] = [];
    for (const edge of this.filteredEdges) {
      if (edge.source === nodeId) {
        const targetNode = this.filteredNodes.find(n => n.id === edge.target);
        if (targetNode) downstream.push(targetNode);
      }
    }
    return downstream;
  }
  
  private hideCodeInspectionPanel(): void {
    const panel = document.getElementById('code-inspection-panel')!;
    panel.classList.remove('visible');
  }

  private renderLogicalFlows(logicalLayout: LogicalFlowLayout): void {
    const flowGroup = this.container.append('g').attr('class', 'logical-flows');
    
    const flows = logicalLayout.generateLogicalFlows();
    
    flows.forEach(flow => {
      flowGroup.append('path')
        .attr('class', `flow ${flow.type}`)
        .attr('data-edge-id', flow.id) // Store the edge ID for highlighting
        .attr('data-source', flow.from?.x ? this.getNodeIdByPosition(flow.from.x, flow.from.y) : '')
        .attr('data-target', flow.to?.x ? this.getNodeIdByPosition(flow.to.x, flow.to.y) : '')
        .attr('d', flow.path)
        .attr('stroke', this.getFlowColor(flow.type))
        .attr('stroke-width', flow.type === 'request-flow' ? 3 : 2)
        .attr('stroke-dasharray', flow.type === 'error-flow' ? '8,4' : null)
        .attr('fill', 'none')
        .attr('opacity', 0.7)
        .attr('marker-end', `url(#arrow-${this.getEdgeTypeFromFlow(flow.type)})`);
    });
  }
  
  private getNodeIdByPosition(x: number, y: number): string {
    // Find node by approximate position
    for (const node of this.filteredNodes) {
      if (node.x && node.y && Math.abs(node.x - x) < 10 && Math.abs(node.y - y) < 10) {
        return node.id;
      }
    }
    return '';
  }

  private renderLogicalLayers(logicalLayout: LogicalFlowLayout): void {
    const layerGroup = this.container.append('g').attr('class', 'logical-layers');
    
    const separators = logicalLayout.generateLayerSeparators();
    const layers = logicalLayout.getLogicalLayers();
    
    separators.forEach((separator, index) => {
      const layerIndex = separator.layer;
      const layer = layers[layerIndex];
      const layerWidth = separator.width || 250;
      
      // MAIN LAYER CONTAINER DIV (groups everything together)
      const layerContainer = layerGroup.append('g')
        .attr('class', `layer-container layer-${layer.key}`)
        .attr('data-layer', layer.name);
      
      // Main layer background div (the outer container with background color)
      layerContainer.append('rect')
        .attr('class', 'layer-main-background')
        .attr('x', separator.x - (layerWidth / 2))
        .attr('y', 0)
        .attr('width', layerWidth)
        .attr('height', this.height)
        .attr('fill', this.getLayerBackgroundColor(layerIndex))
        .attr('stroke', `${layer.color}30`) // Subtle colored border
        .attr('stroke-width', 2)
        .attr('rx', 12) // Rounded corners like a modern div
        .attr('opacity', 0.08);
      
      // HEADER DIV (sits on its own line at the top)
      const headerContainer = layerContainer.append('g')
        .attr('class', 'layer-header-div');
      
      // Header background (separate background for header only)
      headerContainer.append('rect')
        .attr('class', 'layer-header-background')
        .attr('x', separator.x - (layerWidth / 2) + 12) // 12px margin from main div
        .attr('y', 12) // 12px margin from top
        .attr('width', layerWidth - 24) // 24px total margin
        .attr('height', 40) // Proper header height
        .attr('fill', layer.color)
        .attr('stroke', 'rgba(255, 255, 255, 0.4)')
        .attr('stroke-width', 1)
        .attr('rx', 8)
        .attr('opacity', 0.95)
        .style('filter', 'drop-shadow(0px 2px 6px rgba(0,0,0,0.15))');
      
      // Header text (centered in the header div)
      headerContainer.append('text')
        .attr('class', 'layer-header-text')
        .attr('x', separator.x)
        .attr('y', 36) // Centered vertically in the 40px header
        .text(layer.name)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'system-ui, -apple-system, sans-serif')
        .attr('font-size', '14px')
        .attr('font-weight', '700')
        .attr('fill', '#fff')
        .attr('letter-spacing', '0.5px')
        .style('text-shadow', '0 1px 3px rgba(0,0,0,0.4)');
      
      // CONTENT DIV (contains the actual nodes with padding)
      const contentContainer = layerContainer.append('g')
        .attr('class', 'layer-content-div');
      
      // Content area background (like a padded content div inside the main div)
      contentContainer.append('rect')
        .attr('class', 'layer-content-background')
        .attr('x', separator.x - (layerWidth / 2) + 20) // 20px padding from main div
        .attr('y', 65) // Start below header with 13px margin
        .attr('width', layerWidth - 40) // 40px total padding (20px each side)
        .attr('height', this.height - 85) // Leave 20px bottom margin
        .attr('fill', 'rgba(255, 255, 255, 0.03)') // Very subtle content background
        .attr('stroke', 'rgba(255, 255, 255, 0.15)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .attr('rx', 6)
        .attr('opacity', 0.8);
      
      // Add subtle padding indicators (like CSS padding visualization)
      const paddingIndicator = contentContainer.append('g')
        .attr('class', 'padding-indicators')
        .attr('opacity', 0.3);
      
      // Top padding line
      paddingIndicator.append('line')
        .attr('x1', separator.x - (layerWidth / 2) + 20)
        .attr('y1', 65)
        .attr('x2', separator.x + (layerWidth / 2) - 20)
        .attr('y2', 65)
        .attr('stroke', layer.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.2);
      
      // Bottom padding line
      paddingIndicator.append('line')
        .attr('x1', separator.x - (layerWidth / 2) + 20)
        .attr('y1', this.height - 20)
        .attr('x2', separator.x + (layerWidth / 2) - 20)
        .attr('y2', this.height - 20)
        .attr('stroke', layer.color)
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '2,2')
        .attr('opacity', 0.2);
      
      // Layer separator (between main container divs)
      if (index < separators.length - 1) {
        layerContainer.append('line')
          .attr('class', 'layer-separator')
          .attr('x1', separator.x + (layerWidth / 2))
          .attr('y1', 0)
          .attr('x2', separator.x + (layerWidth / 2))
          .attr('y2', this.height)
          .attr('stroke', 'rgba(0, 0, 0, 0.1)')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '8,8')
          .attr('opacity', 0.4);
      }
    });
  }

  private getFlowColor(flowType: 'request-flow' | 'data-flow' | 'error-flow'): string {
    switch (flowType) {
      case 'request-flow': return '#007bff';
      case 'data-flow': return '#28a745';
      case 'error-flow': return '#dc3545';
      default: return '#6c757d';
    }
  }

  private getEdgeTypeFromFlow(flowType: 'request-flow' | 'data-flow' | 'error-flow'): EdgeType {
    switch (flowType) {
      case 'request-flow': return 'dependency';
      case 'data-flow': return 'success';
      case 'error-flow': return 'error';
      default: return 'pipe';
    }
  }

  private getLayerBackgroundColor(layerIndex: number): string {
    const colors = ['#28a745', '#6f42c1', '#007bff', '#ffc107', '#fd7e14', '#6c757d', '#dc3545'];
    return colors[layerIndex] || '#6c757d';
  }

  private updateStatistics(): void {
    if (!this.currentData) return;
    
    const stats = this.currentData.statistics;
    
    document.getElementById('total-nodes')!.textContent = stats.totalNodes.toString();
    document.getElementById('total-edges')!.textContent = stats.totalEdges.toString();
    
    // Update node types list
    const nodeTypesList = document.getElementById('node-types-list')!;
    nodeTypesList.innerHTML = '';
    
    Object.entries(stats.nodesPerType).forEach(([type, count]) => {
      if (count > 0) {
        const div = document.createElement('div');
        div.className = `node-type ${type}`;
        div.innerHTML = `
          <div>
            <span class="type-icon" style="background-color: ${this.nodeColors[type as NodeType]}"></span>
            ${type}
          </div>
          <span>${count}</span>
        `;
        div.addEventListener('click', () => {
          const filterSelect = document.getElementById('filter-select') as HTMLSelectElement;
          filterSelect.value = type;
          this.filterByType(type);
        });
        nodeTypesList.appendChild(div);
      }
    });
    
    // Update error types list  
    const errorTypesList = document.getElementById('error-types-list')!;
    errorTypesList.innerHTML = '';
    
    stats.errorTypes.forEach(errorType => {
      const div = document.createElement('div');
      div.className = 'node-type error';
      div.innerHTML = `
        <div>
          <span class="type-icon" style="background-color: ${this.nodeColors.error}"></span>
          ${errorType}
        </div>
      `;
      errorTypesList.appendChild(div);
    });
  }
}