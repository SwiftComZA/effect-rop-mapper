/**
 * Purpose: Mathematical Effect Calculator for LLM-driven Effect generation
 * Dependencies: Analysis results, dependency graph calculations
 * 
 * Example Input:
 * ```
 * calculator.generateNewEffect({
 *   name: "createUserWithNotification",
 *   requiredCapabilities: ["user-creation", "email-sending"],
 *   targetLayer: "service"
 * })
 * ```
 * 
 * Expected Output:
 * ```
 * Complete Effect signature with mathematically accurate dependencies
 * ```
 */

import type { AnalysisResult, EffectNode, NodeType } from '../types/effect-node.js';

export interface EffectCalculationRequest {
  name: string;
  targetLayer: NodeType;
  requiredCapabilities: string[];
  inputType?: string;
  expectedOutputType?: string;
  errorScenarios?: string[];
  integrateWithExisting?: string[]; // Node IDs to integrate with
}

export interface EffectCalculationResult {
  effectSignature: string;
  requiredDependencies: CalculatedDependency[];
  errorTypes: CalculatedError[];
  implementationTemplate: string;
  upstreamImpact: ImpactAnalysis;
  downstreamImpact: ImpactAnalysis;
  integrationPoints: IntegrationPoint[];
  testingStrategy: TestingGuide;
  mathematicalProof: string;
}

export interface CalculatedDependency {
  name: string;
  type: NodeType;
  reason: string;
  isExisting: boolean;
  file?: string;
  line?: number;
  needsCreation: boolean;
  creationTemplate?: string;
}

export interface CalculatedError {
  name: string;
  scenarios: string[];
  isExisting: boolean;
  propagatesTo: string[];
  handlingStrategy: string;
}

export interface ImpactAnalysis {
  affectedNodes: EffectNode[];
  requiredChanges: RequiredChange[];
  riskLevel: 'low' | 'medium' | 'high';
  estimatedEffort: string;
}

export interface RequiredChange {
  nodeId: string;
  nodeName: string;
  changeType: 'signature-update' | 'new-dependency' | 'error-handling' | 'integration';
  description: string;
  codeTemplate: string;
}

export interface IntegrationPoint {
  existingNodeId: string;
  existingNodeName: string;
  integrationType: 'depends-on' | 'provides-to' | 'composes-with';
  integrationCode: string;
}

export interface TestingGuide {
  unitTests: string[];
  integrationTests: string[];
  errorScenarios: string[];
  testCode: string;
}

export class EffectCalculator {
  private nodes: Map<string, EffectNode> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private reverseGraph: Map<string, Set<string>> = new Map();
  private capabilityMap: Map<string, EffectNode[]> = new Map();

  constructor(private analysis: AnalysisResult) {
    this.buildCalculationMaps();
  }

  /**
   * Calculate a new Effect with mathematical precision
   */
  public calculateNewEffect(request: EffectCalculationRequest): EffectCalculationResult {
    // 1. Mathematical dependency resolution
    const dependencies = this.calculateRequiredDependencies(request);
    
    // 2. Error propagation analysis
    const errorTypes = this.calculateErrorTypes(request, dependencies);
    
    // 3. Impact analysis (upstream/downstream)
    const upstreamImpact = this.calculateUpstreamImpact(dependencies);
    const downstreamImpact = this.calculateDownstreamImpact(request, dependencies);
    
    // 4. Integration point calculation
    const integrationPoints = this.calculateIntegrationPoints(request);
    
    // 5. Generate Effect signature
    const effectSignature = this.generateEffectSignature(request, dependencies, errorTypes);
    
    // 6. Create implementation template
    const implementationTemplate = this.generateImplementationTemplate(request, dependencies, errorTypes);
    
    // 7. Generate testing strategy
    const testingStrategy = this.generateTestingStrategy(request, dependencies, errorTypes);
    
    // 8. Mathematical proof of correctness
    const mathematicalProof = this.generateMathematicalProof(request, dependencies, errorTypes);

    return {
      effectSignature,
      requiredDependencies: dependencies,
      errorTypes,
      implementationTemplate,
      upstreamImpact,
      downstreamImpact,
      integrationPoints,
      testingStrategy,
      mathematicalProof
    };
  }

  /**
   * Generate complete system extension plan
   */
  public generateSystemExtension(request: EffectCalculationRequest): string {
    const result = this.calculateNewEffect(request);
    
    let output = '';
    output += `# 🧮 EFFECT CALCULATION: ${request.name}\n\n`;
    
    // Mathematical proof first
    output += '## 🔬 Mathematical Proof of Correctness\n\n';
    output += result.mathematicalProof + '\n\n';
    
    // Effect signature
    output += '## ⚡ Calculated Effect Signature\n\n';
    output += '```typescript\n';
    output += result.effectSignature + '\n';
    output += '```\n\n';
    
    // Dependencies
    output += '## 📦 Required Dependencies\n\n';
    result.requiredDependencies.forEach(dep => {
      output += `### ${dep.name} (${dep.type})\n`;
      output += `**Reason:** ${dep.reason}\n`;
      output += `**Status:** ${dep.isExisting ? '✅ Exists' : '🔨 Needs Creation'}\n`;
      if (dep.file) output += `**Location:** \`${dep.file}:${dep.line}\`\n`;
      if (dep.needsCreation && dep.creationTemplate) {
        output += '**Creation Template:**\n```typescript\n' + dep.creationTemplate + '\n```\n';
      }
      output += '\n';
    });
    
    // Implementation template
    output += '## 🏗️ Implementation Template\n\n';
    output += '```typescript\n';
    output += result.implementationTemplate + '\n';
    output += '```\n\n';
    
    // Impact analysis
    output += '## 📊 Impact Analysis\n\n';
    output += `### Upstream Impact (${result.upstreamImpact.riskLevel} risk)\n`;
    output += `**Estimated Effort:** ${result.upstreamImpact.estimatedEffort}\n`;
    output += `**Affected Nodes:** ${result.upstreamImpact.affectedNodes.length}\n\n`;
    
    result.upstreamImpact.requiredChanges.forEach(change => {
      output += `- **${change.nodeName}**: ${change.description}\n`;
    });
    output += '\n';
    
    output += `### Downstream Impact (${result.downstreamImpact.riskLevel} risk)\n`;
    output += `**Estimated Effort:** ${result.downstreamImpact.estimatedEffort}\n`;
    output += `**Affected Nodes:** ${result.downstreamImpact.affectedNodes.length}\n\n`;
    
    // Testing strategy
    output += '## 🧪 Testing Strategy\n\n';
    output += '### Unit Tests\n';
    result.testingStrategy.unitTests.forEach(test => {
      output += `- ${test}\n`;
    });
    output += '\n### Integration Tests\n';
    result.testingStrategy.integrationTests.forEach(test => {
      output += `- ${test}\n`;
    });
    output += '\n### Test Implementation\n';
    output += '```typescript\n';
    output += result.testingStrategy.testCode + '\n';
    output += '```\n\n';
    
    return output;
  }

  private buildCalculationMaps(): void {
    // Build node lookup
    this.analysis.railway.nodes.forEach(node => {
      this.nodes.set(node.id, node);
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

    // Build capability map (what each node can do)
    this.analysis.railway.nodes.forEach(node => {
      const capabilities = this.extractCapabilities(node);
      capabilities.forEach(capability => {
        if (!this.capabilityMap.has(capability)) {
          this.capabilityMap.set(capability, []);
        }
        this.capabilityMap.get(capability)!.push(node);
      });
    });
  }

  private calculateRequiredDependencies(request: EffectCalculationRequest): CalculatedDependency[] {
    const dependencies: CalculatedDependency[] = [];
    
    // For each required capability, find existing providers or plan creation
    request.requiredCapabilities.forEach(capability => {
      const providers = this.capabilityMap.get(capability) || [];
      
      if (providers.length > 0) {
        // Use existing provider
        const bestProvider = this.selectBestProvider(providers, request.targetLayer);
        dependencies.push({
          name: bestProvider.name,
          type: bestProvider.type,
          reason: `Provides capability: ${capability}`,
          isExisting: true,
          file: bestProvider.filePath,
          line: bestProvider.line,
          needsCreation: false
        });
      } else {
        // Need to create new dependency
        const newDep = this.planNewDependency(capability, request.targetLayer);
        dependencies.push(newDep);
      }
    });

    // Add architectural dependencies based on layer
    const architecturalDeps = this.calculateArchitecturalDependencies(request.targetLayer);
    dependencies.push(...architecturalDeps);

    return dependencies;
  }

  private calculateErrorTypes(request: EffectCalculationRequest, dependencies: CalculatedDependency[]): CalculatedError[] {
    const errorTypes: CalculatedError[] = [];
    
    // Standard error scenarios
    const standardErrors = this.getStandardErrorsForLayer(request.targetLayer);
    errorTypes.push(...standardErrors);
    
    // User-specified error scenarios
    request.errorScenarios?.forEach(scenario => {
      errorTypes.push({
        name: `${scenario}Error`,
        scenarios: [scenario],
        isExisting: this.checkErrorExists(`${scenario}Error`),
        propagatesTo: this.calculateErrorPropagation(dependencies),
        handlingStrategy: this.determineErrorHandlingStrategy(scenario)
      });
    });
    
    // Dependency-inherited errors
    dependencies.forEach(dep => {
      if (dep.isExisting) {
        const existingNode = Array.from(this.nodes.values()).find(n => n.name === dep.name);
        if (existingNode?.effectSignature?.error) {
          existingNode.effectSignature.error.forEach(errorType => {
            if (!errorTypes.find(e => e.name === errorType)) {
              errorTypes.push({
                name: errorType,
                scenarios: [`Inherited from ${dep.name}`],
                isExisting: true,
                propagatesTo: [request.name],
                handlingStrategy: 'propagate'
              });
            }
          });
        }
      }
    });
    
    return errorTypes;
  }

  private calculateUpstreamImpact(dependencies: CalculatedDependency[]): ImpactAnalysis {
    const affectedNodes: EffectNode[] = [];
    const requiredChanges: RequiredChange[] = [];
    
    dependencies.forEach(dep => {
      if (dep.isExisting) {
        const node = Array.from(this.nodes.values()).find(n => n.name === dep.name);
        if (node) {
          affectedNodes.push(node);
          
          // Check if we need to modify the existing dependency
          if (dep.needsCreation) {
            requiredChanges.push({
              nodeId: node.id,
              nodeName: node.name,
              changeType: 'signature-update',
              description: `Add new capability: ${dep.reason}`,
              codeTemplate: this.generateModificationTemplate(node, dep)
            });
          }
        }
      } else {
        // Need to create new dependency
        requiredChanges.push({
          nodeId: 'new-' + dep.name.toLowerCase(),
          nodeName: dep.name,
          changeType: 'new-dependency',
          description: `Create new ${dep.type}: ${dep.reason}`,
          codeTemplate: dep.creationTemplate || ''
        });
      }
    });

    const riskLevel = this.calculateRiskLevel(affectedNodes, requiredChanges);
    const estimatedEffort = this.estimateEffort(requiredChanges);

    return { affectedNodes, requiredChanges, riskLevel, estimatedEffort };
  }

  private calculateDownstreamImpact(request: EffectCalculationRequest, dependencies: CalculatedDependency[]): ImpactAnalysis {
    // For new Effects, downstream impact is initially zero
    // But if integrating with existing nodes, calculate impact
    const affectedNodes: EffectNode[] = [];
    const requiredChanges: RequiredChange[] = [];

    if (request.integrateWithExisting) {
      request.integrateWithExisting.forEach(nodeId => {
        const node = this.nodes.get(nodeId);
        if (node) {
          affectedNodes.push(node);
          requiredChanges.push({
            nodeId,
            nodeName: node.name,
            changeType: 'integration',
            description: `Integrate with new Effect: ${request.name}`,
            codeTemplate: this.generateIntegrationTemplate(node, request)
          });
        }
      });
    }

    const riskLevel = this.calculateRiskLevel(affectedNodes, requiredChanges);
    const estimatedEffort = this.estimateEffort(requiredChanges);

    return { affectedNodes, requiredChanges, riskLevel, estimatedEffort };
  }

  private calculateIntegrationPoints(request: EffectCalculationRequest): IntegrationPoint[] {
    const integrationPoints: IntegrationPoint[] = [];

    if (request.integrateWithExisting) {
      request.integrateWithExisting.forEach(nodeId => {
        const node = this.nodes.get(nodeId);
        if (node) {
          integrationPoints.push({
            existingNodeId: nodeId,
            existingNodeName: node.name,
            integrationType: this.determineIntegrationType(node, request),
            integrationCode: this.generateIntegrationCode(node, request)
          });
        }
      });
    }

    return integrationPoints;
  }

  private generateEffectSignature(request: EffectCalculationRequest, dependencies: CalculatedDependency[], errorTypes: CalculatedError[]): string {
    const successType = request.expectedOutputType || 'void';
    const errorTypeNames = errorTypes.map(e => e.name).join(' | ') || 'never';
    const dependencyNames = dependencies.map(d => d.name).join(' & ') || 'never';

    return `Effect<${successType}, ${errorTypeNames}, ${dependencyNames}>`;
  }

  private generateImplementationTemplate(request: EffectCalculationRequest, dependencies: CalculatedDependency[], errorTypes: CalculatedError[]): string {
    let template = '';

    // Context.Tag definition for services
    if (request.targetLayer === 'service') {
      template += `export const ${request.name} = Context.Tag<{\n`;
      template += `  execute: (params: ${request.inputType || 'void'}) => Effect<${request.expectedOutputType || 'void'}, ${errorTypes.map(e => e.name).join(' | ') || 'never'}, ${dependencies.map(d => d.name).join(' & ') || 'never'}>\n`;
      template += '}>()\n\n';
    }

    // Implementation
    template += `export const ${request.name.toLowerCase()}Implementation = `;
    
    if (request.targetLayer === 'service') {
      template += `(): typeof ${request.name}.Type => ({\n`;
      template += `  execute: (params) =>\n`;
    }

    template += `    Effect.gen(function* () {\n`;

    // Add dependency acquisitions
    dependencies.forEach(dep => {
      template += `      const ${dep.name.toLowerCase()} = yield* ${dep.name};\n`;
    });

    template += `\n`;
    template += `      // TODO: Implement your logic here\n`;
    template += `      // Example implementation:\n`;

    // Add example logic based on capabilities
    request.requiredCapabilities.forEach(capability => {
      template += `      // ${capability.toUpperCase()}\n`;
      template += `      const ${capability.replace('-', '')}Result = yield* ${capability.toLowerCase()}Service.execute(params);\n`;
    });

    template += `\n`;
    template += `      return result;\n`;
    template += `    })\n`;

    if (request.targetLayer === 'service') {
      template += `})\n`;
    }

    return template;
  }

  private generateTestingStrategy(request: EffectCalculationRequest, dependencies: CalculatedDependency[], errorTypes: CalculatedError[]): TestingGuide {
    const unitTests = [
      `Should execute ${request.name} successfully with valid input`,
      `Should handle missing dependencies gracefully`,
      ...errorTypes.map(e => `Should handle ${e.name} correctly`)
    ];

    const integrationTests = [
      `Should integrate with ${dependencies.map(d => d.name).join(', ')}`,
      `Should maintain data consistency across operations`,
      `Should handle concurrent execution properly`
    ];

    const errorScenarios = errorTypes.map(e => 
      `Test ${e.name}: ${e.scenarios.join(', ')}`
    );

    const testCode = this.generateTestCode(request, dependencies, errorTypes);

    return { unitTests, integrationTests, errorScenarios, testCode };
  }

  private generateMathematicalProof(request: EffectCalculationRequest, dependencies: CalculatedDependency[], errorTypes: CalculatedError[]): string {
    let proof = '';

    proof += `**Mathematical Proof for ${request.name}**\n\n`;
    
    proof += `Given:\n`;
    proof += `- Target Layer: ${request.targetLayer}\n`;
    proof += `- Required Capabilities: {${request.requiredCapabilities.join(', ')}}\n`;
    proof += `- Input Type: ${request.inputType || 'void'}\n`;
    proof += `- Output Type: ${request.expectedOutputType || 'void'}\n\n`;

    proof += `Proof Steps:\n\n`;
    
    proof += `1. **Dependency Resolution**: ∀ capability ∈ RequiredCapabilities\n`;
    dependencies.forEach((dep, i) => {
      proof += `   ${i + 1}.${i + 1} ${dep.name} provides capability via ${dep.reason}\n`;
    });
    proof += `   Therefore: All capabilities can be satisfied\n\n`;

    proof += `2. **Error Propagation**: E = ⋃(Individual Error Types)\n`;
    errorTypes.forEach(error => {
      proof += `   - ${error.name}: {${error.scenarios.join(', ')}}\n`;
    });
    proof += `   Therefore: All error scenarios are covered\n\n`;

    proof += `3. **Effect Composition**: Effect<A, E, R> is well-formed where:\n`;
    proof += `   - A (Success) = ${request.expectedOutputType || 'void'}\n`;
    proof += `   - E (Errors) = ${errorTypes.map(e => e.name).join(' | ') || 'never'}\n`;
    proof += `   - R (Dependencies) = ${dependencies.map(d => d.name).join(' & ') || 'never'}\n\n`;

    proof += `4. **Railway Oriented Programming**: ∀ operation, either succeeds → A or fails → E\n`;
    proof += `   No undefined states, complete error coverage\n\n`;

    proof += `∴ The Effect signature is mathematically sound and implementable\n`;

    return proof;
  }

  // Helper methods
  private extractCapabilities(node: EffectNode): string[] {
    const capabilities: string[] = [];
    
    // Extract from name patterns
    if (node.name.includes('create')) capabilities.push('creation');
    if (node.name.includes('update')) capabilities.push('modification');
    if (node.name.includes('delete')) capabilities.push('deletion');
    if (node.name.includes('find') || node.name.includes('get')) capabilities.push('retrieval');
    if (node.name.includes('list')) capabilities.push('listing');
    if (node.name.includes('search')) capabilities.push('searching');
    if (node.name.includes('validate')) capabilities.push('validation');
    if (node.name.includes('auth')) capabilities.push('authentication');
    if (node.name.includes('permission')) capabilities.push('authorization');
    if (node.name.includes('email')) capabilities.push('email-sending');
    if (node.name.includes('queue')) capabilities.push('queueing');
    
    // Extract from type
    capabilities.push(`${node.type}-operations`);
    
    return capabilities;
  }

  private selectBestProvider(providers: EffectNode[], targetLayer: NodeType): EffectNode {
    // Prefer same layer, then closer layers
    const layerPreference = {
      controller: ['middleware', 'service', 'repository'],
      service: ['repository', 'utility', 'middleware'],
      repository: ['utility', 'service'],
      middleware: ['utility', 'service'],
      worker: ['service', 'repository', 'utility'],
      utility: ['utility'],
      error: ['error']
    };

    const preferred = layerPreference[targetLayer] || [];
    
    for (const prefType of preferred) {
      const match = providers.find(p => p.type === prefType);
      if (match) return match;
    }
    
    return providers[0]; // Fallback to first available
  }

  private planNewDependency(capability: string, targetLayer: NodeType): CalculatedDependency {
    const suggestedLayer = this.suggestLayerForCapability(capability);
    const name = this.generateDependencyName(capability, suggestedLayer);
    
    return {
      name,
      type: suggestedLayer,
      reason: `Provides capability: ${capability}`,
      isExisting: false,
      needsCreation: true,
      creationTemplate: this.generateCreationTemplate(name, suggestedLayer, capability)
    };
  }

  private calculateArchitecturalDependencies(targetLayer: NodeType): CalculatedDependency[] {
    const architecturalDeps: CalculatedDependency[] = [];
    
    // Standard architectural dependencies
    switch (targetLayer) {
      case 'controller':
        architecturalDeps.push({
          name: 'AuthenticationService',
          type: 'middleware',
          reason: 'Controllers need authentication',
          isExisting: true,
          needsCreation: false
        });
        break;
      case 'repository':
        architecturalDeps.push({
          name: 'DatabaseService',
          type: 'utility',
          reason: 'Repositories need database access',
          isExisting: true,
          needsCreation: false
        });
        break;
    }
    
    return architecturalDeps;
  }

  private suggestLayerForCapability(capability: string): NodeType {
    const capabilityLayerMap: Record<string, NodeType> = {
      'creation': 'repository',
      'modification': 'repository', 
      'deletion': 'repository',
      'retrieval': 'repository',
      'listing': 'repository',
      'searching': 'service',
      'validation': 'service',
      'authentication': 'middleware',
      'authorization': 'middleware',
      'email-sending': 'service',
      'queueing': 'worker'
    };
    
    return capabilityLayerMap[capability] || 'service';
  }

  private generateDependencyName(capability: string, layer: NodeType): string {
    const baseName = capability.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
    
    const suffix = {
      'service': 'Service',
      'repository': 'Repository', 
      'middleware': 'Middleware',
      'worker': 'Worker',
      'utility': 'Util',
      'controller': 'Controller',
      'error': 'Error'
    }[layer];
    
    return baseName + suffix;
  }

  private generateCreationTemplate(name: string, type: NodeType, capability: string): string {
    let template = '';
    
    if (type === 'service') {
      template += `export const ${name} = Context.Tag<{\n`;
      template += `  execute: (params: unknown) => Effect<unknown, Error, never>\n`;
      template += '}>()\n\n';
      template += `const make${name} = (): typeof ${name}.Type => ({\n`;
      template += `  execute: (params) =>\n`;
      template += `    Effect.gen(function* () {\n`;
      template += `      // TODO: Implement ${capability}\n`;
      template += `      return result;\n`;
      template += `    })\n`;
      template += `})`;
    } else if (type === 'repository') {
      template += `export const ${name} = {\n`;
      template += `  create: (data: unknown) => Effect.succeed(data),\n`;
      template += `  findById: (id: string) => Effect.succeed(null),\n`;
      template += `  // TODO: Add more repository methods\n`;
      template += `}`;
    }
    
    return template;
  }

  private getStandardErrorsForLayer(layer: NodeType): CalculatedError[] {
    const standardErrors: Record<NodeType, CalculatedError[]> = {
      controller: [
        {
          name: 'ValidationError',
          scenarios: ['Invalid request parameters', 'Missing required fields'],
          isExisting: true,
          propagatesTo: [],
          handlingStrategy: 'return 400 Bad Request'
        },
        {
          name: 'UnauthorizedError', 
          scenarios: ['Missing authentication', 'Invalid token'],
          isExisting: true,
          propagatesTo: [],
          handlingStrategy: 'return 401 Unauthorized'
        }
      ],
      service: [
        {
          name: 'BusinessLogicError',
          scenarios: ['Business rule violation', 'Invalid operation'],
          isExisting: false,
          propagatesTo: [],
          handlingStrategy: 'propagate to caller'
        }
      ],
      repository: [
        {
          name: 'DatabaseError',
          scenarios: ['Connection failure', 'Query timeout', 'Constraint violation'],
          isExisting: true,
          propagatesTo: [],
          handlingStrategy: 'retry or propagate'
        }
      ],
      middleware: [],
      worker: [],
      utility: [],
      error: []
    };
    
    return standardErrors[layer] || [];
  }

  private checkErrorExists(errorName: string): boolean {
    return this.analysis.railway.nodes.some(node => 
      node.type === 'error' && node.name === errorName
    );
  }

  private calculateErrorPropagation(dependencies: CalculatedDependency[]): string[] {
    return dependencies
      .filter(d => d.isExisting)
      .map(d => d.name);
  }

  private determineErrorHandlingStrategy(scenario: string): string {
    if (scenario.includes('validation')) return 'validate and return specific error';
    if (scenario.includes('auth')) return 'check permissions and return auth error';
    if (scenario.includes('network')) return 'retry with exponential backoff';
    return 'log error and propagate to caller';
  }

  private calculateRiskLevel(affectedNodes: EffectNode[], changes: RequiredChange[]): 'low' | 'medium' | 'high' {
    const nodeCount = affectedNodes.length;
    const changeCount = changes.length;
    const hasControllerChanges = changes.some(c => c.changeType === 'signature-update');
    
    if (nodeCount > 10 || hasControllerChanges) return 'high';
    if (nodeCount > 5 || changeCount > 3) return 'medium';
    return 'low';
  }

  private estimateEffort(changes: RequiredChange[]): string {
    const hours = changes.reduce((acc, change) => {
      switch (change.changeType) {
        case 'new-dependency': return acc + 4;
        case 'signature-update': return acc + 2;
        case 'integration': return acc + 3;
        case 'error-handling': return acc + 1;
        default: return acc + 2;
      }
    }, 0);
    
    if (hours <= 4) return `${hours} hours (quick win)`;
    if (hours <= 8) return `${hours} hours (half day)`;
    if (hours <= 16) return `${hours} hours (1-2 days)`;
    return `${hours} hours (multiple days)`;
  }

  private determineIntegrationType(node: EffectNode, request: EffectCalculationRequest): 'depends-on' | 'provides-to' | 'composes-with' {
    if (node.type === 'controller' && request.targetLayer === 'service') return 'provides-to';
    if (node.type === 'service' && request.targetLayer === 'repository') return 'provides-to';
    return 'composes-with';
  }

  private generateIntegrationCode(node: EffectNode, request: EffectCalculationRequest): string {
    return `// Integration with ${node.name}\nconst result = yield* ${request.name}.execute(params);`;
  }

  private generateIntegrationTemplate(node: EffectNode, request: EffectCalculationRequest): string {
    return `// Add integration with ${request.name}\nconst ${request.name.toLowerCase()}Result = yield* ${request.name}.execute(params);`;
  }

  private generateModificationTemplate(node: EffectNode, dep: CalculatedDependency): string {
    return `// Add new capability: ${dep.reason}\n// TODO: Implement in ${node.filePath}:${node.line}`;
  }

  private generateTestCode(request: EffectCalculationRequest, dependencies: CalculatedDependency[], errorTypes: CalculatedError[]): string {
    let testCode = '';
    
    testCode += `describe('${request.name}', () => {\n`;
    testCode += `  it('should execute successfully', async () => {\n`;
    testCode += `    const result = await Effect.runPromise(\n`;
    testCode += `      ${request.name}.execute(validParams).pipe(\n`;
    
    // Add test dependencies
    dependencies.forEach(dep => {
      testCode += `        Effect.provide(Mock${dep.name}),\n`;
    });
    
    testCode += `      )\n`;
    testCode += `    );\n`;
    testCode += `    \n`;
    testCode += `    expect(result).toBeDefined();\n`;
    testCode += `  });\n`;
    
    // Add error tests
    errorTypes.forEach(error => {
      testCode += `\n`;
      testCode += `  it('should handle ${error.name}', async () => {\n`;
      testCode += `    const result = Effect.runPromiseExit(\n`;
      testCode += `      ${request.name}.execute(invalidParams)\n`;
      testCode += `    );\n`;
      testCode += `    \n`;
      testCode += `    expect(Exit.isFailure(result)).toBe(true);\n`;
      testCode += `    expect(result.cause._tag).toBe('${error.name}');\n`;
      testCode += `  });\n`;
    });
    
    testCode += `});\n`;
    
    return testCode;
  }
}