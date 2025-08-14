/**
 * Purpose: AST analyzer to crawl TypeScript files and extract Effect TS patterns
 * Dependencies: TypeScript Compiler API
 * 
 * Example Input:
 * ```
 * analyzePath("../backend/src")
 * ```
 * 
 * Expected Output:
 * ```
 * EffectRailway with nodes and edges representing the complete Effect flow
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import type { 
  EffectNode, 
  EffectEdge, 
  EffectRailway, 
  NodeType, 
  EdgeType, 
  EffectSignature,
  AnalysisResult,
  LayerMap
} from '../types/effect-node.js';

export class EffectASTAnalyzer {
  private nodes: Map<string, EffectNode> = new Map();
  private edges: Set<EffectEdge> = new Set();
  private nodeCounter = 0;

  async analyzePath(rootPath: string): Promise<AnalysisResult> {
    this.nodes.clear();
    this.edges.clear();
    this.nodeCounter = 0;

    const tsFiles = this.findTypeScriptFiles(rootPath);
    
    for (const filePath of tsFiles) {
      await this.analyzeFile(filePath);
    }

    const railway = this.buildRailway();
    const statistics = this.calculateStatistics(railway);

    return { railway, statistics };
  }

  private findTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    
    const traverse = (currentDir: string) => {
      if (!fs.existsSync(currentDir)) return;
      
      const entries = fs.readdirSync(currentDir);
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !entry.includes('node_modules') && !entry.includes('.git')) {
          traverse(fullPath);
        } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    };
    
    traverse(dir);
    return files;
  }

  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true
      );

      this.visitNode(sourceFile, filePath);
    } catch (error) {
      console.warn(`Failed to analyze file ${filePath}:`, error);
    }
  }

  private visitNode(node: ts.Node, filePath: string): void {
    // Look for Effect imports
    if (ts.isImportDeclaration(node)) {
      this.analyzeImport(node, filePath);
    }

    // Look for Effect.gen patterns
    if (ts.isCallExpression(node)) {
      this.analyzeEffectGen(node, filePath);
    }

    // Look for Context.Tag patterns (services)
    if (ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) {
      this.analyzeContextTag(node, filePath);
    }

    // Look for error definitions
    if (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) {
      this.analyzeErrorTypes(node, filePath);
    }

    // Look for repository patterns
    if (ts.isObjectLiteralExpression(node) || ts.isVariableDeclaration(node)) {
      this.analyzeRepository(node, filePath);
    }

    // Look for route handlers
    if (ts.isCallExpression(node)) {
      this.analyzeRouteHandler(node, filePath);
    }

    // Continue traversing
    ts.forEachChild(node, child => this.visitNode(child, filePath));
  }

  private analyzeImport(node: ts.ImportDeclaration, filePath: string): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (ts.isStringLiteral(moduleSpecifier)) {
      const moduleName = moduleSpecifier.text;
      
      // Track Effect imports
      if (moduleName === 'effect' || moduleName.startsWith('@effect/') || moduleName.includes('effect')) {
        // This file uses Effect - we'll track it
      }
    }
  }

  private analyzeEffectGen(node: ts.CallExpression, filePath: string): void {
    const expression = node.expression;
    
    // Look for Effect.gen patterns
    if (ts.isPropertyAccessExpression(expression) && 
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'Effect' &&
        expression.name.text === 'gen') {
      
      const nodeId = this.generateNodeId();
      const nodeType = this.determineNodeType(filePath);
      const line = this.getLineNumber(node, filePath);
      
      // Enhanced name extraction - check if we're inside a route handler
      const routeInfo = this.findParentRouteHandler(node);
      let nodeName = this.extractFunctionName(node, filePath);
      let description = `Effect generator function`;
      
      if (routeInfo) {
        nodeName = `${routeInfo.method} ${routeInfo.path}`;
        description = `HTTP ${routeInfo.method} endpoint${routeInfo.pathParams.length > 0 ? ` with params: ${routeInfo.pathParams.join(', ')}` : ''}`;
      }
      
      const effectNode: EffectNode = {
        id: nodeId,
        name: nodeName,
        type: nodeType,
        filePath,
        line,
        effectSignature: this.analyzeEffectSignature(node),
        description
      };

      this.nodes.set(nodeId, effectNode);
      this.analyzeEffectGenBody(node, nodeId, filePath);
    }
  }

  private analyzeEffectGenBody(node: ts.CallExpression, parentNodeId: string, filePath: string): void {
    // Look for yield* patterns to find dependencies and error handling
    const callback = node.arguments[0];
    if (callback && (ts.isFunctionExpression(callback) || ts.isArrowFunction(callback))) {
      if (callback.body) {
        this.analyzeYieldPatterns(callback.body, parentNodeId, filePath);
      }
    }
  }

  private analyzeYieldPatterns(body: ts.ConciseBody, parentNodeId: string, filePath: string): void {
    const dependencies = new Set<string>();
    const errorTypes = new Set<string>();
    
    const visitYields = (node: ts.Node) => {
      // Look for yield* patterns (dependencies)
      if (ts.isYieldExpression(node) && node.asteriskToken && node.expression) {
        const dependency = this.extractDependency(node.expression);
        if (dependency) {
          dependencies.add(dependency);
          this.createDependencyEdge(parentNodeId, dependency, filePath);
        }
      }

      // Look for Effect.fail patterns (error types)
      if (ts.isCallExpression(node)) {
        const expression = node.expression;
        if (ts.isPropertyAccessExpression(expression) &&
            ts.isIdentifier(expression.expression) &&
            expression.expression.text === 'Effect' &&
            expression.name.text === 'fail') {
          
          const errorType = this.extractErrorType(node);
          if (errorType) {
            errorTypes.add(errorType);
            this.createErrorEdge(parentNodeId, errorType, filePath);
          }
        }
      }
      
      // Look for direct service calls like QueueService, TopicsRepository
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const serviceName = node.expression.text;
        if (serviceName.endsWith('Service') || serviceName.endsWith('Repository')) {
          dependencies.add(serviceName);
          this.createDependencyEdge(parentNodeId, serviceName, filePath);
        }
      }

      ts.forEachChild(node, visitYields);
    };

    visitYields(body);
    
    // Update the parent node's Effect signature with discovered dependencies and errors
    const parentNode = this.nodes.get(parentNodeId);
    if (parentNode && parentNode.effectSignature) {
      parentNode.effectSignature.dependencies = Array.from(dependencies);
      parentNode.effectSignature.error = Array.from(errorTypes);
    }
  }

  private analyzeContextTag(node: ts.VariableDeclaration | ts.PropertyAssignment, filePath: string): void {
    // Look for Context.GenericTag or Context.Tag patterns
    let initializer: ts.Expression | undefined;
    let name: string | undefined;

    if (ts.isVariableDeclaration(node)) {
      initializer = node.initializer;
      if (ts.isIdentifier(node.name)) {
        name = node.name.text;
      }
    } else if (ts.isPropertyAssignment(node)) {
      initializer = node.initializer;
      if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) {
        name = ts.isIdentifier(node.name) ? node.name.text : node.name.text;
      }
    }

    if (initializer && ts.isCallExpression(initializer)) {
      const expression = initializer.expression;
      if (ts.isPropertyAccessExpression(expression) &&
          ts.isIdentifier(expression.expression) &&
          expression.expression.text === 'Context' &&
          (expression.name.text === 'GenericTag' || expression.name.text === 'Tag')) {
        
        const nodeId = this.generateNodeId();
        const line = this.getLineNumber(node, filePath);
        
        const serviceNode: EffectNode = {
          id: nodeId,
          name: name || 'UnknownService',
          type: 'service',
          filePath,
          line,
          description: `Service defined with Context.${expression.name.text}`
        };

        this.nodes.set(nodeId, serviceNode);
      }
    }
  }

  private analyzeErrorTypes(node: ts.ClassDeclaration | ts.InterfaceDeclaration, filePath: string): void {
    if (node.name && ts.isIdentifier(node.name)) {
      const name = node.name.text;
      if (name.includes('Error') || name.includes('Exception')) {
        const nodeId = this.generateNodeId();
        const line = this.getLineNumber(node, filePath);
        
        const errorNode: EffectNode = {
          id: nodeId,
          name,
          type: 'error',
          filePath,
          line,
          description: `Error type definition`
        };

        this.nodes.set(nodeId, errorNode);
      }
    }
  }

  private analyzeRepository(node: ts.ObjectLiteralExpression | ts.VariableDeclaration, filePath: string): void {
    // Look for repository patterns (objects with CRUD operations)
    let name: string | undefined;
    let isRepository = false;

    if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      if (ts.isIdentifier(node.name)) {
        name = node.name.text;
        isRepository = name.includes('Repository') || this.hasRepositoryMethods(node.initializer);
      }
    } else if (ts.isObjectLiteralExpression(node)) {
      isRepository = this.hasRepositoryMethods(node);
    }

    if (isRepository && name) {
      const nodeId = this.generateNodeId();
      const line = this.getLineNumber(node, filePath);
      
      const repoNode: EffectNode = {
        id: nodeId,
        name,
        type: 'repository',
        filePath,
        line,
        description: `Repository with CRUD operations`
      };

      this.nodes.set(nodeId, repoNode);
    }
  }

  private analyzeRouteHandler(node: ts.CallExpression, filePath: string): void {
    const expression = node.expression;
    
    // Look for router.get, router.post, etc.
    if (ts.isPropertyAccessExpression(expression) && 
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'router' &&
        ['get', 'post', 'put', 'delete', 'patch'].includes(expression.name.text)) {
      
      const method = expression.name.text.toUpperCase();
      const pathArg = node.arguments[0];
      let path = '/unknown';
      
      if (pathArg && ts.isStringLiteral(pathArg)) {
        path = pathArg.text;
      }

      const nodeId = this.generateNodeId();
      const line = this.getLineNumber(node, filePath);
      
      const routeNode: EffectNode = {
        id: nodeId,
        name: `${method} ${path}`,
        type: 'controller',
        filePath,
        line,
        description: `HTTP ${method} endpoint`
      };

      this.nodes.set(nodeId, routeNode);
    }
  }

  private hasRepositoryMethods(obj: ts.ObjectLiteralExpression): boolean {
    const methodNames = ['create', 'findById', 'update', 'delete', 'list', 'count'];
    const propNames = obj.properties
      .filter(prop => ts.isPropertyAssignment(prop) || ts.isMethodDeclaration(prop))
      .map(prop => {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          return prop.name.text;
        }
        if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name)) {
          return prop.name.text;
        }
        return '';
      })
      .filter(Boolean);

    return methodNames.some(method => propNames.includes(method));
  }

  private extractDependency(expression: ts.Expression): string | null {
    // Handle direct identifiers like QueueService, TopicsRepository
    if (ts.isIdentifier(expression)) {
      const name = expression.text;
      // Only track service/repository dependencies
      if (name.endsWith('Service') || name.endsWith('Repository') || name.endsWith('Config')) {
        return name;
      }
    }
    
    // Handle property access like service.method()
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
      const serviceName = expression.expression.text;
      if (serviceName.endsWith('Service') || serviceName.endsWith('Repository') || serviceName.endsWith('Config')) {
        return serviceName;
      }
    }
    
    // Handle call expressions like TopicsRepository.getByVersion()
    if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
      const serviceName = this.extractServiceName(expression.expression);
      if (serviceName) {
        return serviceName;
      }
    }
    
    return null;
  }
  
  private extractServiceName(expression: ts.PropertyAccessExpression): string | null {
    if (ts.isIdentifier(expression.expression)) {
      const name = expression.expression.text;
      if (name.endsWith('Service') || name.endsWith('Repository') || name.endsWith('Config')) {
        return name;
      }
    }
    return null;
  }

  private extractErrorType(node: ts.CallExpression): string | null {
    const arg = node.arguments[0];
    if (arg && ts.isNewExpression(arg) && ts.isIdentifier(arg.expression)) {
      return arg.expression.text;
    }
    return null;
  }

  private analyzeEffectSignature(node: ts.CallExpression): EffectSignature | undefined {
    // Extract the function body to analyze return types, errors, and dependencies
    const callback = node.arguments[0];
    if (callback && (ts.isFunctionExpression(callback) || ts.isArrowFunction(callback))) {
      const returnType = this.extractReturnType(callback);
      
      return {
        success: returnType || 'unknown',
        error: [], // Will be filled by analyzeYieldPatterns
        dependencies: [] // Will be filled by analyzeYieldPatterns
      };
    }
    
    return {
      success: 'unknown',
      error: [],
      dependencies: []
    };
  }
  
  private extractReturnType(callback: ts.FunctionExpression | ts.ArrowFunction): string | null {
    if (!callback.body) return null;
    
    // Look for return statements or expressions that indicate the success type
    const returnAnalyzer = (node: ts.Node): string | null => {
      // Look for return statements
      if (ts.isReturnStatement(node) && node.expression) {
        return this.analyzeReturnExpression(node.expression);
      }
      
      // For arrow functions with expression bodies
      if (node === callback.body && ts.isExpression(node)) {
        return this.analyzeReturnExpression(node);
      }
      
      // Continue searching in child nodes
      let result: string | null = null;
      ts.forEachChild(node, child => {
        if (!result) {
          result = returnAnalyzer(child);
        }
      });
      
      return result;
    };
    
    return returnAnalyzer(callback.body) || 'unknown';
  }
  
  private analyzeReturnExpression(expression: ts.Expression): string {
    // Look for object literals to determine structure
    if (ts.isObjectLiteralExpression(expression)) {
      const properties = expression.properties
        .filter(prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name))
        .map(prop => (prop as ts.PropertyAssignment).name?.getText())
        .filter(Boolean);
      
      if (properties.length > 0) {
        return `{ ${properties.join(', ')} }`;
      }
    }
    
    // Look for array expressions
    if (ts.isArrayLiteralExpression(expression)) {
      return 'Array<unknown>';
    }
    
    // Look for string literals
    if (ts.isStringLiteral(expression)) {
      return 'string';
    }
    
    // Look for numeric literals
    if (ts.isNumericLiteral(expression)) {
      return 'number';
    }
    
    // Look for boolean literals
    if (expression.kind === ts.SyntaxKind.TrueKeyword || expression.kind === ts.SyntaxKind.FalseKeyword) {
      return 'boolean';
    }
    
    return 'unknown';
  }

  private createDependencyEdge(sourceId: string, targetName: string, filePath: string): void {
    // Find target node by name
    const targetNode = Array.from(this.nodes.values()).find(node => 
      node.name === targetName || node.name.includes(targetName)
    );
    
    if (targetNode) {
      const edge: EffectEdge = {
        id: `dep-${sourceId}-${targetNode.id}`,
        source: sourceId,
        target: targetNode.id,
        type: 'dependency',
        label: `requires ${targetName}`
      };
      
      this.edges.add(edge);
    }
  }

  private createErrorEdge(sourceId: string, errorType: string, filePath: string): void {
    // Find or create error node
    let errorNode = Array.from(this.nodes.values()).find(node => 
      node.type === 'error' && node.name === errorType
    );
    
    if (!errorNode) {
      const nodeId = this.generateNodeId();
      errorNode = {
        id: nodeId,
        name: errorType,
        type: 'error',
        filePath,
        line: 0,
        description: `Error type: ${errorType}`
      };
      this.nodes.set(nodeId, errorNode);
    }
    
    const edge: EffectEdge = {
      id: `err-${sourceId}-${errorNode.id}`,
      source: sourceId,
      target: errorNode.id,
      type: 'error',
      errorType,
      label: `may fail with ${errorType}`
    };
    
    this.edges.add(edge);
  }

  private determineNodeType(filePath: string): NodeType {
    const normalizedPath = filePath.toLowerCase();
    
    if (normalizedPath.includes('/routes/') || normalizedPath.includes('/controllers/')) {
      return 'controller';
    }
    if (normalizedPath.includes('/services/')) {
      return 'service';
    }
    if (normalizedPath.includes('/repositories/')) {
      return 'repository';
    }
    if (normalizedPath.includes('/middleware/')) {
      return 'middleware';
    }
    if (normalizedPath.includes('/workers/')) {
      return 'worker';
    }
    if (normalizedPath.includes('/utils/') || normalizedPath.includes('/utilities/')) {
      return 'utility';
    }
    
    return 'utility';
  }

  private findParentRouteHandler(node: ts.CallExpression): { method: string, path: string, pathParams: string[] } | null {
    // Walk up the AST to find if we're inside a router.get/post/etc. call
    let parent = node.parent;
    while (parent) {
      if (ts.isCallExpression(parent)) {
        const expression = parent.expression;
        if (ts.isPropertyAccessExpression(expression) && 
            ts.isIdentifier(expression.expression) &&
            expression.expression.text === 'router' &&
            ['get', 'post', 'put', 'delete', 'patch'].includes(expression.name.text)) {
          
          const method = expression.name.text.toUpperCase();
          const pathArg = parent.arguments[0];
          let path = '/unknown';
          let pathParams: string[] = [];
          
          if (pathArg && ts.isStringLiteral(pathArg)) {
            path = pathArg.text;
            // Extract path parameters like :id, :userId
            pathParams = path.match(/:([a-zA-Z0-9_]+)/g)?.map(param => param.substring(1)) || [];
          }
          
          return { method, path, pathParams };
        }
      }
      parent = parent.parent;
    }
    return null;
  }

  private extractFunctionName(node: ts.CallExpression, filePath: string): string {
    // Try to find the function/variable name this Effect.gen is assigned to
    let parent = node.parent;
    while (parent) {
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isMethodDeclaration(parent) && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      if (ts.isFunctionDeclaration(parent) && parent.name && ts.isIdentifier(parent.name)) {
        return parent.name.text;
      }
      parent = parent.parent;
    }
    
    return path.basename(filePath, '.ts');
  }

  private getLineNumber(node: ts.Node, filePath: string): number {
    try {
      const sourceCode = fs.readFileSync(filePath, 'utf-8');
      const sourceFile = ts.createSourceFile(filePath, sourceCode, ts.ScriptTarget.Latest, true);
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      return line + 1;
    } catch {
      return 0;
    }
  }

  private generateNodeId(): string {
    return `node-${++this.nodeCounter}`;
  }

  private buildRailway(): EffectRailway {
    const layers: LayerMap = {
      controllers: [],
      services: [],
      repositories: [],
      middleware: [],
      utilities: [],
      workers: [],
      errors: []
    };

    const entryPoints: string[] = [];

    for (const [id, node] of this.nodes) {
      layers[node.type + 's' as keyof LayerMap]?.push(id);
      
      if (node.type === 'controller') {
        entryPoints.push(id);
      }
    }

    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges),
      layers,
      entryPoints
    };
  }

  private calculateStatistics(railway: EffectRailway): AnalysisResult['statistics'] {
    const nodesPerType: Record<NodeType, number> = {
      controller: 0,
      service: 0,
      repository: 0,
      middleware: 0,
      utility: 0,
      worker: 0,
      error: 0
    };

    const edgesPerType: Record<EdgeType, number> = {
      success: 0,
      error: 0,
      dependency: 0,
      pipe: 0
    };

    const errorTypes = new Set<string>();
    const dependencyTypes = new Set<string>();

    for (const node of railway.nodes) {
      nodesPerType[node.type]++;
    }

    for (const edge of railway.edges) {
      edgesPerType[edge.type]++;
      
      if (edge.errorType) {
        errorTypes.add(edge.errorType);
      }
      if (edge.type === 'dependency' && edge.label) {
        dependencyTypes.add(edge.label);
      }
    }

    return {
      totalNodes: railway.nodes.length,
      totalEdges: railway.edges.length,
      nodesPerType,
      edgesPerType,
      errorTypes: Array.from(errorTypes),
      dependencyTypes: Array.from(dependencyTypes)
    };
  }
}

// Command line execution - only run when in Node.js environment
if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  // Load environment variables from .env file
  dotenv.config();
  
  const analyzer = new EffectASTAnalyzer();
  
  // Get target directory from command line argument or environment variable
  const targetDir = process.argv[2] || process.env.ANALYSIS_TARGET_DIR || '../backend/src';
  const backendPath = path.resolve(targetDir);
  
  console.log('🔍 Analyzing Effect TS patterns in codebase...');
  console.log('📁 Target directory:', backendPath);
  
  // Validate target directory exists
  if (!fs.existsSync(backendPath)) {
    console.error(`❌ Target directory does not exist: ${backendPath}`);
    console.error('Usage: npx tsx src/crawler/ast-analyzer.ts [target-directory]');
    console.error('   or: ANALYSIS_TARGET_DIR=/path/to/src npx tsx src/crawler/ast-analyzer.ts');
    process.exit(1);
  }
  
  analyzer.analyzePath(backendPath)
    .then((result) => {
      console.log('\n✅ Analysis completed!');
      console.log('\n📊 Statistics:');
      console.log(`  Total nodes: ${result.statistics.totalNodes}`);
      console.log(`  Total edges: ${result.statistics.totalEdges}`);
      console.log('\n🏗️  Nodes by type:');
      Object.entries(result.statistics.nodesPerType).forEach(([type, count]) => {
        if (count > 0) console.log(`  ${type}: ${count}`);
      });
      console.log('\n🔗 Edges by type:');
      Object.entries(result.statistics.edgesPerType).forEach(([type, count]) => {
        if (count > 0) console.log(`  ${type}: ${count}`);
      });
      
      if (result.statistics.errorTypes.length > 0) {
        console.log('\n❌ Error types found:');
        result.statistics.errorTypes.forEach(type => console.log(`  - ${type}`));
      }
      
      // Save results to file for web visualization
      const outputPath = path.resolve('./src/data/railway-data.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
      
      console.log(`\n💾 Results saved to: ${outputPath}`);
      console.log('\n🎨 Open the web visualization to see the railway!');
      console.log('Run: npm run dev');
    })
    .catch(console.error);
}