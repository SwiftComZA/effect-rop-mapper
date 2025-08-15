/**
 * Purpose: Pure functional AST analyzer for TypeScript files and Effect TS patterns
 * Dependencies: TypeScript Compiler API (pure analysis functions)
 * 
 * Example Input:
 * ```
 * analyzeSourceFiles(sourceFiles)
 * ```
 * 
 * Expected Output:
 * ```
 * EffectRailway with nodes and edges representing the complete Effect flow
 * ```
 */

import * as ts from 'typescript';
import type { 
  EffectNode, 
  EffectEdge, 
  EffectRailway, 
  NodeType, 
  EffectSignature,
  AnalysisResult,
  LayerMap
} from '../types/effect-node.js';

// Analysis state (immutable)
export interface AnalysisState {
  nodes: Map<string, EffectNode>;
  edges: Set<EffectEdge>;
  nodeCounter: number;
}

// Source file input
export interface SourceFileInput {
  path: string;
  content: string;
  sourceFile: ts.SourceFile;
}

// Create initial state
export const createInitialState = (): AnalysisState => ({
  nodes: new Map(),
  edges: new Set(),
  nodeCounter: 0
});

// Pure function to analyze multiple source files
export const analyzeSourceFiles = (
  sourceFiles: SourceFileInput[]
): AnalysisResult => {
  let state = createInitialState();
  
  // Process each file
  for (const fileInput of sourceFiles) {
    state = analyzeSourceFile(state, fileInput);
  }
  
  const railway = buildRailway(state);
  const statistics = calculateStatistics(railway);
  
  return { railway, statistics };
};

// Pure function to analyze a single source file
export const analyzeSourceFile = (
  state: AnalysisState,
  fileInput: SourceFileInput
): AnalysisState => {
  return visitNode(state, fileInput.sourceFile, fileInput.path);
};

// Pure function to visit and analyze a node
const visitNode = (
  state: AnalysisState,
  node: ts.Node,
  filePath: string
): AnalysisState => {
  let newState = state;
  
  // Look for Effect imports
  if (ts.isImportDeclaration(node)) {
    newState = analyzeImport(newState, node, filePath);
  }
  
  // Look for Effect.gen patterns
  if (ts.isCallExpression(node)) {
    newState = analyzeCallExpression(newState, node, filePath);
  }
  
  // Look for Effect type annotations
  if (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node)) {
    newState = analyzeDeclaration(newState, node, filePath);
  }
  
  // Look for class definitions that might use Effect
  if (ts.isClassDeclaration(node)) {
    newState = analyzeClassDeclaration(newState, node, filePath);
  }
  
  // Recursively visit children
  ts.forEachChild(node, (child) => {
    newState = visitNode(newState, child, filePath);
  });
  
  return newState;
};

// Pure function to analyze imports
const analyzeImport = (
  state: AnalysisState,
  node: ts.ImportDeclaration,
  _filePath: string
): AnalysisState => {
  const moduleSpecifier = node.moduleSpecifier;
  
  if (ts.isStringLiteral(moduleSpecifier)) {
    const moduleName = moduleSpecifier.text;
    
    // Check if it's an Effect import
    if (moduleName.includes('effect') || moduleName.includes('@effect')) {
      // Track Effect usage in this file
      // This information could be used to identify Effect-using modules
    }
  }
  
  return state;
};

// Pure function to analyze call expressions
const analyzeCallExpression = (
  state: AnalysisState,
  node: ts.CallExpression,
  filePath: string
): AnalysisState => {
  const expression = node.expression;
  
  // Check for Effect.gen pattern
  if (ts.isPropertyAccessExpression(expression)) {
    const object = expression.expression;
    const property = expression.name;
    
    if (ts.isIdentifier(object) && object.text === 'Effect' && 
        ts.isIdentifier(property) && property.text === 'gen') {
      return analyzeEffectGen(state, node, filePath);
    }
  }
  
  // Check for pipe pattern
  if (ts.isIdentifier(expression) && expression.text === 'pipe') {
    return analyzePipe(state, node, filePath);
  }
  
  return state;
};

// Pure function to analyze Effect.gen
const analyzeEffectGen = (
  state: AnalysisState,
  node: ts.CallExpression,
  filePath: string
): AnalysisState => {
  const parent = findParentDeclaration(node);
  if (!parent) return state;
  
  const name = getDeclarationName(parent);
  const line = getLineNumber(node);
  const type = inferNodeType(parent, filePath);
  const signature = extractEffectSignature(parent);
  
  const nodeId = generateNodeId(state.nodeCounter);
  const effectNode: EffectNode = {
    id: nodeId,
    name: name || `effect_${state.nodeCounter}`,
    type,
    filePath,
    line,
    metrics: {
      callsCount: 0,
      calledByCount: 0,
      lines: 1
    },
    ...(signature && { effectSignature: signature })
  };
  
  const newNodes = new Map(state.nodes);
  newNodes.set(nodeId, effectNode);
  
  // Look for dependencies within Effect.gen
  const dependencies = extractDependencies(node);
  const newEdges = new Set(state.edges);
  
  dependencies.forEach(dep => {
    const depNode = findNodeByName(newNodes, dep);
    if (depNode) {
      newEdges.add({
        id: `edge_${nodeId}_${depNode.id}`,
        source: nodeId,
        target: depNode.id,
        type: 'dependency'
      });
    }
  });
  
  return {
    nodes: newNodes,
    edges: newEdges,
    nodeCounter: state.nodeCounter + 1
  };
};

// Pure function to analyze pipe
const analyzePipe = (
  state: AnalysisState,
  node: ts.CallExpression,
  filePath: string
): AnalysisState => {
  const parent = findParentDeclaration(node);
  if (!parent) return state;
  
  const name = getDeclarationName(parent);
  const line = getLineNumber(node);
  const type = inferNodeType(parent, filePath);
  
  const nodeId = generateNodeId(state.nodeCounter);
  const effectNode: EffectNode = {
    id: nodeId,
    name: name || `pipe_${state.nodeCounter}`,
    type,
    filePath,
    line,
    metrics: {
      callsCount: 0,
      calledByCount: 0,
      lines: 1
    }
  };
  
  const newNodes = new Map(state.nodes);
  newNodes.set(nodeId, effectNode);
  
  // Analyze pipe stages for dependencies
  const stages = extractPipeStages(node);
  const newEdges = new Set(state.edges);
  
  stages.forEach(stage => {
    const depNode = findNodeByName(newNodes, stage);
    if (depNode) {
      newEdges.add({
        id: `edge_${nodeId}_${depNode.id}`,
        source: nodeId,
        target: depNode.id,
        type: 'pipe'
      });
    }
  });
  
  return {
    nodes: newNodes,
    edges: newEdges,
    nodeCounter: state.nodeCounter + 1
  };
};

// Pure function to analyze declarations
const analyzeDeclaration = (
  state: AnalysisState,
  node: ts.VariableDeclaration | ts.FunctionDeclaration,
  filePath: string
): AnalysisState => {
  // Check if the declaration has Effect type annotation
  const typeNode = ts.isVariableDeclaration(node) ? node.type : 
                   ts.isFunctionDeclaration(node) ? node.type : undefined;
  
  if (typeNode && isEffectType(typeNode)) {
    const name = getDeclarationName(node);
    const line = getLineNumber(node);
    const type = inferNodeType(node, filePath);
    const signature = extractEffectSignatureFromType(typeNode);
    
    const nodeId = generateNodeId(state.nodeCounter);
    const effectNode: EffectNode = {
      id: nodeId,
      name: name || `effect_${state.nodeCounter}`,
      type,
      filePath,
      line,
      metrics: {
        callsCount: 0,
        calledByCount: 0,
        lines: 1
      },
      ...(signature && { effectSignature: signature })
    };
    
    const newNodes = new Map(state.nodes);
    newNodes.set(nodeId, effectNode);
    
    return {
      nodes: newNodes,
      edges: state.edges,
      nodeCounter: state.nodeCounter + 1
    };
  }
  
  return state;
};

// Pure function to analyze class declarations
const analyzeClassDeclaration = (
  state: AnalysisState,
  node: ts.ClassDeclaration,
  filePath: string
): AnalysisState => {
  const className = node.name?.text;
  if (!className) return state;
  
  let newState = state;
  
  // Check methods for Effect usage
  node.members.forEach(member => {
    if (ts.isMethodDeclaration(member)) {
      const returnType = member.type;
      if (returnType && isEffectType(returnType)) {
        const methodName = member.name && ts.isIdentifier(member.name) ? 
                          member.name.text : 'method';
        const line = getLineNumber(member);
        const type = inferNodeType(member, filePath);
        const signature = extractEffectSignatureFromType(returnType);
        
        const nodeId = generateNodeId(newState.nodeCounter);
        const effectNode: EffectNode = {
          id: nodeId,
          name: `${className}.${methodName}`,
          type,
          filePath,
          line,
          metrics: {
            callsCount: 0,
            calledByCount: 0,
            lines: 1
          },
          ...(signature && { effectSignature: signature })
        };
        
        const newNodes = new Map(newState.nodes);
        newNodes.set(nodeId, effectNode);
        
        newState = {
          nodes: newNodes,
          edges: newState.edges,
          nodeCounter: newState.nodeCounter + 1
        };
      }
    }
  });
  
  return newState;
};

// Helper functions (all pure)

const generateNodeId = (counter: number): string => {
  return `effect_node_${counter}`;
};

const findParentDeclaration = (node: ts.Node): ts.Node | undefined => {
  let parent = node.parent;
  while (parent) {
    if (ts.isVariableDeclaration(parent) || 
        ts.isFunctionDeclaration(parent) ||
        ts.isMethodDeclaration(parent) ||
        ts.isPropertyDeclaration(parent)) {
      return parent;
    }
    parent = parent.parent;
  }
  return undefined;
};

const getDeclarationName = (node: ts.Node): string | undefined => {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  if (ts.isFunctionDeclaration(node) && node.name) {
    return node.name.text;
  }
  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }
  return undefined;
};

const getLineNumber = (node: ts.Node): number => {
  const sourceFile = node.getSourceFile();
  if (sourceFile) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    return line + 1;
  }
  return 0;
};

const inferNodeType = (node: ts.Node, filePath: string): NodeType => {
  const path = filePath.toLowerCase();
  
  if (path.includes('controller')) return 'controller';
  if (path.includes('service')) return 'service';
  if (path.includes('repository')) return 'repository';
  if (path.includes('middleware')) return 'middleware';
  if (path.includes('worker')) return 'worker';
  if (path.includes('error')) return 'error';
  
  // Check node context
  if (ts.isClassDeclaration(node.parent)) {
    const className = node.parent.name?.text?.toLowerCase();
    if (className?.includes('controller')) return 'controller';
    if (className?.includes('service')) return 'service';
    if (className?.includes('repository')) return 'repository';
  }
  
  return 'utility';
};

const isEffectType = (typeNode: ts.TypeNode): boolean => {
  if (ts.isTypeReferenceNode(typeNode)) {
    const typeName = typeNode.typeName;
    if (ts.isIdentifier(typeName)) {
      return typeName.text === 'Effect';
    }
  }
  return false;
};

const extractEffectSignature = (node: ts.Node): EffectSignature | undefined => {
  const typeNode = ts.isVariableDeclaration(node) ? node.type :
                  ts.isFunctionDeclaration(node) ? node.type :
                  ts.isMethodDeclaration(node) ? node.type : undefined;
  
  if (typeNode) {
    return extractEffectSignatureFromType(typeNode);
  }
  
  return undefined;
};

const extractEffectSignatureFromType = (typeNode: ts.TypeNode): EffectSignature | undefined => {
  if (ts.isTypeReferenceNode(typeNode) && typeNode.typeArguments) {
    const args = typeNode.typeArguments;
    if (args.length >= 3) {
      return {
        success: args[0] ? typeNodeToString(args[0]) : 'unknown',
        error: args[1] ? extractErrorTypes(args[1]) : [],
        dependencies: args[2] ? extractRequirements(args[2]) : []
      };
    }
  }
  return undefined;
};

const typeNodeToString = (node: ts.TypeNode): string => {
  if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
    return node.typeName.text;
  }
  if (ts.isLiteralTypeNode(node)) {
    return node.literal.getText();
  }
  return 'unknown';
};

const extractErrorTypes = (node: ts.TypeNode): string[] => {
  const errors: string[] = [];
  
  if (ts.isUnionTypeNode(node)) {
    node.types.forEach(type => {
      errors.push(typeNodeToString(type));
    });
  } else {
    errors.push(typeNodeToString(node));
  }
  
  return errors;
};

const extractRequirements = (node: ts.TypeNode): string[] => {
  const requirements: string[] = [];
  
  if (ts.isIntersectionTypeNode(node)) {
    node.types.forEach(type => {
      requirements.push(typeNodeToString(type));
    });
  } else {
    requirements.push(typeNodeToString(node));
  }
  
  return requirements;
};


const extractDependencies = (node: ts.CallExpression): string[] => {
  const deps: string[] = [];
  
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      deps.push(n.expression.text);
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name)) {
      deps.push(n.name.text);
    }
    ts.forEachChild(n, visit);
  };
  
  if (node.arguments.length > 0 && node.arguments[0]) {
    visit(node.arguments[0]);
  }
  
  return deps;
};

const extractPipeStages = (node: ts.CallExpression): string[] => {
  const stages: string[] = [];
  
  node.arguments.forEach(arg => {
    if (ts.isIdentifier(arg)) {
      stages.push(arg.text);
    }
    if (ts.isCallExpression(arg) && ts.isIdentifier(arg.expression)) {
      stages.push(arg.expression.text);
    }
  });
  
  return stages;
};

const findNodeByName = (nodes: Map<string, EffectNode>, name: string): EffectNode | undefined => {
  for (const node of nodes.values()) {
    if (node.name === name || node.name.endsWith(`.${name}`)) {
      return node;
    }
  }
  return undefined;
};

// Pure function to build railway from state
const buildRailway = (state: AnalysisState): EffectRailway => {
  const nodes = Array.from(state.nodes.values());
  const edges = Array.from(state.edges);
  
  // Identify entry points (nodes with no incoming edges)
  const targetNodes = new Set(edges.map(e => e.target));
  const entryPoints = nodes
    .filter(n => !targetNodes.has(n.id))
    .map(n => n.id);
  
  // Build layers
  const layers = buildLayers(nodes);
  
  return {
    nodes,
    edges,
    entryPoints,
    layers
  };
};

// Pure function to build layers
const buildLayers = (nodes: EffectNode[]): LayerMap => {
  const layers: LayerMap = {
    controllers: [],
    services: [],
    repositories: [],
    middleware: [],
    workers: [],
    utilities: [],
    errors: []
  };
  
  nodes.forEach(node => {
    const layerKey = (node.type + 's') as keyof LayerMap;
    if (layers[layerKey]) {
      layers[layerKey].push(node.id);
    }
  });
  
  return layers;
};

// Pure function to calculate statistics
const calculateStatistics = (railway: EffectRailway) => {
  const stats = {
    totalNodes: railway.nodes.length,
    totalEdges: railway.edges.length,
    nodesPerType: {} as Record<string, number>,
    edgesPerType: {} as Record<string, number>,
    errorTypes: [] as string[],
    dependencyTypes: [] as string[]
  };
  
  // Count nodes per type
  railway.nodes.forEach(node => {
    stats.nodesPerType[node.type] = (stats.nodesPerType[node.type] || 0) + 1;
  });
  
  // Count edges per type
  railway.edges.forEach(edge => {
    stats.edgesPerType[edge.type] = (stats.edgesPerType[edge.type] || 0) + 1;
  });
  
  return stats;
};