/**
 * Purpose: Main entry point for Effect Railway Visualizer web application
 * Dependencies: D3.js, AST Analyzer, Railway Renderer
 * 
 * Example Input:
 * ```
 * Browser loads the application
 * ```
 * 
 * Expected Output:
 * ```
 * Interactive railway visualization of Effect TS patterns
 * ```
 */

import { RailwayRendererBridge } from './visualization/railway-renderer-bridge.js';
import { generateNodeAnalysis, generateSystemOverview } from './export/llm-tree-generator-pure.js';
import { calculateNewEffect, generateSystemExtension } from './calculator/effect-calculator-pure.js';
import { analyzeEffect, generateQuickReport } from './calculator/targeted-effect-calculator-pure.js';
import type { AnalysisResult, EffectNode, EffectEdge, EdgeType } from './types/effect-node.js';
import type { FunctionAnalysisResult, FunctionInfo, FunctionLocation } from './analyzer/function-analyzer-types.js';
import type { APIAnalysisResult } from './types/api-types.js';
import type { WindowExtensions } from './types/window-extensions.js';

class EffectRailwayApp {
  private renderer: RailwayRendererBridge | null = null;
  private currentData: AnalysisResult | null = null;

  constructor() {
    this.initializeApp();
  }

  private async initializeApp(): Promise<void> {
    try {
      // Check if we have pre-generated data
      await this.loadData();
      this.setupEventListeners();
      this.setupExportFunctions();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      this.showError('Failed to load railway data. Please ensure the analysis has been run.');
    }
  }

  private async loadData(): Promise<void> {
    try {
      // First try to load function analysis from API
      const functionResponse = await fetch('http://localhost:3004/api/analyze/functions');
      if (functionResponse.ok) {
        const functionData = await functionResponse.json();
        if (functionData.success && functionData.analysis) {
          // Convert function analysis to railway visualization format
          this.currentData = this.convertFunctionAnalysisToRailway(functionData.analysis);
          await this.renderVisualization();
          return;
        }
      }
    } catch (error) {
      console.log('Could not load function analysis from API, trying local file...');
    }
    
    // Try to load from local output file
    try {
      const localResponse = await fetch('/output/function-analysis-latest.json');
      if (localResponse.ok) {
        const functionData = await localResponse.json();
        console.log('Loaded function analysis from local file:', functionData.metadata);
        this.currentData = this.convertFunctionAnalysisToRailway(functionData);
        await this.renderVisualization();
        return;
      }
    } catch (error) {
      console.log('Could not load function analysis from local file, trying railway data...');
    }

    try {
      // Fallback to railway data
      const response = await fetch('/src/data/railway-data.json');
      if (response.ok) {
        const data = await response.json() as AnalysisResult;
        if (data.railway && data.railway.nodes && data.railway.edges) {
          this.currentData = data;
          await this.renderVisualization();
          return;
        }
      }
    } catch (error) {
      console.log('No valid pre-generated data found, using sample data...');
    }

    // If no data available, use sample data for demo
    this.currentData = this.createSampleData();
    await this.renderVisualization();
  }

  private async runAnalysis(): Promise<void> {
    try {
      this.showLoading('Analyzing Effect TS patterns in codebase...');
      
      // In a real implementation, this would call a backend service
      // For demo purposes, we'll create sample data
      this.currentData = this.createSampleData();
      
      await this.renderVisualization();
    } catch (error) {
      console.error('Analysis failed:', error);
      this.showError('Failed to analyze codebase. Please check the backend path.');
    }
  }

  private async renderVisualization(): Promise<void> {
    if (!this.currentData) return;
    
    this.hideLoading();
    
    const svgElement = document.getElementById('visualization') as SVGSVGElement;
    if (!svgElement) {
      this.showError('Visualization container not found');
      return;
    }
    
    svgElement.style.display = 'block';
    
    this.renderer = new RailwayRendererBridge(svgElement);
    this.renderer.render(this.currentData);
    
    console.log('✅ Railway visualization rendered successfully!');
    console.log('📊 Statistics:', this.currentData.statistics);
    
    // Update filter options based on actual data
    this.updateFilterOptions();
    
    // Update sidebar statistics and lists
    this.updateSidebarStats();
  }
  
  private updateFilterOptions(): void {
    if (!this.currentData) return;
    
    const filterSelect = document.getElementById('filter-select') as HTMLSelectElement;
    if (!filterSelect) return;
    
    // Clear existing options
    filterSelect.innerHTML = '<option value="all">All Types</option>';
    
    // Add options for each folder type found in the data
    const types = Object.keys(this.currentData.statistics.nodesPerType || {}).sort();
    types.forEach(type => {
      const count = this.currentData!.statistics.nodesPerType[type];
      const option = document.createElement('option');
      option.value = type;
      option.textContent = `${this.formatTypeName(type)} (${count})`;
      filterSelect.appendChild(option);
    });
  }

  private updateSidebarStats(): void {
    if (!this.currentData) return;
    
    // Update basic statistics
    const totalNodesEl = document.getElementById('total-nodes');
    const totalEdgesEl = document.getElementById('total-edges');
    
    if (totalNodesEl) totalNodesEl.textContent = String(this.currentData.statistics.totalNodes || 0);
    if (totalEdgesEl) totalEdgesEl.textContent = String(this.currentData.statistics.totalEdges || 0);
    
    // Group nodes by folder and type
    const nodesByFolderAndType = new Map<string, Map<string, number>>();
    const errorTypesByFolder = new Map<string, Set<string>>();
    
    this.currentData.railway.nodes.forEach(node => {
      // Get folder from node
      let folder = node.folder || 'root';
      if (!node.folder && node.filePath) {
        const pathParts = node.filePath.split('/').filter(p => p);
        if (pathParts.length > 1) {
          folder = pathParts.slice(0, Math.min(2, pathParts.length - 1)).join('/');
        }
      }
      
      // Track node types by folder
      if (!nodesByFolderAndType.has(folder)) {
        nodesByFolderAndType.set(folder, new Map<string, number>());
      }
      const folderTypes = nodesByFolderAndType.get(folder)!;
      folderTypes.set(node.type, (folderTypes.get(node.type) || 0) + 1);
      
      // Track error types by folder
      if (node.effectSignature?.error && node.effectSignature.error.length > 0) {
        if (!errorTypesByFolder.has(folder)) {
          errorTypesByFolder.set(folder, new Set<string>());
        }
        const folderErrors = errorTypesByFolder.get(folder)!;
        node.effectSignature.error.forEach((error: string) => {
          folderErrors.add(error);
        });
      }
    });
    
    // Update Node Types list grouped by folder
    const nodeTypesListEl = document.getElementById('node-types-list');
    if (nodeTypesListEl) {
      nodeTypesListEl.innerHTML = '';
      
      // Sort folders alphabetically
      const sortedFolders = Array.from(nodesByFolderAndType.keys()).sort();
      
      sortedFolders.forEach(folder => {
        const folderTypes = nodesByFolderAndType.get(folder)!;
        
        // Create folder group
        const folderDiv = document.createElement('div');
        folderDiv.style.marginBottom = '12px';
        
        const folderTitle = document.createElement('div');
        folderTitle.style.fontWeight = 'bold';
        folderTitle.style.color = '#3B82F6';
        folderTitle.style.marginBottom = '4px';
        folderTitle.textContent = `📁 ${folder}`;
        folderDiv.appendChild(folderTitle);
        
        // Add types in this folder
        const typesList = document.createElement('div');
        typesList.style.paddingLeft = '12px';
        typesList.style.fontSize = '0.9rem';
        
        const NODE_COLORS: Record<string, string> = {
          controller: '#8B5CF6',
          service: '#3B82F6',
          repository: '#10B981',
          middleware: '#F59E0B',
          worker: '#EF4444',
          utility: '#6B7280',
          error: '#DC2626'
        };
        
        Array.from(folderTypes.entries()).sort().forEach(([type, count]) => {
          const typeItem = document.createElement('div');
          typeItem.style.padding = '2px 0';
          typeItem.innerHTML = `<span style="color: ${NODE_COLORS[type] || '#6B7280'}">●</span> ${type}: ${count}`;
          typesList.appendChild(typeItem);
        });
        
        folderDiv.appendChild(typesList);
        nodeTypesListEl.appendChild(folderDiv);
      });
    }
    
    // Update Error Types list grouped by folder
    const errorTypesListEl = document.getElementById('error-types-list');
    if (errorTypesListEl) {
      errorTypesListEl.innerHTML = '';
      
      if (errorTypesByFolder.size === 0) {
        errorTypesListEl.innerHTML = '<div style="color: #999; font-style: italic;">No error types found</div>';
      } else {
        // Sort folders alphabetically
        const sortedFolders = Array.from(errorTypesByFolder.keys()).sort();
        
        sortedFolders.forEach(folder => {
          const folderErrors = errorTypesByFolder.get(folder)!;
          
          // Create folder group
          const folderDiv = document.createElement('div');
          folderDiv.style.marginBottom = '12px';
          
          const folderTitle = document.createElement('div');
          folderTitle.style.fontWeight = 'bold';
          folderTitle.style.color = '#EF4444';
          folderTitle.style.marginBottom = '4px';
          folderTitle.textContent = `📁 ${folder}`;
          folderDiv.appendChild(folderTitle);
          
          // Add errors in this folder
          const errorsList = document.createElement('div');
          errorsList.style.paddingLeft = '12px';
          errorsList.style.fontSize = '0.9rem';
          
          Array.from(folderErrors).sort().forEach(error => {
            const errorItem = document.createElement('div');
            errorItem.style.padding = '2px 0';
            errorItem.innerHTML = `<span style="color: #DC2626">⚠</span> ${error}`;
            errorsList.appendChild(errorItem);
          });
          
          folderDiv.appendChild(errorsList);
          errorTypesListEl.appendChild(folderDiv);
        });
      }
    }
  }
  
  private formatTypeName(type: string): string {
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, ' ');
  }

  private setupEventListeners(): void {
    // Analyze button
    const analyzeButton = document.getElementById('analyze-button') as HTMLButtonElement;
    const targetDirectory = document.getElementById('target-directory') as HTMLInputElement;
    const analysisStatus = document.getElementById('analysis-status') as HTMLDivElement;
    
    analyzeButton?.addEventListener('click', async () => {
      const path = targetDirectory.value.trim();
      if (!path) {
        analysisStatus.textContent = '❌ Please enter a directory path';
        return;
      }
      
      analysisStatus.textContent = '🔄 Analyzing...';
      analyzeButton.disabled = true;
      
      try {
        const response = await fetch(`http://localhost:3004/api/analyze/functions?targetDir=${encodeURIComponent(path)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.analysis) {
            analysisStatus.textContent = `✅ Analyzed ${data.analysis.metadata.totalFunctions} functions in ${data.analysis.metadata.totalFolders} folders`;
            this.currentData = this.convertFunctionAnalysisToRailway(data.analysis);
            await this.renderVisualization();
            this.updateFilterOptions();
            // Zoom to fit new content
            setTimeout(() => {
              this.renderer?.zoomToFit();
            }, 200);
          } else {
            analysisStatus.textContent = '❌ Analysis failed';
          }
        } else {
          analysisStatus.textContent = '❌ API request failed';
        }
      } catch (error) {
        analysisStatus.textContent = `❌ Error: ${error}`;
      } finally {
        analyzeButton.disabled = false;
      }
    });
    
    // Filter selection
    const filterSelect = document.getElementById('filter-select') as HTMLSelectElement;
    filterSelect?.addEventListener('change', (event) => {
      const target = event.target as HTMLSelectElement;
      this.renderer?.filterByType(target.value);
    });

    // Entry points toggle
    const entryPointsCheckbox = document.getElementById('show-entry-points') as HTMLInputElement;
    entryPointsCheckbox?.addEventListener('change', () => {
      // Implement entry points highlighting
      this.renderer?.renderVisualization();
    });

    // Zoom controls for large datasets
    const zoomInButton = document.getElementById('zoom-in') as HTMLButtonElement;
    const zoomOutButton = document.getElementById('zoom-out') as HTMLButtonElement;
    const zoomFitButton = document.getElementById('zoom-fit') as HTMLButtonElement;
    
    zoomInButton?.addEventListener('click', () => {
      this.renderer?.zoomIn();
    });
    
    zoomOutButton?.addEventListener('click', () => {
      this.renderer?.zoomOut();
    });
    
    zoomFitButton?.addEventListener('click', () => {
      this.renderer?.zoomToFit();
    });
    
    // Global export controls
    const exportAllLLMButton = document.getElementById('export-all-llm') as HTMLButtonElement;
    const exportSystemOverviewButton = document.getElementById('export-system-overview') as HTMLButtonElement;
    const exportAllCalculationsButton = document.getElementById('export-all-calculations') as HTMLButtonElement;

    exportAllLLMButton?.addEventListener('click', () => {
      this.exportAllLLMAnalysis();
    });

    exportSystemOverviewButton?.addEventListener('click', () => {
      window.exportSystemOverview();
    });

    exportAllCalculationsButton?.addEventListener('click', () => {
      this.exportAllCalculations();
    });

    // Handle window resize
    window.addEventListener('resize', () => {
      if (this.renderer && this.currentData) {
        // Recreate renderer with new dimensions
        const svgElement = document.getElementById('visualization') as SVGSVGElement;
        this.renderer = new RailwayRendererBridge(svgElement);
        this.renderer.render(this.currentData);
      }
    });
  }

  private showLoading(message: string): void {
    const loadingElement = document.getElementById('loading');
    const visualizationElement = document.getElementById('visualization');
    
    if (loadingElement) {
      loadingElement.style.display = 'flex';
      const messageElement = loadingElement.querySelector('div:last-child');
      if (messageElement) messageElement.textContent = message;
    }
    
    if (visualizationElement) {
      visualizationElement.style.display = 'none';
    }
  }

  private hideLoading(): void {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.style.display = 'none';
    }
  }

  private showError(message: string): void {
    this.hideLoading();
    
    const container = document.querySelector('.main-content');
    if (container) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-message';
      errorDiv.innerHTML = `
        <h3>❌ Error</h3>
        <p>${message}</p>
        <p><strong>To run the analysis:</strong></p>
        <ol>
          <li>Open terminal in the effect-railway-visualizer directory</li>
          <li>Run: <code>npm install</code></li>
          <li>Run: <code>npm run analyze</code></li>
          <li>Refresh this page</li>
        </ol>
      `;
      container.appendChild(errorDiv);
    }
  }

  private mapFolderToNodeType(folder: string): string {
    // Use the folder name itself as the type
    // This gives each folder its own unique type instead of trying to categorize
    return folder;
  }

  private convertFunctionAnalysisToRailway(functionAnalysis: FunctionAnalysisResult): AnalysisResult {
    const nodes: EffectNode[] = [];
    const edges: EffectEdge[] = [];
    const nodeMap = new Map<string, string>(); // functionKey -> nodeId
    let nodeCounter = 0;

    // Convert functions to nodes, grouped by actual folder structure
    const functionsByFolder = new Map<string, FunctionInfo[]>();
    
    // Group functions by their actual folder
    functionAnalysis.functions.forEach((func: FunctionInfo) => {
      // Extract folder from file path if folder field is missing or generic
      let folder = func.folder;
      if (!folder || folder === '.' || folder === 'root' || folder === '') {
        // Use the first directory from the file path
        const fileParts = func.file.split('/');
        if (fileParts.length > 1) {
          folder = fileParts[0];
        } else {
          folder = 'root';
        }
      }
      
      if (!functionsByFolder.has(folder)) {
        functionsByFolder.set(folder, []);
      }
      const folderArray = functionsByFolder.get(folder);
      if (folderArray) {
        folderArray.push(func);
      }
    });

    // Sort folders by average complexity (folders with simpler functions first)
    const sortedFolders = Array.from(functionsByFolder.entries()).sort((a, b) => {
      const avgA = a[1].reduce((sum, f) => sum + f.callsCount, 0) / a[1].length;
      const avgB = b[1].reduce((sum, f) => sum + f.callsCount, 0) / b[1].length;
      return avgA - avgB;
    });

    // Create nodes for each function, ordered by complexity within each folder
    sortedFolders.forEach(([folder, funcs]) => {
      // Sort functions within folder by dependency count (least to most)
      funcs.sort((a, b) => a.callsCount - b.callsCount);
      
      funcs.forEach(func => {
        const nodeId = `node-${++nodeCounter}`;
        const functionKey = `${func.file}:${func.name}:${func.startLine}`;
        nodeMap.set(functionKey, nodeId);
        
        // Map folder to node type
        const nodeType = this.mapFolderToNodeType(folder);
        
        nodes.push({
          id: nodeId,
          name: func.name,
          type: nodeType, // Use mapped node type
          filePath: func.file,
          line: func.startLine,
          description: `${func.kind} with ${func.callsCount} dependencies`,
          folder: folder,
          effectSignature: {
            success: 'unknown',
            error: [],
            dependencies: func.calls.slice(0, 5).map((c: FunctionLocation) => c.name)
          },
          metrics: {
            callsCount: func.callsCount,
            calledByCount: func.calledByCount,
            lines: func.endLine - func.startLine + 1
          }
        });
      });
    });

    // Create edges based on function calls
    functionAnalysis.functions.forEach((func: FunctionInfo) => {
      const sourceKey = `${func.file}:${func.name}:${func.startLine}`;
      const sourceId = nodeMap.get(sourceKey);
      
      if (sourceId) {
        func.calls.forEach((call: FunctionLocation) => {
          // Try to find the target node
          const targetKey = `${call.file}:${call.name}:${call.line}`;
          const targetId = nodeMap.get(targetKey);
          
          if (targetId && targetId !== sourceId) {
            edges.push({
              id: `edge-${sourceId}-${targetId}`,
              source: sourceId,
              target: targetId,
              type: 'dependency' as EdgeType
            });
          }
        });
      }
    });

    // Calculate statistics - group by actual folders
    const nodesByFolder: Record<string, number> = {};
    const nodesByType: Record<string, number> = {};
    
    nodes.forEach(node => {
      // Count by full folder path
      const folder = node.folder || 'root';
      nodesByFolder[folder] = (nodesByFolder[folder] || 0) + 1;
      
      // Count by folder type (last part of path)
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });

    // Calculate edge statistics
    const edgesPerType: Record<string, number> = {
      success: 0,
      error: 0,
      dependency: edges.length, // All edges are dependencies in function analysis
      pipe: 0
    };
    
    const statistics = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodesPerType: nodesByType, // This now shows actual folder names
      nodesByFolder: nodesByFolder, // Full folder paths
      edgesPerType: edgesPerType,
      errorTypes: [],
      dependencyTypes: [],
      complexity: {
        zero: functionAnalysis.summary.zeroDependencies,
        low: functionAnalysis.summary.lowComplexity,
        medium: functionAnalysis.summary.mediumComplexity,
        high: functionAnalysis.summary.highComplexity,
        veryHigh: functionAnalysis.summary.veryHighComplexity
      },
      avgDependencies: functionAnalysis.metadata.avgDependencies,
      totalFolders: Object.keys(nodesByFolder).length
    };

    return {
      railway: {
        nodes,
        edges,
        layers: {},
        entryPoints: [], // Initialize empty entryPoints array
        compositions: []
      },
      statistics
    };
  }

  private createSampleData(): AnalysisResult {
    // Create realistic sample data based on the actual codebase structure
    return {
      railway: {
        nodes: [
          {
            id: 'node-1',
            name: 'GET /journalists',
            type: 'controller',
            filePath: '/backend/src/routes/journalists.ts',
            line: 31,
            description: 'HTTP GET endpoint for fetching journalists',
            effectSignature: {
              success: '{ data: Journalist[], total: number, page: number, limit: number }',
              error: ['ValidationError', 'DatabaseError'],
              dependencies: ['LoggerService', 'JournalistsRepository']
            }
          },
          {
            id: 'node-2', 
            name: 'POST /journalists',
            type: 'controller',
            filePath: '/backend/src/routes/journalists.ts',
            line: 128,
            description: 'HTTP POST endpoint for creating journalists',
            effectSignature: {
              success: 'Journalist',
              error: ['ValidationError', 'DatabaseError'],
              dependencies: ['LoggerService', 'JournalistsRepository', 'MediaHouseJournalistsRepository']
            }
          },
          {
            id: 'node-3',
            name: 'LoggerService',
            type: 'service',
            filePath: '/backend/src/services/logger.ts',
            line: 15,
            description: 'Structured logging service using Effect Context.Tag',
            effectSignature: {
              success: 'void',
              error: [],
              dependencies: ['EnvConfig']
            }
          },
          {
            id: 'node-4',
            name: 'JournalistsRepository',
            type: 'repository',
            filePath: '/backend/src/repositories/journalists.repository.ts',
            line: 25,
            description: 'CRUD operations for journalists with Effect patterns',
            effectSignature: {
              success: 'Journalist | Journalist[] | number',
              error: ['DatabaseError', 'NotFoundError'],
              dependencies: ['DatabaseService']
            }
          },
          {
            id: 'node-5',
            name: 'DatabaseService',
            type: 'service',
            filePath: '/backend/src/services/database.ts',
            line: 20,
            description: 'PostgreSQL database service with transaction support',
            effectSignature: {
              success: 'QueryResult',
              error: ['DatabaseError'],
              dependencies: ['EnvConfig']
            }
          },
          {
            id: 'node-6',
            name: 'handleRequest',
            type: 'middleware',
            filePath: '/backend/src/utils/handle-request.ts',
            line: 102,
            description: 'Effect request handler with error mapping',
            effectSignature: {
              success: 'void',
              error: ['AppError'],
              dependencies: ['Runtime']
            }
          },
          {
            id: 'node-7',
            name: 'ValidationError',
            type: 'error',
            filePath: '/backend/src/errors/index.ts',
            line: 45,
            description: 'Validation error type with status code 400'
          },
          {
            id: 'node-8',
            name: 'DatabaseError',
            type: 'error',
            filePath: '/backend/src/errors/index.ts',
            line: 65,
            description: 'Database error type with status code 503'
          },
          {
            id: 'node-9',
            name: 'EnrichmentWorker',
            type: 'worker',
            filePath: '/backend/src/workers/enrichment.worker.ts',
            line: 15,
            description: 'Background worker for journalist enrichment using LangGraph',
            effectSignature: {
              success: 'EnrichmentResult',
              error: ['EnrichmentError', 'DatabaseError'],
              dependencies: ['AgentOrchestrationService', 'QueueService', 'LoggerService']
            }
          },
          {
            id: 'node-10',
            name: 'AgentOrchestrationService',
            type: 'service',
            filePath: '/backend/src/services/agent-orchestration.service.ts',
            line: 30,
            description: 'LangGraph-based agent orchestration for research tasks',
            effectSignature: {
              success: 'AgentResult',
              error: ['EnrichmentError', 'ExternalServiceError'],
              dependencies: ['LangGraphRuntimeService', 'HttpService']
            }
          }
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-3',
            type: 'dependency',
            label: 'requires LoggerService'
          },
          {
            id: 'edge-2',
            source: 'node-1',
            target: 'node-4',
            type: 'dependency',
            label: 'requires JournalistsRepository'
          },
          {
            id: 'edge-3',
            source: 'node-1',
            target: 'node-7',
            type: 'error',
            errorType: 'ValidationError'
          },
          {
            id: 'edge-4',
            source: 'node-1',
            target: 'node-8',
            type: 'error',
            errorType: 'DatabaseError'
          },
          {
            id: 'edge-5',
            source: 'node-2',
            target: 'node-3',
            type: 'dependency',
            label: 'requires LoggerService'
          },
          {
            id: 'edge-6',
            source: 'node-2',
            target: 'node-4',
            type: 'dependency',
            label: 'requires JournalistsRepository'
          },
          {
            id: 'edge-7',
            source: 'node-4',
            target: 'node-5',
            type: 'dependency',
            label: 'requires DatabaseService'
          },
          {
            id: 'edge-8',
            source: 'node-4',
            target: 'node-8',
            type: 'error',
            errorType: 'DatabaseError'
          },
          {
            id: 'edge-9',
            source: 'node-5',
            target: 'node-8',
            type: 'error',
            errorType: 'DatabaseError'
          },
          {
            id: 'edge-10',
            source: 'node-9',
            target: 'node-10',
            type: 'dependency',
            label: 'requires AgentOrchestrationService'
          },
          {
            id: 'edge-11',
            source: 'node-9',
            target: 'node-3',
            type: 'dependency',
            label: 'requires LoggerService'
          }
        ],
        layers: {
          controllers: ['node-1', 'node-2'],
          services: ['node-3', 'node-5', 'node-10'],
          repositories: ['node-4'],
          middleware: ['node-6'],
          utilities: [],
          workers: ['node-9'],
          errors: ['node-7', 'node-8']
        },
        entryPoints: ['node-1', 'node-2']
      },
      statistics: {
        totalNodes: 10,
        totalEdges: 11,
        nodesPerType: {
          controller: 2,
          service: 3,
          repository: 1,
          middleware: 1,
          utility: 0,
          worker: 1,
          error: 2
        },
        edgesPerType: {
          success: 0,
          error: 4,
          dependency: 7,
          pipe: 0
        },
        errorTypes: ['ValidationError', 'DatabaseError', 'EnrichmentError'],
        dependencyTypes: ['LoggerService', 'JournalistsRepository', 'DatabaseService', 'AgentOrchestrationService']
      }
    };
  }

  private setupExportFunctions(): void {
    if (!this.currentData) return;

    // Skip calculator setup for now since these are causing import errors
    // TODO: Fix these imports later
    // const calculator = new EffectCalculator(this.currentData);
    // const targetedCalculator = new TargetedEffectCalculator(this.currentData);

    // API Configuration
    const API_BASE_URL = 'http://localhost:3004/api';

    // Make functions available globally for button clicks
    window.exportLLMAnalysis = (nodeId: string) => {
      try {
        if (!this.currentData) return;
        const analysis = generateNodeAnalysis(this.currentData, nodeId);
        this.downloadText(`${analysis.rootNode.name}_llm_analysis.md`, analysis.fullDependencyTree);
        console.log('📊 LLM Analysis exported for:', analysis.rootNode.name);
      } catch (error) {
        console.error('Failed to generate LLM analysis:', error);
        alert('Failed to generate LLM analysis. Please check console for details.');
      }
    };

    window.generateEffectExtension = (nodeId: string) => {
      try {
        // Example usage - in real app, this would open a form for user input
        const exampleRequest = {
          name: 'enhancedUserManagement',
          targetLayer: 'service' as const,
          requiredCapabilities: ['user-creation', 'email-sending', 'validation'],
          expectedOutputType: 'User',
          errorScenarios: ['email-failed', 'validation-error'],
          integrateWithExisting: [nodeId]
        };
        
        if (!this.currentData) return;
        const calculation = generateSystemExtension(this.currentData, exampleRequest);
        this.downloadText(`effect_extension_${exampleRequest.name}.md`, calculation);
        console.log('🧮 Effect extension generated for:', exampleRequest.name);
      } catch (error) {
        console.error('Failed to generate effect extension:', error);
        alert('Failed to generate effect extension. Please check console for details.');
      }
    };

    window.exportSystemOverview = () => {
      try {
        const overview = generateSystemOverview(this.currentData!);
        this.downloadText('effect_system_overview.md', overview);
        console.log('📊 System overview exported');
      } catch (error) {
        console.error('Failed to generate system overview:', error);
        alert('Failed to generate system overview. Please check console for details.');
      }
    };

    // API-based Effect Analysis Functions
    window.queryEffectAPI = async (query: string, operation: string = 'analyze', context?: string) => {
      try {
        const response = await fetch(`${API_BASE_URL}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            operation,
            context,
            refresh: 'auto' // Auto-refresh analysis data
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('🎯 API-based Effect Analysis:');
        console.log(result);
        
        // Display results in UI
        this.displayAPIResult(result);
        
        return result;
      } catch (error) {
        const errorMsg = `❌ API Query failed: ${error}`;
        console.error(errorMsg);
        alert(errorMsg);
        return errorMsg;
      }
    };

    // Quick API shortcuts for common operations
    window.analyzeEffect = (query: string) => window.queryEffectAPI(query, 'analyze');
    window.modifyEffect = (query: string, context?: string) => window.queryEffectAPI(query, 'modify', context);
    window.useEffect = (query: string, context?: string) => window.queryEffectAPI(query, 'use', context);
    window.extendEffect = (query: string, context?: string) => window.queryEffectAPI(query, 'extend', context);

    // Legacy local functions (fallback)
    window.queryEffect = (query: string, operation: string = 'analyze', context?: string) => {
      try {
        if (!this.currentData) return;
        const report = generateQuickReport(this.currentData, query, operation, context);
        console.log('🎯 Local Targeted Effect Analysis:');
        console.log(report);
        return report;
      } catch (error) {
        const errorMsg = `❌ Local Query failed: ${error}`;
        console.error(errorMsg);
        return errorMsg;
      }
    };

    // Download targeted analysis
    window.downloadEffectAnalysis = (query: string, operation: string = 'analyze', context?: string) => {
      try {
        if (!this.currentData) return;
        const report = generateQuickReport(this.currentData, query, operation, context);
        const filename = `effect_analysis_${query.replace(/[^a-zA-Z0-9]/g, '_')}.md`;
        this.downloadText(filename, report);
        console.log('📥 Targeted analysis downloaded:', filename);
        return report;
      } catch (error) {
        console.error('Failed to download targeted analysis:', error);
        return `❌ Download failed: ${error}`;
      }
    };
  }

  private exportAllLLMAnalysis(): void {
    if (!this.currentData) {
      alert('No data available to export');
      return;
    }

    try {
      let combinedAnalysis = '';
      
      combinedAnalysis += '# 🤖 COMPLETE LLM ANALYSIS: Effect TS System\n\n';
      combinedAnalysis += `**Generated:** ${new Date().toISOString()}\n`;
      combinedAnalysis += `**Total Nodes:** ${this.currentData.railway.nodes.length}\n`;
      combinedAnalysis += `**Total Edges:** ${this.currentData.railway.edges.length}\n\n`;

      // Add basic system overview
      combinedAnalysis += '---\n\n';
      combinedAnalysis += '# 📊 SYSTEM OVERVIEW\n\n';
      combinedAnalysis += `- Total Functions: ${this.currentData.statistics.totalNodes}\n`;
      combinedAnalysis += `- Total Connections: ${this.currentData.statistics.totalEdges}\n`;
      combinedAnalysis += `- Folders: ${Object.keys(this.currentData.statistics.nodesByFolder || {}).length}\n`;
      combinedAnalysis += '\n---\n\n';

      // Add basic node information for now
      combinedAnalysis += '# 📊 NODE INFORMATION\n\n';
      
      this.currentData.railway.nodes.forEach((node, index) => {
        combinedAnalysis += `## ${index + 1}. ${node.name}\n\n`;
        combinedAnalysis += `- **Type:** ${node.type}\n`;
        combinedAnalysis += `- **File:** ${node.filePath}:${node.line}\n`;
        combinedAnalysis += `- **Folder:** ${node.folder || 'root'}\n`;
        if (node.description) {
          combinedAnalysis += `- **Description:** ${node.description}\n`;
        }
        combinedAnalysis += '\n---\n\n';
      });

      this.downloadText('complete_llm_analysis.md', combinedAnalysis);
      console.log('🤖 Complete LLM analysis exported');
      
    } catch (error) {
      console.error('Failed to export complete LLM analysis:', error);
      alert('Failed to export complete analysis. Please check console for details.');
    }
  }

  private exportAllCalculations(): void {
    if (!this.currentData) {
      alert('No data available to export');
      return;
    }

    try {
      const calculator = new EffectCalculator(this.currentData);
      let allCalculations = '';
      
      allCalculations += '# 🧮 COMPLETE EFFECT CALCULATIONS\n\n';
      allCalculations += `**Generated:** ${new Date().toISOString()}\n`;
      allCalculations += `**System Nodes:** ${this.currentData.railway.nodes.length}\n\n`;

      allCalculations += '## 📋 CALCULATION INDEX\n\n';
      
      // Create example calculations for each node type
      const nodesByType = this.currentData.railway.nodes.reduce((acc, node) => {
        if (!acc[node.type]) acc[node.type] = [];
        acc[node.type].push(node);
        return acc;
      }, {} as Record<string, typeof this.currentData.railway.nodes>);

      Object.entries(nodesByType).forEach(([nodeType, nodes]) => {
        if (nodes.length === 0) return;
        
        allCalculations += `### ${nodeType.toUpperCase()} LAYER\n\n`;
        
        // Take first node of each type as example
        const exampleNode = nodes[0];
        
        const exampleRequest = {
          name: `enhanced${exampleNode.name.replace(/[^a-zA-Z]/g, '')}`,
          targetLayer: nodeType,
          requiredCapabilities: this.inferCapabilities(exampleNode),
          expectedOutputType: this.inferOutputType(exampleNode),
          errorScenarios: this.inferErrorScenarios(exampleNode),
          integrateWithExisting: [exampleNode.id]
        };
        
        try {
          if (!this.currentData) return;
          const calculation = generateSystemExtension(this.currentData, exampleRequest);
          allCalculations += calculation;
          allCalculations += '\n---\n\n';
        } catch (error) {
          console.warn(`Failed to calculate for ${exampleNode.name}:`, error);
          allCalculations += `⚠️ Calculation failed for ${exampleNode.name}\n\n---\n\n`;
        }
      });

      this.downloadText('complete_effect_calculations.md', allCalculations);
      console.log('🧮 Complete calculations exported');
      
    } catch (error) {
      console.error('Failed to export calculations:', error);
      alert('Failed to export calculations. Please check console for details.');
    }
  }

  private inferCapabilities(node: EffectNode): string[] {
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
    
    if (capabilities.length === 0) {
      capabilities.push(`${node.type}-operations`);
    }
    
    return capabilities;
  }

  private inferOutputType(node: EffectNode): string {
    if (node.effectSignature?.success) {
      return node.effectSignature.success;
    }
    
    const name = node.name.toLowerCase();
    if (name.includes('user')) return 'User';
    if (name.includes('journalist')) return 'Journalist';
    if (name.includes('brand')) return 'Brand';
    if (name.includes('list')) return 'Array<T>';
    if (name.includes('count')) return 'number';
    if (name.includes('delete')) return 'void';
    
    return 'unknown';
  }

  private inferErrorScenarios(node: EffectNode): string[] {
    const scenarios: string[] = [];
    
    if (node.effectSignature?.error) {
      return node.effectSignature.error.map((e: string) => 
        e.replace('Error', '').toLowerCase()
      );
    }
    
    const name = node.name.toLowerCase();
    if (name.includes('create') || name.includes('post')) scenarios.push('validation-failed');
    if (name.includes('get') || name.includes('find')) scenarios.push('not-found');
    if (name.includes('delete')) scenarios.push('constraint-violation');
    if (name.includes('auth')) scenarios.push('unauthorized');
    
    if (scenarios.length === 0) {
      scenarios.push('operation-failed');
    }
    
    return scenarios;
  }

  private downloadText(filename: string, content: string): void {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private displayAPIResult(result: APIAnalysisResult): void {
    // Show the code inspection panel if not visible
    const panel = document.getElementById('code-inspection-panel');
    if (panel) {
      panel.classList.add('visible');
    }

    // Update node information
    const nodeInfo = document.getElementById('node-info');
    if (nodeInfo && result.foundEffect) {
      const effect = result.foundEffect;
      nodeInfo.innerHTML = `
        <strong>${effect.name}</strong><br>
        <span style="color: #666;">Type:</span> ${effect.type}<br>
        <span style="color: #666;">File:</span> ${effect.filePath}:${effect.line}<br>
        <span style="color: #666;">Risk Level:</span> <span style="color: ${result.riskLevel === 'high' ? '#dc3545' : result.riskLevel === 'medium' ? '#ffc107' : '#28a745'}; font-weight: bold;">${result.riskLevel.toUpperCase()}</span><br>
        <span style="color: #666;">Last Analysis:</span> ${new Date(result.lastAnalysis).toLocaleString()}<br>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #555;">
          ${effect.description || 'No description available'}
        </div>
      `;
    }

    // Update effect signature
    const effectSignature = document.getElementById('effect-signature');
    if (effectSignature && result.foundEffect?.effectSignature) {
      const sig = result.foundEffect.effectSignature;
      effectSignature.innerHTML = `
        <div class="code-block">
Effect&lt;${sig.success || 'unknown'}, ${(sig.error || []).join(' | ') || 'never'}, ${(sig.dependencies || []).join(' & ') || 'never'}&gt;
        </div>
      `;
    } else if (effectSignature) {
      effectSignature.innerHTML = `<div style="color: #666; font-style: italic;">No Effect signature available via API</div>`;
    }

    // Update upstream dependencies
    const upstreamDeps = document.getElementById('upstream-deps');
    if (upstreamDeps) {
      upstreamDeps.innerHTML = '';
      if (result.upstreamNodes && result.upstreamNodes.length > 0) {
        result.upstreamNodes.slice(0, 5).forEach((node: EffectNode) => {
          const li = document.createElement('li');
          li.className = 'upstream';
          li.innerHTML = `
            <strong>${node.name}</strong> (${node.type})<br>
            <span style="font-size: 0.8rem; color: #666;">${node.filePath.split('/').pop()}:${node.line}</span>
          `;
          upstreamDeps.appendChild(li);
        });
        if (result.upstreamNodes.length > 5) {
          const li = document.createElement('li');
          li.className = 'upstream';
          li.innerHTML = `<span style="color: #666; font-style: italic;">... and ${result.upstreamNodes.length - 5} more upstream dependencies</span>`;
          upstreamDeps.appendChild(li);
        }
      } else {
        upstreamDeps.innerHTML = '<li style="color: #666; font-style: italic;">No upstream dependencies</li>';
      }
    }

    // Update downstream dependents  
    const downstreamDeps = document.getElementById('downstream-deps');
    if (downstreamDeps) {
      downstreamDeps.innerHTML = '';
      if (result.downstreamNodes && result.downstreamNodes.length > 0) {
        result.downstreamNodes.slice(0, 5).forEach((node: EffectNode) => {
          const li = document.createElement('li');
          li.className = 'downstream';
          li.innerHTML = `
            <strong>${node.name}</strong> (${node.type})<br>
            <span style="font-size: 0.8rem; color: #666;">${node.filePath.split('/').pop()}:${node.line}</span>
          `;
          downstreamDeps.appendChild(li);
        });
        if (result.downstreamNodes.length > 5) {
          const li = document.createElement('li');
          li.className = 'downstream';
          li.innerHTML = `<span style="color: #666; font-style: italic;">... and ${result.downstreamNodes.length - 5} more downstream dependents</span>`;
          downstreamDeps.appendChild(li);
        }
      } else {
        downstreamDeps.innerHTML = '<li style="color: #666; font-style: italic;">No downstream dependents</li>';
      }
    }

    // Update modification guide
    const modificationGuide = document.getElementById('modification-steps');
    if (modificationGuide) {
      modificationGuide.innerHTML = `
        <div class="guide-step">
          <span class="step-number">1</span>
          <strong>Impact Assessment:</strong> ${result.upstreamCount} upstream dependencies, ${result.downstreamCount} downstream dependents
        </div>
        <div class="guide-step">
          <span class="step-number">2</span>
          <strong>Risk Level:</strong> ${result.riskLevel.toUpperCase()} - ${result.riskLevel === 'high' ? 'Proceed with caution, comprehensive testing required' : result.riskLevel === 'medium' ? 'Standard precautions apply' : 'Low risk modification'}
        </div>
        <div class="guide-step">
          <span class="step-number">3</span>
          <strong>API Query:</strong> <code>curl "${location.protocol}//${location.hostname}:3004/api/analyze?query=${result.foundEffect.name}"</code>
        </div>
      `;
    }
  }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new EffectRailwayApp();
});

// Export for use as module
export { EffectRailwayApp };