/**
 * Purpose: Type definitions for window object extensions
 * Dependencies: Effect node types
 * 
 * Example Input:
 * ```
 * import { WindowExtensions } from './window-extensions';
 * ```
 * 
 * Expected Output:
 * ```
 * Type-safe window object with custom methods
 * ```
 */

export interface WindowExtensions {
  exportLLMAnalysis: (nodeId: string) => void;
  generateEffectExtension: (nodeId: string) => void;
  exportSystemOverview: () => void;
  queryEffectAPI: (query: string, operation?: string, context?: string) => Promise<void>;
  analyzeEffect: (query: string) => Promise<void>;
  modifyEffect: (query: string, context?: string) => Promise<void>;
  useEffect: (query: string, context?: string) => Promise<void>;
  extendEffect: (query: string, context?: string) => Promise<void>;
  queryEffect: (query: string, operation?: string, context?: string) => void;
  downloadEffectAnalysis: (query: string, operation?: string, context?: string) => void;
}

declare global {
  interface Window extends WindowExtensions {}
}