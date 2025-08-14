/**
 * Purpose: Type definitions for Effect TS railway visualization nodes and edges
 * Dependencies: None
 * 
 * Example Input:
 * ```
 * { id: "service-1", type: "service", name: "DatabaseService" }
 * ```
 * 
 * Expected Output:
 * ```
 * Typed node structure for D3 visualization
 * ```
 */

export type NodeType = 'controller' | 'service' | 'repository' | 'middleware' | 'utility' | 'worker' | 'error';

export type EdgeType = 'success' | 'error' | 'dependency' | 'pipe';

export interface EffectSignature {
  success: string;    // A type
  error: string[];    // E type (can have multiple error types)
  dependencies: string[]; // R type
}

export interface EffectNode {
  id: string;
  name: string;
  type: NodeType;
  filePath: string;
  line: number;
  effectSignature?: EffectSignature;
  description?: string;
  // D3 layout properties
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface EffectEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  errorType?: string;
}

export interface EffectRailway {
  nodes: EffectNode[];
  edges: EffectEdge[];
  layers: LayerMap;
  entryPoints: string[]; // Node IDs that are HTTP endpoints
}

export interface LayerMap {
  controllers: string[];
  services: string[];
  repositories: string[];
  middleware: string[];
  utilities: string[];
  workers: string[];
  errors: string[];
}

export interface AnalysisResult {
  railway: EffectRailway;
  statistics: {
    totalNodes: number;
    totalEdges: number;
    nodesPerType: Record<NodeType, number>;
    edgesPerType: Record<EdgeType, number>;
    errorTypes: string[];
    dependencyTypes: string[];
  };
}