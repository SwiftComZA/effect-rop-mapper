#!/usr/bin/env node
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

/**
 * Purpose: Complete function AST analysis with full dependency mapping
 * Dependencies: TypeScript compiler API, glob
 * 
 * Example Input:
 * ```
 * npm run analyze /path/to/target/directory
 * ANALYSIS_TARGET_DIR=/path/to/target npm run analyze
 * ```
 * 
 * Expected Output:
 * ```
 * { "functions": [...], "byPath": {...}, "dependencyTree": {...} }
 * ```
 */

interface FunctionLocation {
  name: string;
  file: string;
  line: number;
}

interface FunctionInfo {
  name: string;
  file: string;
  path: string;
  folder: string;
  startLine: number;
  endLine: number;
  kind: string;
  parameters: string[];
  // Enhanced dependency tracking with full details
  calls: FunctionLocation[]; // Functions this function calls
  calledBy: FunctionLocation[]; // Functions that call this function
  callsCount: number;
  calledByCount: number;
}

interface NestedStructure {
  [key: string]: NestedStructure | FunctionInfo[];
}

class FunctionAnalyzer {
  private functions: Map<string, FunctionInfo> = new Map();
  private functionsByName: Map<string, string[]> = new Map(); // name -> [functionIds]
  private program: ts.Program;
  private checker: ts.TypeChecker;

  constructor(private rootDir: string) {
    console.error(`\n🔍 Analyzing TypeScript functions in: ${rootDir}\n`);
    
    // Find all TypeScript files
    const files = glob.sync('**/*.ts', {
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

    console.error(`📁 Found ${files.length} TypeScript files to analyze`);

    // Create TypeScript program
    this.program = ts.createProgram(files, {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      allowJs: false,
      skipLibCheck: true,
      noEmit: true
    });

    this.checker = this.program.getTypeChecker();
  }

  analyze(): void {
    console.error('🔨 Pass 1: Collecting all functions...');
    
    // First pass: collect all functions
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (!sourceFile.fileName.includes(this.rootDir)) continue;
      
      this.visitNode(sourceFile, sourceFile);
    }

    console.error(`✅ Found ${this.functions.size} functions`);
    console.error('🔨 Pass 2: Analyzing function calls and dependencies...');

    // Second pass: analyze function calls
    for (const sourceFile of this.program.getSourceFiles()) {
      if (sourceFile.isDeclarationFile) continue;
      if (!sourceFile.fileName.includes(this.rootDir)) continue;
      
      this.analyzeCalls(sourceFile, sourceFile);
    }

    // Update counts
    for (const func of this.functions.values()) {
      func.callsCount = func.calls.length;
      func.calledByCount = func.calledBy.length;
    }

    console.error('✅ Analysis complete!\n');
  }

  private visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Check if node is a function
    if (ts.isFunctionDeclaration(node) || 
        ts.isMethodDeclaration(node) || 
        ts.isArrowFunction(node) ||
        ts.isFunctionExpression(node)) {
      
      const name = this.getFunctionName(node);
      if (!name) return;

      const startPos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const endPos = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      
      const relativePath = path.relative(this.rootDir, sourceFile.fileName);
      const pathParts = relativePath.split(path.sep);
      const folder = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : '.';
      const functionId = `${relativePath}:${name}:${startPos.line + 1}`;

      const funcInfo: FunctionInfo = {
        name,
        file: relativePath,
        path: relativePath,
        folder,
        startLine: startPos.line + 1,
        endLine: endPos.line + 1,
        kind: ts.SyntaxKind[node.kind],
        parameters: this.getParameters(node),
        calls: [],
        calledBy: [],
        callsCount: 0,
        calledByCount: 0
      };

      this.functions.set(functionId, funcInfo);
      
      // Track function by name for lookup
      if (!this.functionsByName.has(name)) {
        this.functionsByName.set(name, []);
      }
      this.functionsByName.get(name)!.push(functionId);
    }

    // Continue traversing
    ts.forEachChild(node, child => this.visitNode(child, sourceFile));
  }

  private analyzeCalls(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Find the containing function
    const containingFunction = this.getContainingFunction(node, sourceFile);
    
    if (ts.isCallExpression(node) && containingFunction) {
      const calledName = this.getCalledFunctionName(node);
      if (calledName) {
        // Find all functions with this name
        const possibleTargets = this.functionsByName.get(calledName) || [];
        
        for (const targetId of possibleTargets) {
          const targetFunc = this.functions.get(targetId);
          if (!targetFunc) continue;
          
          // Add to containing function's calls
          const callLocation: FunctionLocation = {
            name: targetFunc.name,
            file: targetFunc.file,
            line: targetFunc.startLine
          };
          
          // Check if not already added
          const exists = containingFunction.calls.some(c => 
            c.name === callLocation.name && 
            c.file === callLocation.file && 
            c.line === callLocation.line
          );
          
          if (!exists) {
            containingFunction.calls.push(callLocation);
          }
          
          // Add to target function's calledBy
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

    ts.forEachChild(node, child => this.analyzeCalls(child, sourceFile));
  }

  private getContainingFunction(node: ts.Node, sourceFile: ts.SourceFile): FunctionInfo | null {
    let current = node;
    while (current && current !== sourceFile) {
      if (ts.isFunctionDeclaration(current) || 
          ts.isMethodDeclaration(current) || 
          ts.isArrowFunction(current) ||
          ts.isFunctionExpression(current)) {
        
        const name = this.getFunctionName(current);
        if (name) {
          const startPos = sourceFile.getLineAndCharacterOfPosition(current.getStart());
          const relativePath = path.relative(this.rootDir, sourceFile.fileName);
          const functionId = `${relativePath}:${name}:${startPos.line + 1}`;
          return this.functions.get(functionId) || null;
        }
      }
      current = current.parent;
    }
    return null;
  }

  private getFunctionName(node: ts.Node): string | null {
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      return node.name?.getText() || null;
    }
    
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      const parent = node.parent;
      if (ts.isVariableDeclaration(parent)) {
        return parent.name.getText();
      }
      if (ts.isPropertyAssignment(parent)) {
        return parent.name.getText();
      }
    }
    
    return null;
  }

  private getCalledFunctionName(node: ts.CallExpression): string | null {
    const expression = node.expression;
    
    if (ts.isIdentifier(expression)) {
      return expression.text;
    }
    
    if (ts.isPropertyAccessExpression(expression)) {
      return expression.name.text;
    }
    
    return null;
  }

  private getParameters(node: ts.Node): string[] {
    const params: string[] = [];
    
    if ('parameters' in node && Array.isArray(node.parameters)) {
      for (const param of node.parameters) {
        if (ts.isParameter(param)) {
          params.push(param.name?.getText() || 'unknown');
        }
      }
    }
    
    return params;
  }

  buildNestedStructure(): any {
    const nested: any = {};
    
    for (const func of this.functions.values()) {
      const pathParts = func.path.split('/');
      let current = nested;
      
      // Navigate/create nested structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }
      
      // Add function to the file array
      const fileName = pathParts[pathParts.length - 1];
      if (!current[fileName]) {
        current[fileName] = [];
      }
      
      current[fileName].push({
        name: func.name,
        lines: `${func.startLine}-${func.endLine}`,
        parameters: func.parameters,
        callsCount: func.callsCount,
        calledByCount: func.calledByCount,
        calls: func.calls.slice(0, 5).map(c => `${c.name} (${c.file}:${c.line})`),
        calledBy: func.calledBy.slice(0, 5).map(c => `${c.name} (${c.file}:${c.line})`)
      });
    }
    
    // Sort functions within each file by dependency count
    const sortFunctions = (obj: any): void => {
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          obj[key].sort((a: any, b: any) => b.callsCount - a.callsCount);
        } else if (typeof obj[key] === 'object') {
          sortFunctions(obj[key]);
        }
      }
    };
    
    sortFunctions(nested);
    
    return nested;
  }

  buildDependencyTree(): any {
    const tree: any = {
      zeroDependencies: [],
      lowComplexity: [],     // 1-3 deps
      mediumComplexity: [],  // 4-9 deps
      highComplexity: [],    // 10-19 deps
      veryHighComplexity: [] // 20+ deps
    };
    
    for (const func of this.functions.values()) {
      const entry = {
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
        category.sort((a: any, b: any) => b.callsCount - a.callsCount);
      }
    }
    
    return tree;
  }

  getStatsByFolder(): any {
    const stats: any = {};
    
    for (const func of this.functions.values()) {
      if (!stats[func.folder]) {
        stats[func.folder] = {
          totalFunctions: 0,
          totalLines: 0,
          avgDependencies: 0,
          maxDependencies: 0,
          zeroDepsCount: 0,
          highComplexityFunctions: [] // Functions with 10+ deps
        };
      }
      
      const folderStats = stats[func.folder];
      folderStats.totalFunctions++;
      folderStats.totalLines += (func.endLine - func.startLine + 1);
      
      if (func.callsCount === 0) {
        folderStats.zeroDepsCount++;
      }
      
      if (func.callsCount > folderStats.maxDependencies) {
        folderStats.maxDependencies = func.callsCount;
      }
      
      if (func.callsCount >= 10) {
        folderStats.highComplexityFunctions.push({
          name: func.name,
          file: func.file,
          lines: `${func.startLine}-${func.endLine}`,
          deps: func.callsCount
        });
      }
    }
    
    // Calculate averages
    for (const folder in stats) {
      const folderStats = stats[folder];
      const totalDeps = Array.from(this.functions.values())
        .filter(f => f.folder === folder)
        .reduce((sum, f) => sum + f.callsCount, 0);
      
      folderStats.avgDependencies = Math.round((totalDeps / folderStats.totalFunctions) * 100) / 100;
      folderStats.avgLinesPerFunction = Math.round((folderStats.totalLines / folderStats.totalFunctions) * 100) / 100;
      
      // Sort high complexity functions
      folderStats.highComplexityFunctions.sort((a: any, b: any) => b.deps - a.deps);
    }
    
    return stats;
  }

  getOutput(): any {
    const allFunctions = Array.from(this.functions.values());
    
    // Create detailed function list with full dependency info
    const detailedFunctions = allFunctions.map(f => ({
      name: f.name,
      file: f.file,
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
        targetDirectory: this.rootDir,
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
      byPath: this.buildNestedStructure(),
      dependencyTree: this.buildDependencyTree(),
      folderStats: this.getStatsByFolder(),
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
  }
}

// Get target directory from command line or environment variable
const targetDir = process.argv[2] || process.env.ANALYSIS_TARGET_DIR || './src';
const resolvedDir = path.resolve(targetDir);

if (!fs.existsSync(resolvedDir)) {
  console.error(`❌ Error: Target directory does not exist: ${resolvedDir}`);
  process.exit(1);
}

// Run the analyzer
const analyzer = new FunctionAnalyzer(resolvedDir);
analyzer.analyze();

const output = analyzer.getOutput();

// Create output directory if it doesn't exist
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const outputDir = path.join(scriptDir, 'output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a safe filename based on the target directory
const targetName = path.basename(resolvedDir) || 'root';
const targetParent = path.basename(path.dirname(resolvedDir));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const outputFile = path.join(outputDir, `function-analysis-${targetParent}-${targetName}-${timestamp}.json`);
const latestFile = path.join(outputDir, `function-analysis-latest.json`);

// Write output to timestamped file and latest file
fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
fs.writeFileSync(latestFile, JSON.stringify(output, null, 2));

console.error(`\n📊 Analysis complete!`);
console.error(`📁 Output saved to:`);
console.error(`   ${outputFile}`);
console.error(`   ${latestFile}`);
console.error(`\nSummary:`);
console.error(`  Total functions: ${output.summary.totalFunctions}`);
console.error(`  Zero dependencies: ${output.summary.zeroDependencies}`);
console.error(`  Low complexity (1-3): ${output.summary.lowComplexity}`);
console.error(`  Medium complexity (4-9): ${output.summary.mediumComplexity}`);
console.error(`  High complexity (10-19): ${output.summary.highComplexity}`);
console.error(`  Very high complexity (20+): ${output.summary.veryHighComplexity}\n`);

// Also output to stdout for piping
console.log(JSON.stringify(output, null, 2));