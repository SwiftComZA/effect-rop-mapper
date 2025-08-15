/**
 * Purpose: Bridge between pure functional renderer and D3.js DOM manipulation
 * Dependencies: railway-renderer-pure, D3.js
 * 
 * Example Input:
 * ```
 * applyRenderInstructions(svgElement, instructions)
 * ```
 * 
 * Expected Output:
 * ```
 * DOM updated with visualization
 * ```
 */

import * as d3 from 'd3';
import { renderRailway, filterVisualization, highlightPath, generateStatistics, exportVisualization } from './railway-renderer-pure.js';
import type { 
  RenderInstruction, 
  RenderConfig, 
  VisualizationState,
  EventHandlers,
  NodePosition,
  EdgeData
} from './railway-renderer-pure.js';
import type { AnalysisResult, EffectNode } from '../types/effect-node.js';

// Pure function to apply render instructions to DOM
export const applyRenderInstructions = (
  container: d3.Selection<SVGElement, unknown, null, undefined>,
  instructions: RenderInstruction[]
): void => {
  instructions.forEach(instruction => {
    applyInstruction(container, instruction);
  });
};

// Helper function to apply a single instruction
const applyInstruction = (
  parent: d3.Selection<any, unknown, null, undefined>,
  instruction: RenderInstruction
): void => {
  switch (instruction.type) {
    case 'svg-element':
      const elem = parent.append(instruction.tag);
      Object.entries(instruction.attributes).forEach(([key, value]) => {
        elem.attr(key, value);
      });
      if (instruction.children) {
        instruction.children.forEach(child => applyInstruction(elem, child));
      }
      break;
      
    case 'group':
      const group = parent.append('g')
        .attr('class', instruction.className);
      if (instruction.transform) {
        group.attr('transform', instruction.transform);
      }
      instruction.children.forEach(child => applyInstruction(group, child));
      break;
      
    case 'path':
      parent.append('path')
        .attr('d', instruction.d)
        .attr('stroke', instruction.stroke)
        .attr('stroke-width', instruction.strokeWidth)
        .attr('fill', instruction.fill || 'none')
        .attr('marker-end', instruction.markerEnd || null)
        .attr('opacity', instruction.opacity || 1)
        .attr('class', instruction.className || '');
      break;
      
    case 'text':
      parent.append('text')
        .text(instruction.text)
        .attr('x', instruction.x)
        .attr('y', instruction.y)
        .attr('font-size', instruction.fontSize)
        .attr('fill', instruction.fill)
        .attr('text-anchor', instruction.textAnchor || 'start')
        .attr('font-weight', instruction.fontWeight || 'normal')
        .attr('dy', instruction.dy || '0');
      break;
      
    case 'circle':
      parent.append('circle')
        .attr('cx', instruction.cx)
        .attr('cy', instruction.cy)
        .attr('r', instruction.r)
        .attr('fill', instruction.fill)
        .attr('stroke', instruction.stroke)
        .attr('stroke-width', instruction.strokeWidth)
        .attr('class', instruction.className || '');
      break;
      
    case 'rect':
      parent.append('rect')
        .attr('x', instruction.x)
        .attr('y', instruction.y)
        .attr('width', instruction.width)
        .attr('height', instruction.height)
        .attr('fill', instruction.fill)
        .attr('stroke', instruction.stroke || 'none')
        .attr('stroke-width', instruction.strokeWidth || 0)
        .attr('rx', instruction.rx || 0)
        .attr('opacity', instruction.opacity || 1);
      break;
      
    case 'marker':
      const marker = parent.append('marker')
        .attr('id', instruction.id)
        .attr('viewBox', instruction.viewBox)
        .attr('refX', instruction.refX)
        .attr('refY', instruction.refY)
        .attr('markerWidth', instruction.markerWidth)
        .attr('markerHeight', instruction.markerHeight)
        .attr('orient', instruction.orient);
      applyInstruction(marker, instruction.path);
      break;
      
    case 'pattern':
      const pattern = parent.append('pattern')
        .attr('id', instruction.id)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', instruction.width)
        .attr('height', instruction.height);
      instruction.children.forEach(child => applyInstruction(pattern, child));
      break;
  }
};

// Wrapper class that uses pure functions internally
export class RailwayRendererBridge {
  private svg: d3.Selection<SVGElement, unknown, null, undefined>;
  private container: d3.Selection<SVGGElement, unknown, null, undefined>;
  private currentState: VisualizationState | null = null;
  private width: number;
  private height: number;
  private tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any> | null = null;

  constructor(svgElement: SVGElement | HTMLElement) {
    // Initialize D3 selection
    this.svg = d3.select(svgElement as SVGElement);
    
    // Get dimensions
    const rect = svgElement.getBoundingClientRect();
    this.width = rect.width || 1200;
    this.height = rect.height || 800;
    
    // Setup SVG
    this.svg
      .attr('width', this.width)
      .attr('height', this.height);
    
    // Create main container with zoom
    const zoom = d3.zoom<SVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => this.handleZoom(event));
    
    this.svg.call(zoom);
    
    this.container = this.svg.append('g').attr('class', 'main-container');
    
    // Create tooltip
    this.createTooltip();
  }

  public render(data: AnalysisResult): void {
    // Clear existing content
    this.container.selectAll('*').remove();
    
    // Use pure function to generate instructions
    const config: RenderConfig = {
      width: this.width,
      height: this.height,
      showLabels: true,
      showMetrics: true
    };
    
    const { instructions, state, handlers } = renderRailway(data, config);
    
    // Store state
    this.currentState = state;
    
    // Apply instructions to DOM
    applyRenderInstructions(this.container, instructions);
    
    // Setup event handlers
    this.setupEventHandlers(handlers);
    
    // Update statistics display
    this.updateStatistics();
  }

  private handleZoom(event: d3.D3ZoomEvent<SVGElement, unknown>): void {
    this.container.attr('transform', event.transform.toString());
    
    if (this.currentState) {
      this.currentState.zoomLevel = event.transform.k;
      this.currentState.panX = event.transform.x;
      this.currentState.panY = event.transform.y;
    }
  }

  private createTooltip(): void {
    this.tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('opacity', 0)
      .style('position', 'absolute')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '10px')
      .style('border-radius', '5px')
      .style('font-size', '12px')
      .style('pointer-events', 'none');
  }

  private setupEventHandlers(handlers: EventHandlers): void {
    console.log('Setting up event handlers, currentState:', this.currentState);
    console.log('Node positions:', this.currentState?.nodes);
    
    // Setup node interactions
    this.container.selectAll('.node')
      .on('click', (event, d: any) => {
        console.log('Node clicked, d:', d, 'event:', event);
        
        if (handlers.onNodeClick && this.currentState) {
          // Find the node by matching the transform position
          const transform = d3.select(event.currentTarget).attr('transform');
          console.log('Transform:', transform);
          
          // Extract x,y from transform
          const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);
          if (match) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            console.log('Extracted position:', x, y);
            
            const nodePos = this.currentState.nodes.find(n => 
              Math.abs(n.x - x) < 0.01 && Math.abs(n.y - y) < 0.01
            );
            console.log('Found node position:', nodePos);
            
            if (nodePos) {
              handlers.onNodeClick(nodePos.node);
            }
          }
        }
      })
      .on('mouseover', (event) => {
        if (this.tooltip && this.currentState) {
          const transform = d3.select(event.currentTarget).attr('transform');
          const match = transform?.match(/translate\(([^,]+),([^)]+)\)/);
          
          if (match) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            
            const nodePos = this.currentState.nodes.find(n => 
              Math.abs(n.x - x) < 0.01 && Math.abs(n.y - y) < 0.01
            );
            
            if (nodePos) {
              this.showTooltip(event, nodePos.node);
            }
          }
        }
      })
      .on('mouseout', () => {
        if (this.tooltip) {
          this.hideTooltip();
        }
      });
  }

  private showTooltip(event: MouseEvent, node: EffectNode): void {
    if (!this.tooltip) return;
    
    const content = `
      <strong>${node.name}</strong><br/>
      Type: ${node.type}<br/>
      File: ${node.filePath}<br/>
      Line: ${node.line}
    `;
    
    this.tooltip
      .html(content)
      .style('opacity', 1)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');
  }

  private hideTooltip(): void {
    if (!this.tooltip) return;
    
    this.tooltip.style('opacity', 0);
  }

  public filter(type: string, searchTerm?: string): void {
    if (!this.currentState) return;
    
    // Use pure function to filter
    const filteredState = filterVisualization(
      this.currentState,
      type as any,
      searchTerm
    );
    
    // Update visualization
    this.updateVisualization(filteredState);
  }

  public filterByType(type: string): void {
    this.filter(type);
  }

  public highlightDependencies(nodeId: string, direction: 'upstream' | 'downstream' | 'both'): void {
    if (!this.currentState) return;
    
    // Use pure function to highlight
    const highlightedState = highlightPath(
      this.currentState,
      nodeId,
      direction
    );
    
    // Update visualization
    this.updateVisualization(highlightedState);
  }

  private updateVisualization(newState: VisualizationState): void {
    this.currentState = newState;
    
    // Update node visibility
    this.container.selectAll('.node')
      .style('opacity', (d: any) => {
        const isVisible = newState.nodes.some(n => 
          n.x === d.x && n.y === d.y
        );
        return isVisible ? 1 : 0.2;
      });
    
    // Update edge visibility and highlighting
    this.container.selectAll('.edge')
      .style('opacity', (d: any) => {
        const edge = newState.edges.find(e => 
          e.source === d.source && e.target === d.target
        );
        if (!edge) return 0.1;
        return edge.isHighlighted ? 1 : 0.5;
      })
      .style('stroke-width', (d: any) => {
        const edge = newState.edges.find(e => 
          e.source === d.source && e.target === d.target
        );
        return edge?.isHighlighted ? 3 : 2;
      });
  }

  private updateStatistics(): void {
    if (!this.currentState) return;
    
    // Use pure function to generate statistics
    const stats = generateStatistics(this.currentState);
    
    // Update UI (if there's a statistics panel)
    const statsPanel = document.getElementById('statistics');
    if (statsPanel) {
      const statsHtml = Object.entries(stats)
        .map(([key, value]) => `<div>${key}: ${value}</div>`)
        .join('');
      statsPanel.innerHTML = statsHtml;
    }
  }

  public exportData(format: 'json' | 'svg' | 'png' = 'json'): void {
    if (!this.currentState) return;
    
    // Use pure function to export
    const exportData = exportVisualization(this.currentState, format);
    
    if (format === 'json') {
      // Download JSON
      const blob = new Blob([exportData as string], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'railway-visualization.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  public zoomToFit(): void {
    if (!this.currentState || this.currentState.nodes.length === 0) return;
    
    // Calculate bounding box
    const minX = Math.min(...this.currentState.nodes.map(n => n.x));
    const maxX = Math.max(...this.currentState.nodes.map(n => n.x));
    const minY = Math.min(...this.currentState.nodes.map(n => n.y));
    const maxY = Math.max(...this.currentState.nodes.map(n => n.y));
    
    const width = maxX - minX;
    const height = maxY - minY;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    
    // Calculate scale
    const scale = 0.9 / Math.max(width / this.width, height / this.height);
    
    // Apply transform
    const transform = d3.zoomIdentity
      .translate(this.width / 2, this.height / 2)
      .scale(scale)
      .translate(-midX, -midY);
    
    this.svg.transition()
      .duration(750)
      .call(d3.zoom<SVGElement, unknown>().transform, transform);
  }
}