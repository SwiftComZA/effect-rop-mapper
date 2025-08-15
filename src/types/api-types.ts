/**
 * Purpose: Type definitions for API responses and data structures
 * Dependencies: Effect node types
 * 
 * Example Input:
 * ```
 * import { APIAnalysisResult } from './api-types';
 * ```
 * 
 * Expected Output:
 * ```
 * Strongly typed API response structures
 * ```
 */

import type { EffectNode } from './effect-node.js';

export interface APIAnalysisResult {
  foundEffect: EffectNode;
  upstreamCount: number;
  downstreamCount: number;
  upstreamNodes: EffectNode[];
  downstreamNodes: EffectNode[];
  riskLevel: 'low' | 'medium' | 'high';
  operation: string;
  timestamp: string;
  lastAnalysis?: string;
  modificationGuide?: string[];
}

export interface FunctionAnalysisAPIResponse {
  metadata: {
    analyzedAt: string;
    targetDirectory: string;
    totalFunctions: number;
    totalFolders: number;
    avgDependencies: number;
  };
  functions: Array<{
    name: string;
    file: string;
    path: string;
    folder: string;
    startLine: number;
    endLine: number;
    kind: string;
    parameters: string[];
    callsCount: number;
    calledByCount: number;
    calls: Array<{
      name: string;
      file: string;
      line: number;
    }>;
    calledBy: Array<{
      name: string;
      file: string;
      line: number;
    }>;
  }>;
}