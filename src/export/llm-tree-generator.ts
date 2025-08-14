/**
 * Purpose: Generate LLM-readable tree structures for Effect TS patterns
 * Dependencies: Effect node types, analysis results
 * 
 * Example Input:
 * ```
 * generateLLMTree(analysisResult, 'UsersRepository')
 * ```
 * 
 * Expected Output:
 * ```
 * Structured tree showing dependencies, effects, and modification guidance
 * ```
 */

import type { AnalysisResult, EffectNode, EffectEdge } from '../types/effect-node.js';

export interface LLMTreeNode {
  id: string;
  name: string;
  type: string;
  file: string;
  line: number;
  description: string;
  effectSignature?: {
    success: string;
    error: string[];
    dependencies: string[];
  };
  children: LLMTreeNode[];
  depth: number;
  relationshipType: 'depends-on' | 'used-by' | 'root';
}

export interface LLMEffectAnalysis {
  rootNode: LLMTreeNode;
  fullDependencyTree: string;
  impactAnalysis: string;
  modificationGuide: string;
  effectPatterns: string;
  architecture: string;
}

export class LLMTreeGenerator {
  private nodes: Map<string, EffectNode> = new Map();
  private edges: EffectEdge[] = [];

  constructor(private analysis: AnalysisResult) {
    // Build lookup maps
    this.analysis.railway.nodes.forEach(node => {
      this.nodes.set(node.id, node);
    });
    this.edges = this.analysis.railway.edges;
  }

  /**
   * Generate comprehensive LLM-readable analysis for a specific node
   */
  public generateNodeAnalysis(nodeId: string): LLMEffectAnalysis {
    const rootNode = this.nodes.get(nodeId);
    if (!rootNode) {
      throw new Error(`Node ${nodeId} not found`);
    }

    const dependencyTree = this.buildDependencyTree(nodeId);
    const impactTree = this.buildImpactTree(nodeId);
    
    return {
      rootNode: dependencyTree,
      fullDependencyTree: this.formatTreeForLLM(rootNode, dependencyTree, impactTree),
      impactAnalysis: this.generateImpactAnalysis(rootNode, impactTree),
      modificationGuide: this.generateModificationGuide(rootNode),
      effectPatterns: this.generateEffectPatterns(rootNode, dependencyTree),
      architecture: this.generateArchitectureOverview(rootNode)
    };
  }

  /**
   * Generate comprehensive tree structure for all nodes (full system overview)
   */
  public generateSystemOverview(): string {
    const layers = this.groupNodesByLayer();
    let output = '';

    output += '# 🏗️ EFFECT TS SYSTEM ARCHITECTURE OVERVIEW\n\n';
    output += '## 📊 System Statistics\n';
    output += `- Total Nodes: ${this.analysis.railway.nodes.length}\n`;
    output += `- Total Dependencies: ${this.edges.length}\n`;
    output += `- Entry Points: ${this.analysis.railway.entryPoints.length}\n\n`;

    // Layer-by-layer breakdown
    for (const [layerName, nodes] of Object.entries(layers)) {
      if (nodes.length === 0) continue;
      
      output += `## 🎯 ${layerName.toUpperCase()} LAYER (${nodes.length} nodes)\n\n`;
      
      nodes.forEach(node => {
        const dependencies = this.getDirectDependencies(node.id);
        const dependents = this.getDirectDependents(node.id);
        
        output += `### ${node.name}\n`;
        output += `**File:** \`${node.filePath}:${node.line}\`\n`;
        output += `**Type:** ${node.type}\n`;
        if (node.description) output += `**Description:** ${node.description}\n`;
        
        if (node.effectSignature) {
          output += `**Effect:** \`Effect<${node.effectSignature.success}, ${node.effectSignature.error.join(' | ')}, ${node.effectSignature.dependencies.join(' & ')}>\`\n`;
        }
        
        if (dependencies.length > 0) {
          output += `**Dependencies:** ${dependencies.map(d => d.name).join(', ')}\n`;
        }
        
        if (dependents.length > 0) {
          output += `**Used by:** ${dependents.map(d => d.name).join(', ')}\n`;
        }
        
        output += '\n';
      });
    }

    return output;
  }

  private buildDependencyTree(nodeId: string, visited = new Set<string>(), depth = 0): LLMTreeNode {
    if (visited.has(nodeId) || depth > 10) {
      return this.createTreeNode(this.nodes.get(nodeId)!, depth, 'depends-on', []);
    }
    
    visited.add(nodeId);
    const node = this.nodes.get(nodeId)!;
    const dependencies = this.getDirectDependencies(nodeId);
    
    const children = dependencies.map(dep => 
      this.buildDependencyTree(dep.id, new Set(visited), depth + 1)
    );
    
    return this.createTreeNode(node, depth, 'depends-on', children);
  }

  private buildImpactTree(nodeId: string, visited = new Set<string>(), depth = 0): LLMTreeNode {
    if (visited.has(nodeId) || depth > 10) {
      return this.createTreeNode(this.nodes.get(nodeId)!, depth, 'used-by', []);
    }
    
    visited.add(nodeId);
    const node = this.nodes.get(nodeId)!;
    const dependents = this.getDirectDependents(nodeId);
    
    const children = dependents.map(dep => 
      this.buildImpactTree(dep.id, new Set(visited), depth + 1)
    );
    
    return this.createTreeNode(node, depth, 'used-by', children);
  }

  private createTreeNode(node: EffectNode, depth: number, relationshipType: 'depends-on' | 'used-by' | 'root', children: LLMTreeNode[]): LLMTreeNode {
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      file: `${node.filePath.split('/').pop()}:${node.line}`,
      line: node.line,
      description: node.description || '',
      effectSignature: node.effectSignature,
      children,
      depth,
      relationshipType
    };
  }

  private formatTreeForLLM(rootNode: EffectNode, dependencyTree: LLMTreeNode, impactTree: LLMTreeNode): string {
    let output = '';
    
    output += `# 🎯 EFFECT ANALYSIS: ${rootNode.name}\n\n`;
    output += `**File:** \`${rootNode.filePath}:${rootNode.line}\`\n`;
    output += `**Type:** ${rootNode.type}\n`;
    output += `**Description:** ${rootNode.description}\n\n`;

    if (rootNode.effectSignature) {
      output += `## ⚡ Effect Signature\n\n`;
      output += '```typescript\n';
      output += `Effect<${rootNode.effectSignature.success}, ${rootNode.effectSignature.error.join(' | ')}, ${rootNode.effectSignature.dependencies.join(' & ')}>\n`;
      output += '```\n\n';
      output += `- **Success Type (A):** ${rootNode.effectSignature.success}\n`;
      output += `- **Error Types (E):** ${rootNode.effectSignature.error.join(', ')}\n`;
      output += `- **Dependencies (R):** ${rootNode.effectSignature.dependencies.join(', ')}\n\n`;
    }

    // Dependency tree (what this depends on)
    output += '## 📥 DEPENDENCY TREE (What this depends on)\n\n';
    if (dependencyTree.children.length > 0) {
      output += this.formatTreeRecursive(dependencyTree.children, '');
    } else {
      output += '✅ No dependencies (leaf node)\n';
    }
    output += '\n';

    // Impact tree (what depends on this)
    output += '## 📤 IMPACT TREE (What depends on this)\n\n';
    if (impactTree.children.length > 0) {
      output += this.formatTreeRecursive(impactTree.children, '');
    } else {
      output += '✅ No dependents (no downstream impact)\n';
    }
    output += '\n';

    return output;
  }

  private formatTreeRecursive(nodes: LLMTreeNode[], prefix: string): string {
    let output = '';
    
    nodes.forEach((node, index) => {
      const isLast = index === nodes.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = prefix + (isLast ? '    ' : '│   ');
      
      // Node info
      output += `${prefix}${connector}**${node.name}** (${node.type})\n`;
      output += `${childPrefix.replace(/[├└].*/, '')}   📁 ${node.file}\n`;
      
      if (node.effectSignature) {
        output += `${childPrefix.replace(/[├└].*/, '')}   ⚡ Effect<${node.effectSignature.success}, ${node.effectSignature.error.join('|')}, ${node.effectSignature.dependencies.join('&')}>\n`;
      }
      
      if (node.description) {
        output += `${childPrefix.replace(/[├└].*/, '')}   📝 ${node.description}\n`;
      }
      
      // Recursively add children
      if (node.children.length > 0) {
        output += this.formatTreeRecursive(node.children, childPrefix);
      }
      
      output += '\n';
    });
    
    return output;
  }

  private generateImpactAnalysis(rootNode: EffectNode, impactTree: LLMTreeNode): string {
    let output = '';
    
    output += `# 🎯 IMPACT ANALYSIS: ${rootNode.name}\n\n`;
    
    const allImpactedNodes = this.collectAllNodes(impactTree);
    const impactByType = this.groupNodesByType(allImpactedNodes);
    
    output += '## 📊 Impact Summary\n\n';
    Object.entries(impactByType).forEach(([type, nodes]) => {
      if (nodes.length > 0) {
        output += `- **${type}**: ${nodes.length} affected\n`;
      }
    });
    output += '\n';
    
    output += '## ⚠️ Change Impact Warnings\n\n';
    
    if (impactByType.controller && impactByType.controller.length > 0) {
      output += `🌐 **HTTP Endpoints affected**: ${impactByType.controller.length} endpoints will be impacted\n`;
      impactByType.controller.forEach(node => {
        output += `   - ${node.name} (${node.file})\n`;
      });
      output += '\n';
    }
    
    if (impactByType.service && impactByType.service.length > 0) {
      output += `⚙️ **Business Logic affected**: ${impactByType.service.length} services will be impacted\n`;
      impactByType.service.forEach(node => {
        output += `   - ${node.name} (${node.file})\n`;
      });
      output += '\n';
    }
    
    output += '## 🔧 Recommended Change Strategy\n\n';
    output += '1. **Test Coverage**: Ensure all impacted endpoints have tests\n';
    output += '2. **Backwards Compatibility**: Consider if changes break existing contracts\n';
    output += '3. **Staged Rollout**: Deploy changes incrementally\n';
    output += '4. **Monitor Impact**: Watch for errors in affected services\n\n';
    
    return output;
  }

  private generateModificationGuide(rootNode: EffectNode): string {
    let output = '';
    
    output += `# 🛠️ MODIFICATION GUIDE: ${rootNode.name}\n\n`;
    
    // Type-specific modification steps
    switch (rootNode.type) {
      case 'repository':
        output += this.generateRepositoryModificationGuide(rootNode);
        break;
      case 'service':
        output += this.generateServiceModificationGuide(rootNode);
        break;
      case 'controller':
        output += this.generateControllerModificationGuide(rootNode);
        break;
      default:
        output += this.generateGenericModificationGuide(rootNode);
    }
    
    return output;
  }

  private generateRepositoryModificationGuide(node: EffectNode): string {
    let output = '';
    
    output += '## 💾 Repository Modification Steps\n\n';
    output += '### 1. Database Schema Changes\n';
    output += '```sql\n';
    output += '-- If adding new fields, create migration first\n';
    output += 'ALTER TABLE your_table ADD COLUMN new_field VARCHAR(255);\n';
    output += '-- Update indexes if needed\n';
    output += 'CREATE INDEX idx_new_field ON your_table(new_field);\n';
    output += '```\n\n';
    
    output += '### 2. Repository Method Updates\n';
    output += '```typescript\n';
    output += `// In ${node.filePath}\n`;
    output += 'export const yourNewMethod = (params: YourType) =>\n';
    output += '  Effect.gen(function* () {\n';
    output += '    const db = yield* DatabaseService;\n';
    output += '    // Your logic here\n';
    output += '    return result;\n';
    output += '  });\n';
    output += '```\n\n';
    
    output += '### 3. Type Definitions\n';
    output += '```typescript\n';
    output += 'interface YourNewType {\n';
    output += '  id: string;\n';
    output += '  // Add your fields\n';
    output += '}\n';
    output += '```\n\n';
    
    return output;
  }

  private generateServiceModificationGuide(node: EffectNode): string {
    let output = '';
    
    output += '## ⚙️ Service Modification Steps\n\n';
    output += '### 1. Service Interface Update\n';
    output += '```typescript\n';
    output += `// In ${node.filePath}\n`;
    output += `export const ${node.name} = Context.Tag<{\n`;
    output += '  // Add your new methods\n';
    output += '  yourNewMethod: (params: YourType) => Effect<Result, Error, Dependencies>\n';
    output += '}>()\n';
    output += '```\n\n';
    
    output += '### 2. Implementation Update\n';
    output += '```typescript\n';
    output += 'const make = (): typeof YourService.Type => ({\n';
    output += '  yourNewMethod: (params) => \n';
    output += '    Effect.gen(function* () {\n';
    output += '      // Implementation here\n';
    output += '    })\n';
    output += '});\n';
    output += '```\n\n';
    
    return output;
  }

  private generateControllerModificationGuide(node: EffectNode): string {
    let output = '';
    
    output += '## 🌐 Controller Modification Steps\n\n';
    output += '### 1. Route Handler Update\n';
    output += '```typescript\n';
    output += `// In ${node.filePath}\n`;
    output += 'router.get("/your-endpoint", \n';
    output += '  handleRequest((req: Request) =>\n';
    output += '    Effect.gen(function* () {\n';
    output += '      // Add authentication if needed\n';
    output += '      const user = yield* loadAuthenticatedUser(req);\n';
    output += '      \n';
    output += '      // Your logic here\n';
    output += '      const result = yield* YourService.yourMethod(params);\n';
    output += '      \n';
    output += '      return result;\n';
    output += '    })\n';
    output += '  )\n';
    output += ');\n';
    output += '```\n\n';
    
    return output;
  }

  private generateGenericModificationGuide(node: EffectNode): string {
    let output = '';
    
    output += `## 🔧 ${node.type.toUpperCase()} Modification Steps\n\n`;
    output += '### 1. Understand Current Implementation\n';
    output += `- Review file: \`${node.filePath}:${node.line}\`\n`;
    output += '- Check existing tests\n';
    output += '- Understand current Effect signature\n\n';
    
    output += '### 2. Plan Your Changes\n';
    output += '- Define new Effect signature if needed\n';
    output += '- Consider error handling\n';
    output += '- Plan dependency updates\n\n';
    
    output += '### 3. Implement Changes\n';
    output += '```typescript\n';
    output += '// Your modification here\n';
    output += '```\n\n';
    
    return output;
  }

  private generateEffectPatterns(rootNode: EffectNode, dependencyTree: LLMTreeNode): string {
    let output = '';
    
    output += `# ⚡ EFFECT PATTERNS: ${rootNode.name}\n\n`;
    
    const allNodes = this.collectAllNodes(dependencyTree);
    const patterns = this.analyzeEffectPatterns(allNodes);
    
    output += '## 🔄 Common Effect Patterns Found\n\n';
    
    if (patterns.generators > 0) {
      output += `📋 **Effect.gen patterns**: ${patterns.generators} instances\n`;
      output += '   - Used for sequential Effect composition\n';
      output += '   - Allows yield* syntax for cleaner async code\n\n';
    }
    
    if (patterns.contextTags > 0) {
      output += `🏷️ **Context.Tag patterns**: ${patterns.contextTags} services\n`;
      output += '   - Dependency injection pattern\n';
      output += '   - Provides type-safe service access\n\n';
    }
    
    if (patterns.errorHandling > 0) {
      output += `⚠️ **Error handling patterns**: ${patterns.errorHandling} instances\n`;
      output += '   - Railway-oriented programming\n';
      output += '   - Explicit error type handling\n\n';
    }
    
    return output;
  }

  private generateArchitectureOverview(rootNode: EffectNode): string {
    let output = '';
    
    output += `# 🏗️ ARCHITECTURE CONTEXT: ${rootNode.name}\n\n`;
    
    const layer = this.determineArchitecturalLayer(rootNode);
    
    output += `## 📍 Architectural Position\n\n`;
    output += `**Layer**: ${layer.name}\n`;
    output += `**Responsibility**: ${layer.responsibility}\n`;
    output += `**Typical Dependencies**: ${layer.dependencies.join(', ')}\n`;
    output += `**Typical Dependents**: ${layer.dependents.join(', ')}\n\n`;
    
    output += `## 🎯 Design Principles\n\n`;
    layer.principles.forEach(principle => {
      output += `- ${principle}\n`;
    });
    output += '\n';
    
    return output;
  }

  // Helper methods
  private getDirectDependencies(nodeId: string): EffectNode[] {
    return this.edges
      .filter(edge => edge.target === nodeId)
      .map(edge => this.nodes.get(edge.source))
      .filter(Boolean) as EffectNode[];
  }

  private getDirectDependents(nodeId: string): EffectNode[] {
    return this.edges
      .filter(edge => edge.source === nodeId)
      .map(edge => this.nodes.get(edge.target))
      .filter(Boolean) as EffectNode[];
  }

  private collectAllNodes(tree: LLMTreeNode): LLMTreeNode[] {
    const result: LLMTreeNode[] = [tree];
    tree.children.forEach(child => {
      result.push(...this.collectAllNodes(child));
    });
    return result;
  }

  private groupNodesByType(nodes: LLMTreeNode[]): Record<string, LLMTreeNode[]> {
    return nodes.reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, LLMTreeNode[]>);
  }

  private groupNodesByLayer(): Record<string, EffectNode[]> {
    return {
      controllers: this.analysis.railway.nodes.filter(n => n.type === 'controller'),
      services: this.analysis.railway.nodes.filter(n => n.type === 'service'),
      repositories: this.analysis.railway.nodes.filter(n => n.type === 'repository'),
      middleware: this.analysis.railway.nodes.filter(n => n.type === 'middleware'),
      workers: this.analysis.railway.nodes.filter(n => n.type === 'worker'),
      utilities: this.analysis.railway.nodes.filter(n => n.type === 'utility'),
      errors: this.analysis.railway.nodes.filter(n => n.type === 'error')
    };
  }

  private analyzeEffectPatterns(nodes: LLMTreeNode[]): { generators: number, contextTags: number, errorHandling: number } {
    return {
      generators: nodes.filter(n => n.description?.includes('Effect generator')).length,
      contextTags: nodes.filter(n => n.type === 'service').length,
      errorHandling: nodes.filter(n => n.effectSignature?.error.length).length
    };
  }

  private determineArchitecturalLayer(node: EffectNode) {
    const layers = {
      controller: {
        name: 'HTTP Controller Layer',
        responsibility: 'Handle HTTP requests, authentication, and response formatting',
        dependencies: ['services', 'middleware'],
        dependents: ['frontend', 'API clients'],
        principles: [
          'Thin controllers - delegate business logic to services',
          'Handle authentication and authorization',
          'Format responses consistently',
          'Validate input parameters'
        ]
      },
      service: {
        name: 'Business Logic Layer',
        responsibility: 'Implement core business rules and orchestrate operations',
        dependencies: ['repositories', 'external services'],
        dependents: ['controllers', 'workers'],
        principles: [
          'Pure business logic - no HTTP concerns',
          'Compose smaller operations into workflows',
          'Handle business rules and validation',
          'Coordinate between repositories'
        ]
      },
      repository: {
        name: 'Data Access Layer',
        responsibility: 'Manage data persistence and retrieval operations',
        dependencies: ['database', 'external APIs'],
        dependents: ['services'],
        principles: [
          'Single responsibility per entity',
          'Abstract database implementation details',
          'Provide type-safe data operations',
          'Handle data consistency'
        ]
      }
    };

    return layers[node.type as keyof typeof layers] || {
      name: 'Utility Layer',
      responsibility: 'Provide supporting functionality',
      dependencies: ['system resources'],
      dependents: ['all layers'],
      principles: ['Single purpose', 'Reusable', 'Well-tested']
    };
  }
}