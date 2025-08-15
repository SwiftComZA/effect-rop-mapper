/**
 * Purpose: Type definitions for function analyzer to ensure strong typing
 * Dependencies: TypeScript compiler API for AST node types
 * 
 * Example Input:
 * ```
 * import { NestedStructure, DependencyTree } from './function-analyzer-types';
 * ```
 * 
 * Expected Output:
 * ```
 * Strongly typed data structures with no 'any' types
 * ```
 */

import * as ts from 'typescript';

// Function display types for UI/export
export interface FunctionDisplay {
  name: string;
  lines: string;
  parameters: string[];
  callsCount: number;
  calledByCount: number;
  calls: string[];
  calledBy: string[];
}

// Nested structure types for path-based organization
export interface NestedFile {
  [fileName: string]: FunctionDisplay[] | NestedFolder;
}

export interface NestedFolder {
  [folderName: string]: FunctionDisplay[] | NestedFolder;
}

export type NestedStructure = NestedFolder;

// Dependency tree types
export interface DependencyEntry {
  name: string;
  file: string;
  lines: string;
  parameters: string[];
  callsCount: number;
  calledByCount: number;
  calls: Array<{
    name: string;
    location: string;
  }>;
  calledBy: Array<{
    name: string;
    location: string;
  }>;
}

export interface DependencyTree {
  zeroDependencies: DependencyEntry[];
  lowComplexity: DependencyEntry[];      // 1-3 deps
  mediumComplexity: DependencyEntry[];   // 4-9 deps
  highComplexity: DependencyEntry[];     // 10-19 deps
  veryHighComplexity: DependencyEntry[]; // 20+ deps
}

// Folder statistics types
export interface HighComplexityFunction {
  name: string;
  file: string;
  lines: string;
  deps: number;
}

export interface FolderStatistics {
  totalFunctions: number;
  totalLines: number;
  avgDependencies: number;
  maxDependencies: number;
  zeroDepsCount: number;
  highComplexityFunctions: HighComplexityFunction[];
  avgLinesPerFunction?: number;
}

export interface FolderStatsMap {
  [folderName: string]: FolderStatistics;
}

// Top complex function type
export interface TopComplexFunction {
  name: string;
  file: string;
  lines: string;
  callsCount: number;
  calledByCount: number;
  calls: string[];
  calledBy: string[];
}

// Node with parameters type for TypeScript AST
export interface NodeWithParameters extends ts.Node {
  parameters?: ts.NodeArray<ts.ParameterDeclaration>;
}