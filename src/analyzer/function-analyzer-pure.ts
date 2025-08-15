/**
 * Purpose: Pure functional TypeScript function analyzer for API integration
 * Dependencies: TypeScript compiler API, glob
 * 
 * Example Input:
 * ```
 * const result = await analyzeFunctions('/path/to/project');
 * ```
 * 
 * Expected Output:
 * ```
 * { functions: [...], byPath: {...}, dependencyTree: {...} }
 * ```
 */

import * as ts from 'typescript';
import * as path from 'path';
import { glob } from 'glob';
import {
  NestedStructure,
  DependencyTree,
  FolderStatsMap,
  TopComplexFunction,
  NodeWithParameters,
  FunctionDisplay,
  DependencyEntry,
  FolderStatistics,
  HighComplexityFunction
} from './function-analyzer-types.js';

export interface FunctionLocation {
  name: string;
  file: string;
  line: number;
}

export interface FunctionInfo {
  name: string;
  file: string;
  path: string;
  folder: string;
  startLine: number;
  endLine: number;
  kind: string;
  parameters: string[];
  calls: FunctionLocation[];
  calledBy: FunctionLocation[];
  callsCount: number;
  calledByCount: number;
}

export interface FunctionAnalysisResult {
  metadata: {
    analyzedAt: string;
    targetDirectory: string;
    totalFunctions: number;
    totalFolders: number;
    avgDependencies: number;
  };
  summary: {
    totalFunctions: number;
    zeroDependencies: number;
    lowComplexity: number;
    mediumComplexity: number;
    highComplexity: number;
    veryHighComplexity: number;
  };
  functions: FunctionInfo[];
  byPath: NestedStructure;
  dependencyTree: DependencyTree;
  folderStats: FolderStatsMap;
  topComplexFunctions: TopComplexFunction[];
}

// State type for pure functional approach
interface AnalyzerState {
  functions: Map<string, FunctionInfo>;
  functionsByName: Map<string, string[]>;
  program: ts.Program | null;
  rootDir: string;
  logs: string[];
}

// Pure function to create initial state
const createInitialState = (rootDir: string): AnalyzerState => ({
  functions: new Map(),
  functionsByName: new Map(),
  program: null,
  rootDir,
  logs: []
});

// Pure function to add a log message (returns new state)
const addLog = (state: AnalyzerState, message: string): AnalyzerState => ({
  ...state,
  logs: [...state.logs, message]
});

// Pure function to find TypeScript files
const findTypeScriptFiles = (rootDir: string): string[] => {
  return glob.sync('**/*.ts', {
    cwd: rootDir,
    ignore: [
      'node_modules/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
      'dist/**',
      'build/**',
      '.git/**'
    ],
    absolute: true
  });
};

// Pure function to create TypeScript program
const createProgram = (files: string[]): ts.Program => {
  return ts.createProgram(files, {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    allowJs: false,
    skipLibCheck: true,
    noEmit: true
  });
};

// Pure function to get function name
const getFunctionName = (node: ts.Node, sourceFile?: ts.SourceFile): string | null => {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
    try {
      if (node.name) {
        // For identifiers, use escapedText property
        if (ts.isIdentifier(node.name)) {
          return node.name.escapedText?.toString() || null;
        }
        // For other name types, try getText with sourceFile
        if (sourceFile && typeof node.name.getText === 'function') {
          return node.name.getText(sourceFile) || null;
        }
      }
    } catch (error) {
      // Silently ignore - too many warnings otherwise
    }
    return null;
  }
  
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    try {
      const parent = node.parent;
      
      if (parent && ts.isVariableDeclaration(parent)) {
        if (ts.isIdentifier(parent.name)) {
          return parent.name.escapedText?.toString() || null;
        }
      }
      if (parent && ts.isPropertyAssignment(parent)) {
        if (ts.isIdentifier(parent.name)) {
          return parent.name.escapedText?.toString() || null;
        }
        if (sourceFile && parent.name) {
          return parent.name.getText(sourceFile) || null;
        }
      }
      // Check for arrow function in call expression (like forEach, map, etc)
      if (parent && ts.isCallExpression(parent)) {
        // These are inline anonymous functions - skip them
        return null;
      }
    } catch (error) {
      // Silently ignore
    }
  }
  
  return null;
};

// Pure function to get parameters
const getParameters = (node: ts.Node, sourceFile?: ts.SourceFile): string[] => {
  const params: string[] = [];
  
  try {
    if ('parameters' in node) {
      const nodeWithParams = node as NodeWithParameters;
      if (nodeWithParams.parameters) {
        // Use forEach instead of for...of to avoid iteration issues
        nodeWithParams.parameters.forEach((param: ts.ParameterDeclaration) => {
          if (param.name) {
            if (ts.isIdentifier(param.name)) {
              const name = param.name.escapedText?.toString();
              if (name) {
                params.push(name);
              }
            } else {
              // For other parameter types (like destructuring), skip for now
              params.push('...');
            }
          }
        });
      }
    }
  } catch (error) {
    // If there's any error, just return what we have so far
  }
  
  return params;
};

// Pure function to visit node and collect functions
const visitNode = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  state: AnalyzerState
): AnalyzerState => {
  let newState = state;
  
  // Check if node is a function
  if (ts.isFunctionDeclaration(node) || 
      ts.isMethodDeclaration(node) || 
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)) {
    
    const name = getFunctionName(node, sourceFile);
    if (!name) {
      // Skip anonymous functions
      return newState;
    }
    try {
      const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      
      const relativePath = path.relative(state.rootDir, sourceFile.fileName);
      const pathParts = relativePath.split(path.sep);
      // Get the folder path (everything except the filename)
      const folder = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'root';
      const functionId = `${relativePath}:${name}:${startPos.line + 1}`;

    const funcInfo: FunctionInfo = {
      name,
      file: relativePath,
      path: relativePath,
      folder: folder || 'root',
      startLine: startPos.line + 1,
      endLine: endPos.line + 1,
      kind: ts.SyntaxKind[node.kind],
      parameters: getParameters(node, sourceFile),
      calls: [],
      calledBy: [],
      callsCount: 0,
      calledByCount: 0
    };

    // Update functions map
    try {
      const newFunctions = new Map(newState.functions);
      newFunctions.set(functionId, funcInfo);
      
      // Update functionsByName map
      const newFunctionsByName = new Map(newState.functionsByName);
      if (!newFunctionsByName.has(name)) {
        newFunctionsByName.set(name, []);
      }
      const nameArray = newFunctionsByName.get(name);
      if (nameArray) {
        newFunctionsByName.set(name, [...nameArray, functionId]);
      }
      
      newState = {
        ...newState,
        functions: newFunctions,
        functionsByName: newFunctionsByName
      };
    } catch (error) {
      // Silently skip functions that fail to add
    }
    } catch (error) {
      // Silently skip functions that fail to process
    }
  }

  // Continue traversing
  try {
    ts.forEachChild(node, child => {
      try {
        newState = visitNode(child, sourceFile, newState);
      } catch (error) {
        // Silently continue - some nodes may cause issues
      }
    });
  } catch (error) {
    // Silently continue if forEachChild fails
  }
  
  return newState;
};

// Pure function to get called function name
const getCalledFunctionName = (node: ts.CallExpression, sourceFile?: ts.SourceFile): string | null => {
  try {
    const expression = node.expression;
    
    if (ts.isIdentifier(expression)) {
      return expression.escapedText?.toString() || null;
    }
    
    if (ts.isPropertyAccessExpression(expression)) {
      if (ts.isIdentifier(expression.name)) {
        return expression.name.escapedText?.toString() || null;
      }
      if (sourceFile && expression.name) {
        return expression.name.getText(sourceFile) || null;
      }
    }
  } catch (error) {
    // Silently ignore
  }
  
  return null;
};

// Pure function to get containing function
const getContainingFunction = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  state: AnalyzerState
): FunctionInfo | null => {
  let current = node;
  while (current && current !== sourceFile) {
    if (ts.isFunctionDeclaration(current) || 
        ts.isMethodDeclaration(current) || 
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)) {
      
      const name = getFunctionName(current, sourceFile);
      if (name) {
        const startPos = sourceFile.getLineAndCharacterOfPosition(current.getStart(sourceFile));
        const relativePath = path.relative(state.rootDir, sourceFile.fileName);
        const functionId = `${relativePath}:${name}:${startPos.line + 1}`;
        return state.functions.get(functionId) || null;
      }
    }
    current = current.parent;
  }
  return null;
};

// Pure function to analyze calls
const analyzeCalls = (
  node: ts.Node,
  sourceFile: ts.SourceFile,
  state: AnalyzerState
): AnalyzerState => {
  let newState = state;
  const containingFunction = getContainingFunction(node, sourceFile, newState);
  
  if (ts.isCallExpression(node) && containingFunction) {
    const calledName = getCalledFunctionName(node, sourceFile);
    if (calledName) {
      const possibleTargets = newState.functionsByName.get(calledName) || [];
      
      for (const targetId of possibleTargets) {
        const targetFunc = newState.functions.get(targetId);
        if (!targetFunc) continue;
        
        const callLocation: FunctionLocation = {
          name: targetFunc.name,
          file: targetFunc.file,
          line: targetFunc.startLine
        };
        
        const exists = containingFunction.calls.some(c => 
          c.name === callLocation.name && 
          c.file === callLocation.file && 
          c.line === callLocation.line
        );
        
        if (!exists) {
          containingFunction.calls.push(callLocation);
        }
        
        const callerLocation: FunctionLocation = {
          name: containingFunction.name,
          file: containingFunction.file,
          line: containingFunction.startLine
        };
        
        const callerExists = targetFunc.calledBy.some(c => 
          c.name === callerLocation.name && 
          c.file === callerLocation.file && 
          c.line === callerLocation.line
        );
        
        if (!callerExists) {
          targetFunc.calledBy.push(callerLocation);
        }
      }
    }
  }

  try {
    ts.forEachChild(node, child => {
      try {
        newState = analyzeCalls(child, sourceFile, newState);
      } catch (error) {
        // Silently continue - some nodes may cause issues
      }
    });
  } catch (error) {
    // Silently continue if forEachChild fails
  }
  
  return newState;
};

// Pure function to build nested structure
const buildNestedStructure = (functions: Map<string, FunctionInfo>): NestedStructure => {
  const nested: NestedStructure = {};
  
  for (const func of Array.from(functions.values())) {
    const pathParts = func.path.split('/');
    let current = nested;
    
    // Navigate/create nested structure
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (part && !current[part]) {
        current[part] = {};
      }
      if (part && current[part]) {
        current = current[part] as NestedStructure;
      }
    }
    
    // Add function to the file array
    const fileName = pathParts[pathParts.length - 1];
    if (fileName) {
      if (!current[fileName]) {
        current[fileName] = [];
      }
      
      const functionDisplay: FunctionDisplay = {
        name: func.name,
        lines: `${func.startLine}-${func.endLine}`,
        parameters: func.parameters,
        callsCount: func.callsCount,
        calledByCount: func.calledByCount,
        calls: func.calls.slice(0, 5).map(c => `${c.name} (${c.file}:${c.line})`),
        calledBy: func.calledBy.slice(0, 5).map(c => `${c.name} (${c.file}:${c.line})`)
      };
      const fileArray = current[fileName] as FunctionDisplay[];
      if (fileArray) {
        fileArray.push(functionDisplay);
      }
    }
  }
  
  // Sort functions within each file by dependency count
  const sortFunctions = (obj: NestedStructure): void => {
    for (const key in obj) {
      if (Array.isArray(obj[key])) {
        (obj[key] as FunctionDisplay[]).sort((a: FunctionDisplay, b: FunctionDisplay) => b.callsCount - a.callsCount);
      } else if (typeof obj[key] === 'object') {
        sortFunctions(obj[key] as NestedStructure);
      }
    }
  };
  
  sortFunctions(nested);
  
  return nested;
};

// Pure function to build dependency tree
const buildDependencyTree = (functions: Map<string, FunctionInfo>): DependencyTree => {
  const tree: DependencyTree = {
    zeroDependencies: [],
    lowComplexity: [],     // 1-3 deps
    mediumComplexity: [],  // 4-9 deps
    highComplexity: [],    // 10-19 deps
    veryHighComplexity: [] // 20+ deps
  };
  
  for (const func of Array.from(functions.values())) {
    const entry: DependencyEntry = {
      name: func.name,
      file: func.file,
      lines: `${func.startLine}-${func.endLine}`,
      parameters: func.parameters,
      callsCount: func.callsCount,
      calledByCount: func.calledByCount,
      calls: func.calls.map(c => ({
        name: c.name,
        location: `${c.file}:${c.line}`
      })),
      calledBy: func.calledBy.map(c => ({
        name: c.name,
        location: `${c.file}:${c.line}`
      }))
    };
    
    if (func.callsCount === 0) {
      tree.zeroDependencies.push(entry);
    } else if (func.callsCount <= 3) {
      tree.lowComplexity.push(entry);
    } else if (func.callsCount <= 9) {
      tree.mediumComplexity.push(entry);
    } else if (func.callsCount <= 19) {
      tree.highComplexity.push(entry);
    } else {
      tree.veryHighComplexity.push(entry);
    }
  }
  
  // Sort each category by callsCount
  for (const category of Object.values(tree)) {
    if (Array.isArray(category)) {
      category.sort((a: DependencyEntry, b: DependencyEntry) => b.callsCount - a.callsCount);
    }
  }
  
  return tree;
};

// Pure function to get stats by folder
const getStatsByFolder = (functions: Map<string, FunctionInfo>): FolderStatsMap => {
  const stats: FolderStatsMap = {};
  
  for (const func of Array.from(functions.values())) {
    if (!stats[func.folder]) {
      const folderStat: FolderStatistics = {
        totalFunctions: 0,
        totalLines: 0,
        avgDependencies: 0,
        maxDependencies: 0,
        zeroDepsCount: 0,
        highComplexityFunctions: []
      };
      stats[func.folder] = folderStat;
    }
    
    const folderStats = stats[func.folder];
    if (!folderStats) continue;
    folderStats.totalFunctions++;
    folderStats.totalLines += (func.endLine - func.startLine + 1);
    
    if (func.callsCount === 0) {
      folderStats.zeroDepsCount++;
    }
    
    if (func.callsCount > folderStats.maxDependencies) {
      folderStats.maxDependencies = func.callsCount;
    }
    
    if (func.callsCount >= 10) {
      const highComplexFunc: HighComplexityFunction = {
        name: func.name,
        file: func.file,
        lines: `${func.startLine}-${func.endLine}`,
        deps: func.callsCount
      };
      folderStats.highComplexityFunctions.push(highComplexFunc);
    }
  }
  
  // Calculate averages
  for (const folder in stats) {
    const folderStats = stats[folder];
    const totalDeps = Array.from(functions.values())
      .filter(f => f.folder === folder)
      .reduce((sum, f) => sum + f.callsCount, 0);
    
    if (folderStats) {
      folderStats.avgDependencies = Math.round((totalDeps / folderStats.totalFunctions) * 100) / 100;
      folderStats.avgLinesPerFunction = Math.round((folderStats.totalLines / folderStats.totalFunctions) * 100) / 100;
    }
    
    // Sort high complexity functions
    if (folderStats) {
      folderStats.highComplexityFunctions.sort((a: HighComplexityFunction, b: HighComplexityFunction) => b.deps - a.deps);
    }
  }
  
  return stats;
};

// Pure function to get output
const getOutput = (state: AnalyzerState): FunctionAnalysisResult => {
  const allFunctions = Array.from(state.functions.values());
  
  const detailedFunctions = allFunctions.map(f => ({
    name: f.name,
    file: f.file,
    path: f.path,
    folder: f.folder,
    startLine: f.startLine,
    endLine: f.endLine,
    kind: f.kind,
    parameters: f.parameters,
    callsCount: f.callsCount,
    calledByCount: f.calledByCount,
    calls: f.calls.map(c => ({
      name: c.name,
      file: c.file,
      line: c.line
    })),
    calledBy: f.calledBy.map(c => ({
      name: c.name,
      file: c.file,
      line: c.line
    }))
  }));
  
  return {
    metadata: {
      analyzedAt: new Date().toISOString(),
      targetDirectory: state.rootDir,
      totalFunctions: allFunctions.length,
      totalFolders: new Set(allFunctions.map(f => f.folder)).size,
      avgDependencies: Math.round((allFunctions.reduce((sum, f) => sum + f.callsCount, 0) / allFunctions.length) * 100) / 100
    },
    summary: {
      totalFunctions: allFunctions.length,
      zeroDependencies: allFunctions.filter(f => f.callsCount === 0).length,
      lowComplexity: allFunctions.filter(f => f.callsCount >= 1 && f.callsCount <= 3).length,
      mediumComplexity: allFunctions.filter(f => f.callsCount >= 4 && f.callsCount <= 9).length,
      highComplexity: allFunctions.filter(f => f.callsCount >= 10 && f.callsCount <= 19).length,
      veryHighComplexity: allFunctions.filter(f => f.callsCount >= 20).length
    },
    functions: detailedFunctions,
    byPath: buildNestedStructure(state.functions),
    dependencyTree: buildDependencyTree(state.functions),
    folderStats: getStatsByFolder(state.functions),
    topComplexFunctions: allFunctions
      .sort((a, b) => b.callsCount - a.callsCount)
      .slice(0, 30)
      .map(f => ({
        name: f.name,
        file: f.file,
        lines: `${f.startLine}-${f.endLine}`,
        callsCount: f.callsCount,
        calledByCount: f.calledByCount,
        calls: f.calls.slice(0, 10).map(c => `${c.name} (${c.file}:${c.line})`),
        calledBy: f.calledBy.slice(0, 10).map(c => `${c.name} (${c.file}:${c.line})`)
      }))
  };
};

// Main pure function to analyze functions
export const analyzeFunctions = async (rootDir: string): Promise<{ result: FunctionAnalysisResult; logs: string[] }> => {
  let state = createInitialState(rootDir);
  
  try {
    state = addLog(state, `🔍 Analyzing TypeScript functions in: ${rootDir}`);
    
    // Find all TypeScript files
    const files = findTypeScriptFiles(rootDir);
    state = addLog(state, `📁 Found ${files.length} TypeScript files to analyze`);
    
    // Create TypeScript program
    const program = createProgram(files);
    state = { ...state, program };
    
    // First pass: collect all functions
    state = addLog(state, '🔨 Pass 1: Collecting all functions...');
    for (const sourceFile of program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (!sourceFile.fileName.includes(rootDir)) continue;
      
      try {
        state = visitNode(sourceFile, sourceFile, state);
      } catch (error) {
        state = addLog(state, `⚠️ Error analyzing ${sourceFile.fileName}: ${error.message}`);
        // Continue with next file instead of failing entirely
      }
    }
  
  state = addLog(state, `✅ Found ${state.functions.size} functions`);
  state = addLog(state, '🔨 Pass 2: Analyzing function calls and dependencies...');
  
  // Second pass: analyze function calls
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    if (!sourceFile.fileName.includes(rootDir)) continue;
    
    state = analyzeCalls(sourceFile, sourceFile, state);
  }
  
  // Update counts
  const updatedFunctions = new Map(state.functions);
  for (const func of updatedFunctions.values()) {
    func.callsCount = func.calls.length;
    func.calledByCount = func.calledBy.length;
  }
  state = { ...state, functions: updatedFunctions };
  
  state = addLog(state, '✅ Analysis complete!');
  
    return {
      result: getOutput(state),
      logs: state.logs
    };
  } catch (error) {
    state = addLog(state, `❌ Critical error during analysis: ${error.message}`);
    
    // Return minimal result even on error
    return {
      result: {
        metadata: {
          analyzedAt: new Date().toISOString(),
          targetDirectory: rootDir,
          totalFunctions: 0,
          totalFolders: 0,
          avgDependencies: 0
        },
        summary: {
          totalFunctions: 0,
          zeroDependencies: 0,
          lowComplexity: 0,
          mediumComplexity: 0,
          highComplexity: 0,
          veryHighComplexity: 0
        },
        functions: [],
        byPath: {},
        dependencyTree: {
          zeroDependencies: [],
          lowComplexity: [],
          mediumComplexity: [],
          highComplexity: [],
          veryHighComplexity: []
        },
        folderStats: {},
        topComplexFunctions: []
      },
      logs: state.logs
    };
  }
};