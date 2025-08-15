/**
 * Purpose: Pure functional LLM-readable tree structures for Effect TS patterns
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

// Pure function to create node lookup map
const createNodeMap = (nodes: EffectNode[]): Map<string, EffectNode> => {
  const nodeMap = new Map<string, EffectNode>();
  nodes.forEach(node => {
    nodeMap.set(node.id, node);
  });
  return nodeMap;
};

// Pure function to get direct dependencies
const getDirectDependencies = (nodeId: string, edges: EffectEdge[]): EffectEdge[] => {
  return edges.filter(edge => edge.source === nodeId);
};

// Pure function to get direct dependents
const getDirectDependents = (nodeId: string, edges: EffectEdge[]): EffectEdge[] => {
  return edges.filter(edge => edge.target === nodeId);
};

// Pure function to build dependency tree
const buildDependencyTree = (
  nodeId: string,
  nodes: Map<string, EffectNode>,
  edges: EffectEdge[],
  depth: number = 0,
  visited: Set<string> = new Set()
): LLMTreeNode | null => {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);
  
  const node = nodes.get(nodeId);
  if (!node) return null;
  
  const dependencies = getDirectDependencies(nodeId, edges);
  const children: LLMTreeNode[] = [];
  
  for (const edge of dependencies) {
    const child = buildDependencyTree(edge.target, nodes, edges, depth + 1, visited);
    if (child) {
      children.push(child);
    }
  }
  
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    file: node.filePath,
    line: node.line,
    description: node.description || '',
    effectSignature: node.effectSignature,
    children,
    depth,
    relationshipType: depth === 0 ? 'root' : 'depends-on'
  };
};

// Pure function to build impact tree
const buildImpactTree = (
  nodeId: string,
  nodes: Map<string, EffectNode>,
  edges: EffectEdge[],
  depth: number = 0,
  visited: Set<string> = new Set()
): LLMTreeNode | null => {
  if (visited.has(nodeId)) return null;
  visited.add(nodeId);
  
  const node = nodes.get(nodeId);
  if (!node) return null;
  
  const dependents = getDirectDependents(nodeId, edges);
  const children: LLMTreeNode[] = [];
  
  for (const edge of dependents) {
    const child = buildImpactTree(edge.source, nodes, edges, depth + 1, visited);
    if (child) {
      children.push(child);
    }
  }
  
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    file: node.filePath,
    line: node.line,
    description: node.description || '',
    effectSignature: node.effectSignature,
    children,
    depth,
    relationshipType: depth === 0 ? 'root' : 'used-by'
  };
};

// Pure function to format tree for LLM
const formatTreeForLLM = (
  rootNode: EffectNode,
  dependencyTree: LLMTreeNode | null,
  impactTree: LLMTreeNode | null
): string => {
  let output = '';
  
  output += `# 🎯 EFFECT ANALYSIS: ${rootNode.name}\n\n`;
  output += `## 📍 Location\n`;
  output += `- **File**: ${rootNode.filePath}\n`;
  output += `- **Line**: ${rootNode.line}\n`;
  output += `- **Type**: ${rootNode.type}\n\n`;
  
  if (rootNode.effectSignature) {
    output += `## 🔷 Effect Signature\n`;
    output += '```typescript\n';
    output += `Effect<${rootNode.effectSignature.success}, `;
    output += `${rootNode.effectSignature.error.join(' | ') || 'never'}, `;
    output += `${rootNode.effectSignature.dependencies.join(' & ') || 'never'}>\n`;
    output += '```\n\n';
  }
  
  output += `## 🌳 DEPENDENCY TREE (What ${rootNode.name} depends on)\n\n`;
  if (dependencyTree) {
    output += formatNodeTree(dependencyTree, '');
  } else {
    output += '- No dependencies\n';
  }
  output += '\n';
  
  output += `## 🎯 IMPACT TREE (What depends on ${rootNode.name})\n\n`;
  if (impactTree) {
    output += formatNodeTree(impactTree, '');
  } else {
    output += '- No dependents\n';
  }
  
  return output;
};

// Pure helper function to format node tree
const formatNodeTree = (node: LLMTreeNode, indent: string): string => {
  let output = '';
  const marker = node.depth === 0 ? '🎯' : node.relationshipType === 'depends-on' ? '→' : '←';
  
  output += `${indent}${marker} **${node.name}** (${node.type})\n`;
  output += `${indent}  📁 ${node.file}:${node.line}\n`;
  
  if (node.effectSignature) {
    output += `${indent}  Effect<${node.effectSignature.success}, `;
    output += `${node.effectSignature.error.join('|') || 'never'}>\n`;
  }
  
  if (node.children.length > 0) {
    for (const child of node.children) {
      output += formatNodeTree(child, indent + '  ');
    }
  }
  
  return output;
};

// Pure function to generate impact analysis
const generateImpactAnalysis = (rootNode: EffectNode, impactTree: LLMTreeNode | null): string => {
  let output = '';
  
  output += `## 📊 IMPACT ANALYSIS\n\n`;
  
  const countNodes = (tree: LLMTreeNode | null): number => {
    if (!tree) return 0;
    return 1 + tree.children.reduce((sum, child) => sum + countNodes(child), 0);
  };
  
  const impactedCount = countNodes(impactTree) - 1;
  
  output += `### Direct Impact\n`;
  output += `- **Nodes directly affected**: ${impactTree?.children.length || 0}\n`;
  output += `- **Total cascade impact**: ${impactedCount} nodes\n\n`;
  
  if (impactTree && impactTree.children.length > 0) {
    output += `### Critical Paths\n`;
    impactTree.children.forEach(child => {
      output += `- **${child.name}** → May break if ${rootNode.name} changes\n`;
    });
  }
  
  return output;
};

// Pure function to generate modification guide
const generateModificationGuide = (rootNode: EffectNode): string => {
  let output = '';
  
  output += `## 🔧 MODIFICATION GUIDE\n\n`;
  output += `### When modifying ${rootNode.name}:\n\n`;
  
  output += `#### ✅ Safe Changes\n`;
  output += `- Adding new optional parameters\n`;
  output += `- Improving error messages\n`;
  output += `- Performance optimizations that don't change behavior\n\n`;
  
  output += `#### ⚠️ Breaking Changes\n`;
  output += `- Changing the Effect signature (A, E, or R types)\n`;
  output += `- Modifying return types\n`;
  output += `- Removing or renaming public methods\n`;
  output += `- Changing error types or error handling behavior\n\n`;
  
  output += `#### 📝 Testing Requirements\n`;
  output += `1. Unit test the modified Effect\n`;
  output += `2. Integration test with immediate dependencies\n`;
  output += `3. End-to-end test affected workflows\n`;
  output += `4. Check error handling paths\n`;
  
  return output;
};

// Pure function to generate effect patterns
const generateEffectPatterns = (rootNode: EffectNode, dependencyTree: LLMTreeNode | null): string => {
  let output = '';
  
  output += `## 🎨 EFFECT PATTERNS\n\n`;
  
  output += `### Pattern Type: ${rootNode.type}\n`;
  
  if (rootNode.type === 'service') {
    output += `- **Role**: Business logic orchestration\n`;
    output += `- **Pattern**: Service layer coordinating multiple repositories\n`;
  } else if (rootNode.type === 'repository') {
    output += `- **Role**: Data access layer\n`;
    output += `- **Pattern**: Repository pattern for data persistence\n`;
  } else if (rootNode.type === 'controller') {
    output += `- **Role**: HTTP request handling\n`;
    output += `- **Pattern**: Controller handling routes and responses\n`;
  }
  
  output += `\n### Dependencies Pattern\n`;
  if (dependencyTree && dependencyTree.children.length > 0) {
    const types = new Set(dependencyTree.children.map(c => c.type));
    output += `- Depends on: ${Array.from(types).join(', ')}\n`;
  } else {
    output += `- No dependencies (leaf node)\n`;
  }
  
  return output;
};

// Pure function to generate architecture overview
const generateArchitectureOverview = (rootNode: EffectNode): string => {
  let output = '';
  
  output += `## 🏗️ ARCHITECTURAL CONTEXT\n\n`;
  output += `### Layer Position\n`;
  output += `- **Current Layer**: ${rootNode.type}\n`;
  output += `- **Architectural Role**: ${getArchitecturalRole(rootNode.type)}\n\n`;
  
  output += `### Design Principles\n`;
  output += `- Follow Railway Oriented Programming (ROP)\n`;
  output += `- Handle errors explicitly through Effect types\n`;
  output += `- Compose Effects using pipe and flow\n`;
  output += `- Keep dependencies injectable through R type\n`;
  
  return output;
};

// Pure helper function to get architectural role
const getArchitecturalRole = (type: string): string => {
  const roles: Record<string, string> = {
    controller: 'HTTP request/response handling',
    service: 'Business logic and orchestration',
    repository: 'Data persistence and retrieval',
    middleware: 'Cross-cutting concerns',
    utility: 'Helper functions and utilities',
    worker: 'Background job processing',
    error: 'Error handling and recovery'
  };
  return roles[type] || 'Domain-specific functionality';
};

// Pure function to group nodes by layer
const groupNodesByLayer = (nodes: EffectNode[]): Record<string, EffectNode[]> => {
  const layers: Record<string, EffectNode[]> = {
    controllers: [],
    services: [],
    repositories: [],
    middleware: [],
    utilities: [],
    workers: [],
    errors: []
  };
  
  nodes.forEach(node => {
    const layerKey = `${node.type}s`;
    if (layers[layerKey]) {
      layers[layerKey].push(node);
    } else {
      if (!layers.utilities) layers.utilities = [];
      layers.utilities.push(node);
    }
  });
  
  return layers;
};

// Main pure function to generate node analysis
export const generateNodeAnalysis = (analysis: AnalysisResult, nodeId: string): LLMEffectAnalysis => {
  const nodes = createNodeMap(analysis.railway.nodes);
  const edges = analysis.railway.edges;
  
  const rootNode = nodes.get(nodeId);
  if (!rootNode) {
    throw new Error(`Node ${nodeId} not found`);
  }
  
  const dependencyTree = buildDependencyTree(nodeId, nodes, edges);
  const impactTree = buildImpactTree(nodeId, nodes, edges);
  
  return {
    rootNode: dependencyTree || {
      id: rootNode.id,
      name: rootNode.name,
      type: rootNode.type,
      file: rootNode.filePath,
      line: rootNode.line,
      description: rootNode.description || '',
      effectSignature: rootNode.effectSignature,
      children: [],
      depth: 0,
      relationshipType: 'root'
    },
    fullDependencyTree: formatTreeForLLM(rootNode, dependencyTree, impactTree),
    impactAnalysis: generateImpactAnalysis(rootNode, impactTree),
    modificationGuide: generateModificationGuide(rootNode),
    effectPatterns: generateEffectPatterns(rootNode, dependencyTree),
    architecture: generateArchitectureOverview(rootNode)
  };
};

// Pure function to generate system overview
export const generateSystemOverview = (analysis: AnalysisResult): string => {
  const nodes = createNodeMap(analysis.railway.nodes);
  const edges = analysis.railway.edges;
  const layers = groupNodesByLayer(analysis.railway.nodes);
  
  let output = '';
  
  output += '# 🏗️ EFFECT TS SYSTEM ARCHITECTURE OVERVIEW\n\n';
  output += '## 📊 System Statistics\n';
  output += `- Total Nodes: ${analysis.railway.nodes.length}\n`;
  output += `- Total Dependencies: ${edges.length}\n`;
  output += `- Entry Points: ${analysis.railway.entryPoints.length}\n\n`;
  
  // Layer-by-layer breakdown
  for (const [layerName, layerNodes] of Object.entries(layers)) {
    if (layerNodes.length === 0) continue;
    
    output += `## 🎯 ${layerName.toUpperCase()} LAYER (${layerNodes.length} nodes)\n\n`;
    
    layerNodes.forEach(node => {
      const dependencies = getDirectDependencies(node.id, edges);
      const dependents = getDirectDependents(node.id, edges);
      
      output += `### ${node.name}\n`;
      output += `- **File**: ${node.filePath}:${node.line}\n`;
      output += `- **Dependencies**: ${dependencies.length}\n`;
      output += `- **Dependents**: ${dependents.length}\n`;
      
      if (node.effectSignature) {
        output += `- **Effect**: <${node.effectSignature.success}, `;
        output += `${node.effectSignature.error.join('|') || 'never'}>\n`;
      }
      output += '\n';
    });
  }
  
  return output;
};