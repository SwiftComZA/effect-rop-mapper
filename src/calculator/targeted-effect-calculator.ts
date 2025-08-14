/**
 * Purpose: Targeted Effect Calculator for LLM quick queries
 * Dependencies: Analysis results, effect lookup
 * 
 * Example Input:
 * ```
 * calculator.analyzeEffect("getUserById") 
 * calculator.analyzeEffect("users.ts:142")
 * calculator.analyzeEffect("UsersRepository")
 * ```
 * 
 * Expected Output:
 * ```
 * Instant upstream/downstream analysis with modification guidance
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
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  mitigation: string[];
  recommendation: string;
}

export interface QuickAction {
  action: string;
  description: string;
  code?: string;
  warning?: string;
}

export class TargetedEffectCalculator {
  private nodes: Map<string, EffectNode> = new Map();
  private nodesByName: Map<string, EffectNode[]> = new Map();
  private nodesByFile: Map<string, EffectNode[]> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private reverseGraph: Map<string, Set<string>> = new Map();

  constructor(private analysis: AnalysisResult) {
    this.buildLookupMaps();
  }

  /**
   * Main entry point - analyze any Effect quickly
   */
  public analyzeEffect(query: string, operation: string = 'analyze', context?: string): TargetedResult {
    const targetedQuery: TargetedQuery = {
      query: query.trim(),
      operation: operation as any,
      context
    };

    // 1. Find the Effect quickly
    const foundEffect = this.findEffect(targetedQuery.query);
    if (!foundEffect) {
      throw new Error(`Effect not found: ${query}. Try using exact name, file:line, or partial match.`);
    }

    // 2. Calculate impacts quickly
    const upstreamImpacts = this.calculateUpstreamImpacts(foundEffect.id);
    const downstreamImpacts = this.calculateDownstreamImpacts(foundEffect.id);

    // 3. Generate modification guidance
    const modificationGuidance = this.generateModificationGuidance(foundEffect, targetedQuery.operation);

    // 4. Extract usage patterns
    const usagePatterns = this.extractUsagePatterns(foundEffect);

    // 5. Assess risks
    const riskAssessment = this.assessRisks(foundEffect, upstreamImpacts, downstreamImpacts, targetedQuery.operation);

    // 6. Generate quick actions
    const quickActions = this.generateQuickActions(foundEffect, targetedQuery.operation, context);

    // 7. Create quick summary
    const quickSummary = this.generateQuickSummary(foundEffect, upstreamImpacts, downstreamImpacts);

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
  }

  /**
   * Generate LLM-friendly output format
   */
  public generateLLMReport(query: string, operation: string = 'analyze', context?: string): string {
    try {
      const result = this.analyzeEffect(query, operation, context);
      
      let report = '';
      report += `# 🎯 TARGETED EFFECT ANALYSIS\n\n`;
      report += `**Query:** "${query}"\n`;
      report += `**Operation:** ${operation}\n`;
      report += `**Found:** ${result.foundEffect.name} (${result.foundEffect.type})\n`;
      report += `**Location:** ${result.foundEffect.filePath}:${result.foundEffect.line}\n\n`;

      // Quick Summary
      report += `## ⚡ Quick Summary\n\n`;
      report += `${result.quickSummary}\n\n`;

      // Risk Assessment
      report += `## ⚠️ Risk Assessment: ${result.riskAssessment.level.toUpperCase()}\n\n`;
      report += `**Factors:**\n`;
      result.riskAssessment.factors.forEach(factor => {
        report += `- ${factor}\n`;
      });
      report += `\n**Recommendation:** ${result.riskAssessment.recommendation}\n\n`;

      // Impact Analysis
      report += `## 📊 Impact Analysis\n\n`;
      report += `### ⬆️ Upstream Dependencies (${result.upstreamImpacts.totalNodes} nodes)\n`;
      report += `**Risk:** ${result.upstreamImpacts.riskLevel}\n`;
      report += `**Layers:** ${result.upstreamImpacts.layersAffected.join(', ')}\n`;
      report += `**Critical Paths:** ${result.upstreamImpacts.criticalPaths.join(', ')}\n`;
      report += `**Summary:** ${result.upstreamImpacts.summary}\n\n`;

      report += `### ⬇️ Downstream Impact (${result.downstreamImpacts.totalNodes} nodes)\n`;
      report += `**Risk:** ${result.downstreamImpacts.riskLevel}\n`;
      report += `**Layers:** ${result.downstreamImpacts.layersAffected.join(', ')}\n`;
      report += `**Critical Paths:** ${result.downstreamImpacts.criticalPaths.join(', ')}\n`;
      report += `**Summary:** ${result.downstreamImpacts.summary}\n\n`;

      // Modification Guidance
      report += `## 🛠️ Modification Guidance\n\n`;
      report += `**Can Modify Safely:** ${result.modificationGuidance.canModifySafely ? '✅ Yes' : '❌ No'}\n`;
      report += `**Estimated Effort:** ${result.modificationGuidance.estimatedEffort}\n\n`;

      if (result.modificationGuidance.requiredChanges.length > 0) {
        report += `**Required Changes:**\n`;
        result.modificationGuidance.requiredChanges.forEach(change => {
          report += `- ${change}\n`;
        });
        report += `\n`;
      }

      if (result.modificationGuidance.breakingChanges.length > 0) {
        report += `**⚠️ Breaking Changes:**\n`;
        result.modificationGuidance.breakingChanges.forEach(change => {
          report += `- ${change}\n`;
        });
        report += `\n`;
      }

      // Quick Actions
      report += `## 🚀 Quick Actions\n\n`;
      result.quickActions.forEach((action, index) => {
        report += `### ${index + 1}. ${action.action}\n`;
        report += `${action.description}\n`;
        if (action.warning) {
          report += `⚠️ **Warning:** ${action.warning}\n`;
        }
        if (action.code) {
          report += '```typescript\n';
          report += action.code;
          report += '\n```\n';
        }
        report += '\n';
      });

      // Usage Patterns
      if (result.usagePatterns.length > 0) {
        report += `## 📋 Common Usage Patterns\n\n`;
        result.usagePatterns.forEach(pattern => {
          report += `### ${pattern.pattern} (${pattern.frequency})\n`;
          report += `${pattern.description}\n`;
          report += '```typescript\n';
          report += pattern.codeExample;
          report += '\n```\n\n';
        });
      }

      return report;

    } catch (error) {
      return `# ❌ Effect Analysis Failed\n\n**Query:** "${query}"\n**Error:** ${error}\n\n**Suggestions:**\n- Try exact Effect name: "getUserById"\n- Try file:line format: "users.ts:142"\n- Try partial match: "User" or "Repository"\n- Check if the Effect exists in the codebase\n`;
    }
  }

  private buildLookupMaps(): void {
    // Build primary lookup maps
    this.analysis.railway.nodes.forEach(node => {
      this.nodes.set(node.id, node);

      // Index by name (exact and variations)
      const names = [
        node.name,
        node.name.toLowerCase(),
        node.name.replace(/\s+/g, ''),
        node.name.replace(/[^a-zA-Z0-9]/g, '')
      ];

      names.forEach(name => {
        if (!this.nodesByName.has(name)) {
          this.nodesByName.set(name, []);
        }
        this.nodesByName.get(name)!.push(node);
      });

      // Index by file
      const filename = node.filePath.split('/').pop() || '';
      const fileKey = `${filename}:${node.line}`;
      
      [filename, fileKey].forEach(key => {
        if (!this.nodesByFile.has(key)) {
          this.nodesByFile.set(key, []);
        }
        this.nodesByFile.get(key)!.push(node);
      });
    });

    // Build dependency graphs
    this.analysis.railway.edges.forEach(edge => {
      if (!this.dependencyGraph.has(edge.target)) {
        this.dependencyGraph.set(edge.target, new Set());
      }
      this.dependencyGraph.get(edge.target)!.add(edge.source);

      if (!this.reverseGraph.has(edge.source)) {
        this.reverseGraph.set(edge.source, new Set());
      }
      this.reverseGraph.get(edge.source)!.add(edge.target);
    });
  }

  private findEffect(query: string): EffectNode | null {
    // Try exact name match first
    const exactMatches = this.nodesByName.get(query) || this.nodesByName.get(query.toLowerCase());
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches[0]; // Return first exact match
    }

    // Try file:line format
    if (query.includes(':')) {
      const fileMatches = this.nodesByFile.get(query);
      if (fileMatches && fileMatches.length > 0) {
        return fileMatches[0];
      }
    }

    // Try partial match
    for (const [name, nodes] of this.nodesByName.entries()) {
      if (name.includes(query.toLowerCase()) || query.toLowerCase().includes(name)) {
        return nodes[0];
      }
    }

    // Try fuzzy match on file names
    for (const [fileKey, nodes] of this.nodesByFile.entries()) {
      if (fileKey.toLowerCase().includes(query.toLowerCase())) {
        return nodes[0];
      }
    }

    return null;
  }

  private calculateUpstreamImpacts(nodeId: string): ImpactSummary {
    const upstreamNodes = this.getAllUpstream(nodeId);
    const nodes = upstreamNodes.map(id => this.nodes.get(id)).filter(Boolean) as EffectNode[];
    
    const layersAffected = [...new Set(nodes.map(n => n.type))];
    const criticalPaths = this.findCriticalPaths(nodes, 'upstream');
    const riskLevel = this.calculateRiskLevel(nodes, 'upstream');
    
    const summary = `${upstreamNodes.length} dependencies across ${layersAffected.length} layers. ${criticalPaths.length} critical paths identified.`;
    
    return {
      totalNodes: upstreamNodes.length,
      criticalPaths,
      layersAffected,
      riskLevel,
      summary
    };
  }

  private calculateDownstreamImpacts(nodeId: string): ImpactSummary {
    const downstreamNodes = this.getAllDownstream(nodeId);
    const nodes = downstreamNodes.map(id => this.nodes.get(id)).filter(Boolean) as EffectNode[];
    
    const layersAffected = [...new Set(nodes.map(n => n.type))];
    const criticalPaths = this.findCriticalPaths(nodes, 'downstream');
    const riskLevel = this.calculateRiskLevel(nodes, 'downstream');
    
    const summary = `${downstreamNodes.length} dependents across ${layersAffected.length} layers. ${criticalPaths.length} critical paths affected.`;
    
    return {
      totalNodes: downstreamNodes.length,
      criticalPaths,
      layersAffected,
      riskLevel,
      summary
    };
  }

  private getAllUpstream(nodeId: string): string[] {
    const visited = new Set<string>();
    const upstream: string[] = [];
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const dependencies = this.dependencyGraph.get(currentId) || new Set();
      for (const depId of dependencies) {
        upstream.push(depId);
        traverse(depId);
      }
    };
    
    traverse(nodeId);
    return upstream;
  }

  private getAllDownstream(nodeId: string): string[] {
    const visited = new Set<string>();
    const downstream: string[] = [];
    
    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const dependents = this.reverseGraph.get(currentId) || new Set();
      for (const depId of dependents) {
        downstream.push(depId);
        traverse(depId);
      }
    };
    
    traverse(nodeId);
    return downstream;
  }

  private findCriticalPaths(nodes: EffectNode[], direction: 'upstream' | 'downstream'): string[] {
    // Find critical paths (controllers, entry points, key services)
    const critical: string[] = [];
    
    nodes.forEach(node => {
      if (node.type === 'controller') {
        critical.push(node.name);
      }
      if (this.analysis.railway.entryPoints.includes(node.id)) {
        critical.push(node.name + ' (entry point)');
      }
      if (node.name.includes('Service') && nodes.filter(n => n.type === 'service').length > 3) {
        critical.push(node.name);
      }
    });
    
    return critical.slice(0, 5); // Limit to top 5 critical paths
  }

  private calculateRiskLevel(nodes: EffectNode[], direction: 'upstream' | 'downstream'): 'low' | 'medium' | 'high' {
    const nodeCount = nodes.length;
    const hasControllers = nodes.some(n => n.type === 'controller');
    const hasEntryPoints = nodes.some(n => this.analysis.railway.entryPoints.includes(n.id));
    
    if (hasEntryPoints || hasControllers || nodeCount > 15) return 'high';
    if (nodeCount > 8 || nodes.some(n => n.type === 'service')) return 'medium';
    return 'low';
  }

  private generateModificationGuidance(node: EffectNode, operation?: string): ModificationGuidance {
    const upstreamNodes = this.getAllUpstream(node.id);
    const downstreamNodes = this.getAllDownstream(node.id);
    
    const totalImpact = upstreamNodes.length + downstreamNodes.length;
    const hasControllerDependents = downstreamNodes.some(id => {
      const n = this.nodes.get(id);
      return n?.type === 'controller';
    });
    
    const canModifySafely = totalImpact < 5 && !hasControllerDependents;
    
    const requiredChanges: string[] = [];
    const breakingChanges: string[] = [];
    const testingRequired: string[] = [];
    
    if (node.type === 'repository') {
      requiredChanges.push('Update database schema if adding fields');
      requiredChanges.push('Update type definitions');
      testingRequired.push('Repository unit tests');
      testingRequired.push('Database integration tests');
    }
    
    if (node.type === 'service') {
      requiredChanges.push('Update service interface');
      requiredChanges.push('Update service implementation');
      if (downstreamNodes.length > 0) {
        breakingChanges.push('Method signature changes affect consumers');
      }
      testingRequired.push('Service unit tests');
      testingRequired.push('Integration tests with consumers');
    }
    
    if (node.type === 'controller') {
      requiredChanges.push('Update HTTP route handler');
      breakingChanges.push('API contract changes affect frontend');
      testingRequired.push('API endpoint tests');
      testingRequired.push('Contract tests');
    }
    
    const estimatedEffort = totalImpact < 3 ? '1-2 hours' : 
                          totalImpact < 8 ? '4-8 hours' : 
                          totalImpact < 15 ? '1-2 days' : '2+ days';
    
    return {
      canModifySafely,
      requiredChanges,
      breakingChanges,
      testingRequired,
      estimatedEffort
    };
  }

  private extractUsagePatterns(node: EffectNode): UsagePattern[] {
    const patterns: UsagePattern[] = [];
    
    // Extract patterns based on node type and signature
    if (node.type === 'service') {
      patterns.push({
        pattern: 'Effect.gen with yield*',
        description: 'Most common way to use this service in other Effects',
        codeExample: `Effect.gen(function* () {\n  const service = yield* ${node.name};\n  const result = yield* service.execute(params);\n  return result;\n})`,
        frequency: 'common'
      });
    }
    
    if (node.type === 'repository') {
      patterns.push({
        pattern: 'CRUD operations',
        description: 'Standard repository usage pattern',
        codeExample: `Effect.gen(function* () {\n  const item = yield* ${node.name}.create(data);\n  const found = yield* ${node.name}.findById(item.id);\n  return found;\n})`,
        frequency: 'common'
      });
    }
    
    if (node.type === 'controller') {
      patterns.push({
        pattern: 'HTTP handler with Effect',
        description: 'Express route handler pattern',
        codeExample: `router.${node.name.toLowerCase().includes('post') ? 'post' : 'get'}('/endpoint',\n  handleRequest((req) =>\n    Effect.gen(function* () {\n      // Your logic here\n      return result;\n    })\n  )\n)`,
        frequency: 'common'
      });
    }
    
    return patterns;
  }

  private assessRisks(node: EffectNode, upstream: ImpactSummary, downstream: ImpactSummary, operation?: string): RiskAssessment {
    const factors: string[] = [];
    const mitigation: string[] = [];
    
    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Assess factors
    if (upstream.totalNodes > 10) {
      factors.push(`High upstream complexity (${upstream.totalNodes} dependencies)`);
      level = 'high';
      mitigation.push('Review all upstream dependencies before changes');
    }
    
    if (downstream.totalNodes > 10) {
      factors.push(`High downstream impact (${downstream.totalNodes} dependents)`);
      level = level === 'high' ? 'critical' : 'high';
      mitigation.push('Coordinate with teams owning dependent services');
    }
    
    if (node.type === 'controller') {
      factors.push('Controller changes affect API contracts');
      level = level === 'low' ? 'medium' : level;
      mitigation.push('Version API changes carefully');
      mitigation.push('Update API documentation');
    }
    
    if (this.analysis.railway.entryPoints.includes(node.id)) {
      factors.push('Entry point - affects system entry');
      level = 'high';
      mitigation.push('Test all entry scenarios');
    }
    
    if (factors.length === 0) {
      factors.push('Low complexity, isolated component');
      mitigation.push('Standard testing procedures sufficient');
    }
    
    const recommendation = level === 'critical' ? 'Proceed with extreme caution. Consider architectural review.' :
                          level === 'high' ? 'Proceed carefully. Comprehensive testing required.' :
                          level === 'medium' ? 'Standard precautions apply. Test thoroughly.' :
                          'Low risk. Standard development practices apply.';
    
    return { level, factors, mitigation, recommendation };
  }

  private generateQuickActions(node: EffectNode, operation?: string, context?: string): QuickAction[] {
    const actions: QuickAction[] = [];
    
    if (operation === 'modify') {
      actions.push({
        action: 'Backup Current Implementation',
        description: 'Create a backup of the current code before modifications',
        code: `git checkout -b backup-${node.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}\ngit commit -am "Backup before modifying ${node.name}"`
      });
      
      actions.push({
        action: 'Update Effect Signature',
        description: 'Modify the Effect signature if needed',
        code: node.effectSignature ? 
          `// Current: Effect<${node.effectSignature.success}, ${node.effectSignature.error.join('|')}, ${node.effectSignature.dependencies.join('&')}>\n// Update as needed` :
          '// Add Effect signature: Effect<SuccessType, ErrorType, Dependencies>',
        warning: 'Signature changes affect all consumers'
      });
    }
    
    if (operation === 'use') {
      actions.push({
        action: 'Import and Use',
        description: 'Standard import and usage pattern',
        code: `import { ${node.name} } from '${node.filePath}';\n\nEffect.gen(function* () {\n  const result = yield* ${node.name};\n  return result;\n})`
      });
    }
    
    if (operation === 'extend') {
      actions.push({
        action: 'Create Extension',
        description: 'Extend this Effect with additional functionality',
        code: `const enhanced${node.name} = Effect.gen(function* () {\n  const baseResult = yield* ${node.name};\n  // Add your extensions here\n  return enhancedResult;\n});`
      });
    }
    
    // Always add testing action
    actions.push({
      action: 'Create Tests',
      description: 'Add comprehensive tests for your changes',
      code: `describe('${node.name}', () => {\n  it('should work correctly', async () => {\n    const result = await Effect.runPromise(${node.name});\n    expect(result).toBeDefined();\n  });\n});`
    });
    
    return actions;
  }

  private generateQuickSummary(node: EffectNode, upstream: ImpactSummary, downstream: ImpactSummary): string {
    return `${node.name} is a ${node.type} with ${upstream.totalNodes} upstream dependencies and ${downstream.totalNodes} downstream dependents. Risk level: ${Math.max(upstream.riskLevel, downstream.riskLevel) === 'high' ? 'HIGH' : Math.max(upstream.riskLevel, downstream.riskLevel) === 'medium' ? 'MEDIUM' : 'LOW'}. ${node.effectSignature ? `Effect signature: Effect<${node.effectSignature.success}, ${node.effectSignature.error.join('|')}, ${node.effectSignature.dependencies.join('&')}>` : 'No Effect signature available'}.`;
  }
}