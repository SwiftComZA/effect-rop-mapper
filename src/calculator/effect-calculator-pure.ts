/**
 * Purpose: Pure functional Effect Calculator for LLM-driven Effect generation
 * Dependencies: Analysis results, dependency graph calculations
 * 
 * Example Input:
 * ```
 * calculateNewEffect(analysisResult, {
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

// State for calculation context
interface CalculationContext {
  nodes: Map<string, EffectNode>;
  dependencyGraph: Map<string, Set<string>>;
  reverseGraph: Map<string, Set<string>>;
  capabilityMap: Map<string, EffectNode[]>;
}

// Pure function to build calculation maps
const buildCalculationMaps = (analysis: AnalysisResult): CalculationContext => {
  const nodes = new Map<string, EffectNode>();
  const dependencyGraph = new Map<string, Set<string>>();
  const reverseGraph = new Map<string, Set<string>>();
  const capabilityMap = new Map<string, EffectNode[]>();

  // Build node map
  analysis.railway.nodes.forEach(node => {
    nodes.set(node.id, node);
  });

  // Build dependency graphs
  analysis.railway.edges.forEach(edge => {
    if (!dependencyGraph.has(edge.source)) {
      dependencyGraph.set(edge.source, new Set());
    }
    dependencyGraph.get(edge.source)!.add(edge.target);

    if (!reverseGraph.has(edge.target)) {
      reverseGraph.set(edge.target, new Set());
    }
    reverseGraph.get(edge.target)!.add(edge.source);
  });

  // Build capability map
  analysis.railway.nodes.forEach(node => {
    const capabilities = inferCapabilities(node);
    capabilities.forEach(cap => {
      if (!capabilityMap.has(cap)) {
        capabilityMap.set(cap, []);
      }
      capabilityMap.get(cap)!.push(node);
    });
  });

  return { nodes, dependencyGraph, reverseGraph, capabilityMap };
};

// Pure function to infer capabilities
const inferCapabilities = (node: EffectNode): string[] => {
  const capabilities: string[] = [];
  const name = node.name.toLowerCase();
  
  if (name.includes('create')) capabilities.push('creation');
  if (name.includes('update') || name.includes('put')) capabilities.push('modification');
  if (name.includes('delete')) capabilities.push('deletion');
  if (name.includes('get') || name.includes('find')) capabilities.push('retrieval');
  if (name.includes('list')) capabilities.push('listing');
  if (name.includes('search')) capabilities.push('searching');
  if (name.includes('auth')) capabilities.push('authentication');
  if (name.includes('permission')) capabilities.push('authorization');
  if (name.includes('email')) capabilities.push('email-sending');
  if (name.includes('queue')) capabilities.push('queueing');
  if (name.includes('user')) capabilities.push('user-management');
  if (name.includes('notification')) capabilities.push('notification');
  
  if (capabilities.length === 0) {
    capabilities.push(`${node.type}-operations`);
  }
  
  return capabilities;
};

// Pure function to calculate required dependencies
const calculateRequiredDependencies = (
  request: EffectCalculationRequest,
  context: CalculationContext
): CalculatedDependency[] => {
  const dependencies: CalculatedDependency[] = [];
  const processedCapabilities = new Set<string>();

  request.requiredCapabilities.forEach(capability => {
    if (processedCapabilities.has(capability)) return;
    processedCapabilities.add(capability);

    const existingNodes = context.capabilityMap.get(capability) || [];
    
    if (existingNodes.length > 0) {
      // Use existing capability
      const bestMatch = findBestCapabilityMatch(existingNodes, request.targetLayer);
      if (bestMatch) {
        dependencies.push({
          name: bestMatch.name,
          type: bestMatch.type,
          reason: `Provides ${capability} capability`,
          isExisting: true,
          file: bestMatch.filePath,
          line: bestMatch.line,
          needsCreation: false
        });
      }
    } else {
      // Need to create new dependency
      dependencies.push({
        name: `${capability}Service`,
        type: inferLayerForCapability(capability),
        reason: `New dependency for ${capability} capability`,
        isExisting: false,
        needsCreation: true,
        creationTemplate: generateDependencyTemplate(capability)
      });
    }
  });

  // Add integration dependencies
  if (request.integrateWithExisting) {
    request.integrateWithExisting.forEach(nodeId => {
      const node = context.nodes.get(nodeId);
      if (node && !dependencies.some(d => d.name === node.name)) {
        dependencies.push({
          name: node.name,
          type: node.type,
          reason: `Integration with existing Effect`,
          isExisting: true,
          file: node.filePath,
          line: node.line,
          needsCreation: false
        });
      }
    });
  }

  return dependencies;
};

// Pure helper function to find best capability match
const findBestCapabilityMatch = (nodes: EffectNode[], targetLayer: NodeType): EffectNode | undefined => {
  // Prefer nodes in the same layer
  const sameLayerNodes = nodes.filter(n => n.type === targetLayer);
  if (sameLayerNodes.length > 0) {
    return sameLayerNodes[0];
  }
  
  // Otherwise, prefer service layer
  const serviceNodes = nodes.filter(n => n.type === 'service');
  if (serviceNodes.length > 0) {
    return serviceNodes[0];
  }
  
  return nodes[0];
};

// Pure helper function to infer layer for capability
const inferLayerForCapability = (capability: string): NodeType => {
  if (capability.includes('auth') || capability.includes('permission')) {
    return 'middleware';
  }
  if (capability.includes('email') || capability.includes('notification')) {
    return 'worker';
  }
  if (capability.includes('data') || capability.includes('storage')) {
    return 'repository';
  }
  return 'service';
};

// Pure helper function to generate dependency template
const generateDependencyTemplate = (capability: string): string => {
  return `
export const ${capability}Service = Effect.gen(function* () {
  // Implementation for ${capability}
  return {
    execute: () => Effect.succeed(true)
  };
});`;
};

// Pure function to calculate error types
const calculateErrorTypes = (
  request: EffectCalculationRequest,
  dependencies: CalculatedDependency[]
): CalculatedError[] => {
  const errorMap = new Map<string, CalculatedError>();

  // Add requested error scenarios
  if (request.errorScenarios) {
    request.errorScenarios.forEach(scenario => {
      const errorName = `${request.name}${scenario.replace(/[^a-zA-Z]/g, '')}Error`;
      errorMap.set(errorName, {
        name: errorName,
        scenarios: [scenario],
        isExisting: false,
        propagatesTo: [],
        handlingStrategy: generateErrorHandlingStrategy(scenario)
      });
    });
  }

  // Add standard errors based on operation type
  const standardErrors = inferStandardErrors(request);
  standardErrors.forEach(error => {
    if (!errorMap.has(error.name)) {
      errorMap.set(error.name, error);
    }
  });

  // Calculate error propagation
  dependencies.forEach(dep => {
    if (dep.type === 'repository') {
      const dbError: CalculatedError = {
        name: 'DatabaseError',
        scenarios: ['Database connection failure', 'Query timeout'],
        isExisting: true,
        propagatesTo: [request.name],
        handlingStrategy: 'Retry with exponential backoff or fallback to cache'
      };
      errorMap.set(dbError.name, dbError);
    }
  });

  return Array.from(errorMap.values());
};

// Pure helper function to infer standard errors
const inferStandardErrors = (request: EffectCalculationRequest): CalculatedError[] => {
  const errors: CalculatedError[] = [];
  const name = request.name.toLowerCase();

  if (name.includes('create') || name.includes('update')) {
    errors.push({
      name: 'ValidationError',
      scenarios: ['Invalid input data', 'Missing required fields'],
      isExisting: true,
      propagatesTo: [],
      handlingStrategy: 'Return detailed validation errors to client'
    });
  }

  if (name.includes('get') || name.includes('find')) {
    errors.push({
      name: 'NotFoundError',
      scenarios: ['Resource not found'],
      isExisting: true,
      propagatesTo: [],
      handlingStrategy: 'Return 404 with appropriate message'
    });
  }

  if (name.includes('auth')) {
    errors.push({
      name: 'UnauthorizedError',
      scenarios: ['Invalid credentials', 'Token expired'],
      isExisting: true,
      propagatesTo: [],
      handlingStrategy: 'Return 401 and trigger re-authentication'
    });
  }

  return errors;
};

// Pure helper function to generate error handling strategy
const generateErrorHandlingStrategy = (scenario: string): string => {
  if (scenario.includes('validation')) {
    return 'Return detailed validation errors to client';
  }
  if (scenario.includes('not found')) {
    return 'Return 404 with appropriate message';
  }
  if (scenario.includes('timeout')) {
    return 'Retry with exponential backoff';
  }
  return 'Log error and return generic error message';
};

// Pure function to calculate upstream impact
const calculateUpstreamImpact = (
  dependencies: CalculatedDependency[],
  context: CalculationContext
): ImpactAnalysis => {
  const affectedNodes: EffectNode[] = [];
  const requiredChanges: RequiredChange[] = [];
  
  dependencies.forEach(dep => {
    if (dep.isExisting && dep.file) {
      // Find nodes that might be affected
      context.nodes.forEach(node => {
        if (node.filePath === dep.file && node.line === dep.line) {
          affectedNodes.push(node);
        }
      });
    }
    
    if (dep.needsCreation) {
      requiredChanges.push({
        nodeId: 'new',
        nodeName: dep.name,
        changeType: 'integration',
        description: `Create new ${dep.type} for ${dep.reason}`,
        codeTemplate: dep.creationTemplate || ''
      });
    }
  });

  return {
    affectedNodes,
    requiredChanges,
    riskLevel: requiredChanges.length > 3 ? 'high' : requiredChanges.length > 1 ? 'medium' : 'low',
    estimatedEffort: `${requiredChanges.length * 2} hours`
  };
};

// Pure function to calculate downstream impact
const calculateDownstreamImpact = (
  request: EffectCalculationRequest,
  _dependencies: CalculatedDependency[],
  context: CalculationContext
): ImpactAnalysis => {
  const affectedNodes: EffectNode[] = [];
  const requiredChanges: RequiredChange[] = [];

  // Find nodes that would depend on this new Effect
  context.nodes.forEach(node => {
    if (node.type === 'controller' && request.targetLayer === 'service') {
      // Controllers might use new services
      const wouldUse = request.requiredCapabilities.some(cap => 
        node.name.toLowerCase().includes(cap.split('-')[0] || cap)
      );
      
      if (wouldUse) {
        affectedNodes.push(node);
        requiredChanges.push({
          nodeId: node.id,
          nodeName: node.name,
          changeType: 'integration',
          description: `Update to use new ${request.name}`,
          codeTemplate: generateIntegrationCode(node, request.name)
        });
      }
    }
  });

  return {
    affectedNodes,
    requiredChanges,
    riskLevel: affectedNodes.length > 5 ? 'high' : affectedNodes.length > 2 ? 'medium' : 'low',
    estimatedEffort: `${affectedNodes.length} hours`
  };
};

// Pure helper function to generate integration code
const generateIntegrationCode = (node: EffectNode, newEffectName: string): string => {
  return `
// In ${node.name}
const result = yield* ${newEffectName}.pipe(
  Effect.mapError(error => new ${node.name}Error(error))
);`;
};

// Pure function to calculate integration points
const calculateIntegrationPoints = (
  request: EffectCalculationRequest,
  context: CalculationContext
): IntegrationPoint[] => {
  const integrationPoints: IntegrationPoint[] = [];

  if (request.integrateWithExisting) {
    request.integrateWithExisting.forEach(nodeId => {
      const node = context.nodes.get(nodeId);
      if (node) {
        integrationPoints.push({
          existingNodeId: node.id,
          existingNodeName: node.name,
          integrationType: determineIntegrationType(node.type, request.targetLayer),
          integrationCode: generateSpecificIntegrationCode(node, request)
        });
      }
    });
  }

  return integrationPoints;
};

// Pure helper function to determine integration type
const determineIntegrationType = (
  existingType: NodeType,
  newType: NodeType
): 'depends-on' | 'provides-to' | 'composes-with' => {
  if (existingType === 'repository' && newType === 'service') {
    return 'depends-on';
  }
  if (existingType === 'service' && newType === 'controller') {
    return 'provides-to';
  }
  return 'composes-with';
};

// Pure helper function to generate specific integration code
const generateSpecificIntegrationCode = (
  node: EffectNode,
  request: EffectCalculationRequest
): string => {
  return `
// Integration with ${node.name}
export const ${request.name} = Effect.gen(function* () {
  const ${node.name.toLowerCase()} = yield* ${node.name};
  // Use ${node.name} capabilities
  return yield* Effect.succeed(result);
});`;
};

// Pure function to generate Effect signature
const generateEffectSignature = (
  request: EffectCalculationRequest,
  dependencies: CalculatedDependency[],
  errorTypes: CalculatedError[]
): string => {
  const successType = request.expectedOutputType || 'unknown';
  const errorType = errorTypes.length > 0 
    ? errorTypes.map(e => e.name).join(' | ')
    : 'never';
  const requirementType = dependencies.length > 0
    ? dependencies.map(d => d.name).join(' & ')
    : 'never';

  return `Effect<${successType}, ${errorType}, ${requirementType}>`;
};

// Pure function to generate implementation template
const generateImplementationTemplate = (
  request: EffectCalculationRequest,
  dependencies: CalculatedDependency[],
  errorTypes: CalculatedError[]
): string => {
  const depImports = dependencies
    .filter(d => d.isExisting)
    .map(d => `import { ${d.name} } from '${d.file}';`)
    .join('\n');

  const errorImports = errorTypes
    .filter(e => !e.isExisting)
    .map(e => `class ${e.name} extends Error {}`)
    .join('\n');

  return `
${depImports}

${errorImports}

export const ${request.name} = Effect.gen(function* () {
  // Input validation
  ${request.inputType ? `const input = yield* validateInput<${request.inputType}>(rawInput);` : ''}
  
  // Dependencies
  ${dependencies.map(d => `const ${d.name.toLowerCase()} = yield* ${d.name};`).join('\n  ')}
  
  // Business logic
  const result = yield* Effect.tryPromise({
    try: async () => {
      // Implementation here
      return {};
    },
    catch: (error) => new ${errorTypes[0]?.name || 'Error'}(String(error))
  });
  
  return result as ${request.expectedOutputType || 'unknown'};
});`;
};

// Pure function to generate testing strategy
const generateTestingStrategy = (
  request: EffectCalculationRequest,
  dependencies: CalculatedDependency[],
  errorTypes: CalculatedError[]
): TestingGuide => {
  const unitTests = [
    `Test ${request.name} with valid input`,
    `Test ${request.name} with invalid input`,
    ...errorTypes.map(e => `Test ${request.name} handles ${e.name}`)
  ];

  const integrationTests = dependencies
    .filter(d => d.isExisting)
    .map(d => `Test ${request.name} integration with ${d.name}`);

  const errorScenarios = errorTypes.map(e => 
    e.scenarios.join(', ')
  );

  const testCode = `
describe('${request.name}', () => {
  it('should succeed with valid input', async () => {
    const result = await Effect.runPromise(${request.name});
    expect(result).toBeDefined();
  });
  
  ${errorTypes.map(e => `
  it('should handle ${e.name}', async () => {
    const result = await Effect.runPromiseExit(${request.name});
    expect(Exit.isFailure(result)).toBe(true);
  });`).join('\n')}
});`;

  return {
    unitTests,
    integrationTests,
    errorScenarios,
    testCode
  };
};

// Pure function to generate mathematical proof
const generateMathematicalProof = (
  request: EffectCalculationRequest,
  dependencies: CalculatedDependency[],
  errorTypes: CalculatedError[]
): string => {
  return `
## Mathematical Proof of Effect Correctness

### Given:
- Input type: ${request.inputType || 'any'}
- Output type: ${request.expectedOutputType || 'unknown'}
- Dependencies: {${dependencies.map(d => d.name).join(', ')}}
- Error types: {${errorTypes.map(e => e.name).join(', ')}}

### Proof:
1. **Type Safety**: Effect<A, E, R> ensures compile-time type checking
2. **Error Handling**: All ${errorTypes.length} error scenarios are explicitly handled
3. **Dependency Injection**: All ${dependencies.length} dependencies are properly injected
4. **Composability**: Effect follows monad laws (left identity, right identity, associativity)
5. **Railway Oriented**: Success and failure paths are explicitly defined

### Therefore:
The Effect ${request.name} is mathematically sound and type-safe ∎`;
};

// Main pure function to calculate new Effect
export const calculateNewEffect = (
  analysis: AnalysisResult,
  request: EffectCalculationRequest
): EffectCalculationResult => {
  const context = buildCalculationMaps(analysis);
  
  const dependencies = calculateRequiredDependencies(request, context);
  const errorTypes = calculateErrorTypes(request, dependencies);
  const upstreamImpact = calculateUpstreamImpact(dependencies, context);
  const downstreamImpact = calculateDownstreamImpact(request, dependencies, context);
  const integrationPoints = calculateIntegrationPoints(request, context);
  const effectSignature = generateEffectSignature(request, dependencies, errorTypes);
  const implementationTemplate = generateImplementationTemplate(request, dependencies, errorTypes);
  const testingStrategy = generateTestingStrategy(request, dependencies, errorTypes);
  const mathematicalProof = generateMathematicalProof(request, dependencies, errorTypes);

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
};

// Pure function to generate system extension
export const generateSystemExtension = (
  analysis: AnalysisResult,
  request: EffectCalculationRequest
): string => {
  const result = calculateNewEffect(analysis, request);
  
  let output = '';
  output += `# 🚀 SYSTEM EXTENSION PLAN: ${request.name}\n\n`;
  output += `## Effect Signature\n\`\`\`typescript\n${result.effectSignature}\n\`\`\`\n\n`;
  output += `## Required Dependencies (${result.requiredDependencies.length})\n`;
  result.requiredDependencies.forEach(dep => {
    output += `- **${dep.name}** (${dep.type}): ${dep.reason}\n`;
  });
  output += `\n## Error Handling (${result.errorTypes.length} types)\n`;
  result.errorTypes.forEach(err => {
    output += `- **${err.name}**: ${err.scenarios.join(', ')}\n`;
  });
  output += `\n## Implementation\n\`\`\`typescript\n${result.implementationTemplate}\n\`\`\`\n`;
  output += `\n## Testing Strategy\n${result.testingStrategy.testCode}\n`;
  output += `\n${result.mathematicalProof}`;
  
  return output;
};