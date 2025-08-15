/**
 * Purpose: Pure functional targeted Effect analyzer for specific node queries
 * Dependencies: Analysis results, Effect node types
 * 
 * Example Input:
 * ```
 * analyzeEffect(analysisResult, 'UsersRepository', 'modify')
 * ```
 * 
 * Expected Output:
 * ```
 * Quick targeted analysis with modification guidance
 * ```
 */

import type { AnalysisResult, EffectNode } from '../types/effect-node.js';

export interface TargetedQuery {
  query: string; // Effect name, file:line, or node name
  operation?: 'modify' | 'use' | 'extend' | 'delete' | 'analyze';
  context?: string; // Additional context about what the LLM wants to do
}

export interface TargetedResult {
  foundEffect: EffectNode;
  quickSummary: string;
  upstreamImpacts: ImpactSummary;
  downstreamImpacts: ImpactSummary;
  modificationGuidance: ModificationGuidance;
  usagePatterns: UsagePattern[];
  riskAssessment: RiskAssessment;
  quickActions: QuickAction[];
}

export interface ImpactSummary {
  totalNodes: number;
  criticalPaths: string[];
  layersAffected: string[];
  riskLevel: 'low' | 'medium' | 'high';
  summary: string;
}

export interface ModificationGuidance {
  canModifySafely: boolean;
  requiredChanges: string[];
  breakingChanges: string[];
  testingRequired: string[];
  estimatedEffort: string;
}

export interface UsagePattern {
  pattern: string;
  description: string;
  codeExample: string;
  frequency: 'common' | 'uncommon' | 'rare';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: string[];
  mitigations: string[];
  recommendation: string;
}

export interface QuickAction {
  action: string;
  command: string;
  description: string;
}

// Context for targeted analysis
interface AnalysisContext {
  nodes: Map<string, EffectNode>;
  edges: Array<{ source: string; target: string; type: string }>;
  dependencyMap: Map<string, Set<string>>;
  reverseDependencyMap: Map<string, Set<string>>;
}

// Pure function to build analysis context
const buildAnalysisContext = (analysis: AnalysisResult): AnalysisContext => {
  const nodes = new Map<string, EffectNode>();
  const dependencyMap = new Map<string, Set<string>>();
  const reverseDependencyMap = new Map<string, Set<string>>();

  // Build node map
  analysis.railway.nodes.forEach(node => {
    nodes.set(node.id, node);
  });

  // Build dependency maps
  analysis.railway.edges.forEach(edge => {
    if (!dependencyMap.has(edge.source)) {
      dependencyMap.set(edge.source, new Set());
    }
    dependencyMap.get(edge.source)!.add(edge.target);

    if (!reverseDependencyMap.has(edge.target)) {
      reverseDependencyMap.set(edge.target, new Set());
    }
    reverseDependencyMap.get(edge.target)!.add(edge.source);
  });

  return {
    nodes,
    edges: analysis.railway.edges,
    dependencyMap,
    reverseDependencyMap
  };
};

// Pure function to find Effect by query
const findEffect = (query: string, context: AnalysisContext): EffectNode | null => {
  const trimmedQuery = query.trim();
  
  // Try exact ID match
  const exactMatch = context.nodes.get(trimmedQuery);
  if (exactMatch) return exactMatch;

  // Try name match
  for (const node of context.nodes.values()) {
    if (node.name === trimmedQuery) {
      return node;
    }
  }

  // Try file:line match
  if (trimmedQuery.includes(':')) {
    const [file, line] = trimmedQuery.split(':');
    for (const node of context.nodes.values()) {
      if (node.filePath.includes(file) && 
          (line === '*' || node.line.toString() === line)) {
        return node;
      }
    }
  }

  // Try partial match
  const lowerQuery = trimmedQuery.toLowerCase();
  for (const node of context.nodes.values()) {
    if (node.name.toLowerCase().includes(lowerQuery) ||
        node.filePath.toLowerCase().includes(lowerQuery)) {
      return node;
    }
  }

  return null;
};

// Pure function to get upstream impacts
const getUpstreamImpacts = (
  node: EffectNode,
  context: AnalysisContext
): ImpactSummary => {
  const upstream = new Set<string>();
  const layersAffected = new Set<string>();
  const criticalPaths: string[] = [];

  // Get all upstream dependencies
  const toProcess = [node.id];
  const processed = new Set<string>();

  while (toProcess.length > 0) {
    const current = toProcess.pop()!;
    if (processed.has(current)) continue;
    processed.add(current);

    const deps = context.reverseDependencyMap.get(current) || new Set();
    deps.forEach(dep => {
      upstream.add(dep);
      const depNode = context.nodes.get(dep);
      if (depNode) {
        layersAffected.add(depNode.type);
        toProcess.push(dep);
      }
    });
  }

  // Find critical paths (entry points that depend on this)
  context.nodes.forEach(n => {
    if (n.type === 'controller' && upstream.has(n.id)) {
      criticalPaths.push(`${n.name} → ${node.name}`);
    }
  });

  const totalNodes = upstream.size;
  const riskLevel = totalNodes > 10 ? 'high' : totalNodes > 5 ? 'medium' : 'low';

  return {
    totalNodes,
    criticalPaths,
    layersAffected: Array.from(layersAffected),
    riskLevel,
    summary: `${totalNodes} nodes depend on ${node.name}`
  };
};

// Pure function to get downstream impacts
const getDownstreamImpacts = (
  node: EffectNode,
  context: AnalysisContext
): ImpactSummary => {
  const downstream = new Set<string>();
  const layersAffected = new Set<string>();
  const criticalPaths: string[] = [];

  // Get all downstream dependencies
  const toProcess = [node.id];
  const processed = new Set<string>();

  while (toProcess.length > 0) {
    const current = toProcess.pop()!;
    if (processed.has(current)) continue;
    processed.add(current);

    const deps = context.dependencyMap.get(current) || new Set();
    deps.forEach(dep => {
      downstream.add(dep);
      const depNode = context.nodes.get(dep);
      if (depNode) {
        layersAffected.add(depNode.type);
        toProcess.push(dep);
      }
    });
  }

  // Find critical paths to repositories
  context.nodes.forEach(n => {
    if (n.type === 'repository' && downstream.has(n.id)) {
      criticalPaths.push(`${node.name} → ${n.name}`);
    }
  });

  const totalNodes = downstream.size;
  const riskLevel = totalNodes > 10 ? 'high' : totalNodes > 5 ? 'medium' : 'low';

  return {
    totalNodes,
    criticalPaths,
    layersAffected: Array.from(layersAffected),
    riskLevel,
    summary: `${node.name} depends on ${totalNodes} nodes`
  };
};

// Pure function to generate modification guidance
const generateModificationGuidance = (
  node: EffectNode,
  operation: string,
  upstreamImpacts: ImpactSummary,
  downstreamImpacts: ImpactSummary
): ModificationGuidance => {
  const canModifySafely = upstreamImpacts.riskLevel === 'low' && downstreamImpacts.riskLevel === 'low';
  
  const requiredChanges: string[] = [];
  const breakingChanges: string[] = [];
  const testingRequired: string[] = [];

  if (operation === 'modify') {
    requiredChanges.push(`Update ${node.name} implementation`);
    if (upstreamImpacts.totalNodes > 0) {
      requiredChanges.push(`Review ${upstreamImpacts.totalNodes} dependent nodes`);
    }
    if (node.effectSignature) {
      breakingChanges.push('Effect signature changes will break dependents');
    }
    testingRequired.push(`Unit tests for ${node.name}`);
    testingRequired.push('Integration tests with immediate dependencies');
  }

  if (operation === 'delete') {
    breakingChanges.push(`All ${upstreamImpacts.totalNodes} dependents will break`);
    requiredChanges.push('Find alternative for dependent nodes');
  }

  const effort = upstreamImpacts.totalNodes > 10 ? '2-3 days' :
                 upstreamImpacts.totalNodes > 5 ? '1 day' : '2-4 hours';

  return {
    canModifySafely,
    requiredChanges,
    breakingChanges,
    testingRequired,
    estimatedEffort: effort
  };
};

// Pure function to generate usage patterns
const generateUsagePatterns = (node: EffectNode): UsagePattern[] => {
  const patterns: UsagePattern[] = [];

  // Basic usage
  patterns.push({
    pattern: 'Direct invocation',
    description: `Call ${node.name} directly`,
    codeExample: `const result = yield* ${node.name};`,
    frequency: 'common'
  });

  // Piped usage
  patterns.push({
    pattern: 'Piped composition',
    description: `Compose ${node.name} with pipe`,
    codeExample: `pipe(
  ${node.name},
  Effect.map(result => transform(result)),
  Effect.catchTag('Error', handleError)
)`,
    frequency: 'common'
  });

  // Error handling
  if (node.effectSignature?.error && node.effectSignature.error.length > 0) {
    patterns.push({
      pattern: 'Error recovery',
      description: `Handle ${node.name} errors`,
      codeExample: `${node.name}.pipe(
  Effect.catchTags({
    ${node.effectSignature.error.map(e => `'${e}': handle${e}`).join(',\n    ')}
  })
)`,
      frequency: 'uncommon'
    });
  }

  return patterns;
};

// Pure function to assess risk
const assessRisk = (
  node: EffectNode,
  operation: string,
  upstreamImpacts: ImpactSummary,
  downstreamImpacts: ImpactSummary
): RiskAssessment => {
  const factors: string[] = [];
  const mitigations: string[] = [];

  // Assess risk factors
  if (upstreamImpacts.totalNodes > 10) {
    factors.push(`High upstream impact: ${upstreamImpacts.totalNodes} dependents`);
  }
  if (downstreamImpacts.totalNodes > 10) {
    factors.push(`High downstream dependencies: ${downstreamImpacts.totalNodes} nodes`);
  }
  if (node.type === 'repository') {
    factors.push('Data layer modification - high risk');
  }
  if (upstreamImpacts.criticalPaths.length > 0) {
    factors.push(`Critical paths affected: ${upstreamImpacts.criticalPaths.length}`);
  }

  // Suggest mitigations
  if (factors.length > 0) {
    mitigations.push('Create comprehensive test suite before modification');
    mitigations.push('Use feature flags for gradual rollout');
    mitigations.push('Implement backwards compatibility layer');
    mitigations.push('Plan rollback strategy');
  }

  const overallRisk = factors.length > 3 ? 'high' : 
                      factors.length > 1 ? 'medium' : 'low';

  const recommendation = overallRisk === 'high' 
    ? 'Proceed with extreme caution - consider breaking into smaller changes'
    : overallRisk === 'medium'
    ? 'Proceed with caution - ensure proper testing'
    : 'Safe to proceed with standard practices';

  return {
    overallRisk,
    factors,
    mitigations,
    recommendation
  };
};

// Pure function to generate quick actions
const generateQuickActions = (
  node: EffectNode,
  operation: string
): QuickAction[] => {
  const actions: QuickAction[] = [];

  actions.push({
    action: 'View source',
    command: `code ${node.filePath}:${node.line}`,
    description: `Open ${node.name} in editor`
  });

  if (operation === 'modify') {
    actions.push({
      action: 'Run tests',
      command: `npm test -- ${node.name}`,
      description: `Test ${node.name} before modification`
    });
  }

  actions.push({
    action: 'Find usages',
    command: `grep -r "${node.name}" --include="*.ts"`,
    description: `Find all usages of ${node.name}`
  });

  if (operation === 'extend') {
    actions.push({
      action: 'Create wrapper',
      command: `echo "export const Enhanced${node.name} = pipe(${node.name}, ...)"`,
      description: `Create enhanced version of ${node.name}`
    });
  }

  return actions;
};

// Pure function to generate quick summary
const generateQuickSummary = (
  node: EffectNode,
  operation: string,
  upstreamImpacts: ImpactSummary,
  downstreamImpacts: ImpactSummary
): string => {
  return `${node.name} (${node.type}) at ${node.filePath}:${node.line}
Operation: ${operation}
Upstream impact: ${upstreamImpacts.totalNodes} nodes (${upstreamImpacts.riskLevel} risk)
Downstream impact: ${downstreamImpacts.totalNodes} nodes (${downstreamImpacts.riskLevel} risk)`;
};

// Main pure function to analyze Effect
export const analyzeEffect = (
  analysis: AnalysisResult,
  query: string,
  operation: string = 'analyze',
  contextInfo?: string
): TargetedResult => {
  const context = buildAnalysisContext(analysis);
  
  const foundEffect = findEffect(query, context);
  if (!foundEffect) {
    throw new Error(`Effect not found: ${query}. Try using exact name, file:line, or partial match.`);
  }

  const upstreamImpacts = getUpstreamImpacts(foundEffect, context);
  const downstreamImpacts = getDownstreamImpacts(foundEffect, context);
  const modificationGuidance = generateModificationGuidance(
    foundEffect,
    operation,
    upstreamImpacts,
    downstreamImpacts
  );
  const usagePatterns = generateUsagePatterns(foundEffect);
  const riskAssessment = assessRisk(
    foundEffect,
    operation,
    upstreamImpacts,
    downstreamImpacts
  );
  const quickActions = generateQuickActions(foundEffect, operation);
  const quickSummary = generateQuickSummary(
    foundEffect,
    operation,
    upstreamImpacts,
    downstreamImpacts
  );

  return {
    foundEffect,
    quickSummary,
    upstreamImpacts,
    downstreamImpacts,
    modificationGuidance,
    usagePatterns,
    riskAssessment,
    quickActions
  };
};

// Pure function to generate quick report
export const generateQuickReport = (
  analysis: AnalysisResult,
  query: string,
  operation: string = 'analyze',
  contextInfo?: string
): string => {
  const result = analyzeEffect(analysis, query, operation, contextInfo);
  
  let output = '';
  output += `# 🎯 TARGETED EFFECT ANALYSIS\n\n`;
  output += `## ${result.quickSummary}\n\n`;
  
  output += `## 📊 Impact Analysis\n`;
  output += `### Upstream (${result.upstreamImpacts.totalNodes} nodes affected)\n`;
  output += `- Risk Level: ${result.upstreamImpacts.riskLevel}\n`;
  output += `- Layers: ${result.upstreamImpacts.layersAffected.join(', ')}\n\n`;
  
  output += `### Downstream (${result.downstreamImpacts.totalNodes} dependencies)\n`;
  output += `- Risk Level: ${result.downstreamImpacts.riskLevel}\n`;
  output += `- Layers: ${result.downstreamImpacts.layersAffected.join(', ')}\n\n`;
  
  output += `## 🔧 Modification Guidance\n`;
  output += `- Can modify safely: ${result.modificationGuidance.canModifySafely ? 'Yes' : 'No'}\n`;
  output += `- Estimated effort: ${result.modificationGuidance.estimatedEffort}\n\n`;
  
  output += `## ⚠️ Risk Assessment\n`;
  output += `- Overall Risk: ${result.riskAssessment.overallRisk}\n`;
  output += `- Recommendation: ${result.riskAssessment.recommendation}\n\n`;
  
  output += `## 🚀 Quick Actions\n`;
  result.quickActions.forEach(action => {
    output += `- ${action.action}: \`${action.command}\`\n`;
  });
  
  return output;
};