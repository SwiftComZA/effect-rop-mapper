#!/usr/bin/env node

/**
 * Purpose: MCP Server for Effect Railway Visualizer integration with Claude Code
 * Dependencies: @modelcontextprotocol/sdk, Effect Railway API
 * 
 * Example Usage:
 * ```
 * # Add to Claude Code MCP configuration
 * {
 *   "mcpServers": {
 *     "effect-railway": {
 *       "command": "node",
 *       "args": ["path/to/effect-rop-mapper/mcp-server.ts"],
 *       "env": {
 *         "ANALYSIS_TARGET_DIR": "/path/to/your/effect-ts-project/src"
 *       }
 *     }
 *   }
 * }
 * ```
 * 
 * Tools Provided:
 * - analyze_effect: Quick Effect analysis by name/file/partial match
 * - list_effects: Get all Effects in the target codebase
 * - batch_analyze: Analyze multiple Effects at once
 * - get_effect_dependencies: Get upstream/downstream dependencies
 * - assess_modification_risk: Risk assessment for Effect modifications
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';
import { analyzeFunctions, FunctionAnalysisResult, FunctionInfo } from './src/analyzer/function-analyzer-pure.js';
import { TopComplexFunction, FolderStatistics } from './src/analyzer/function-analyzer-types.js';

interface EffectNode {
  id: string;
  name: string;
  type: string;
  filePath: string;
  line: number;
  description?: string;
  effectSignature?: {
    success: string;
    error: string[];
    dependencies: string[];
  };
}

interface APIAnalysisResult {
  foundEffect: EffectNode;
  upstreamCount: number;
  downstreamCount: number;
  upstreamNodes: EffectNode[];
  downstreamNodes: EffectNode[];
  riskLevel: 'low' | 'medium' | 'high';
  operation: string;
  timestamp: string;
  lastAnalysis?: string;
}

class EffectRailwayMCPServer {
  private server: Server;
  private apiBaseUrl: string;

  constructor() {
    this.server = new Server(
      {
        name: 'effect-railway-visualizer',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Configuration
    this.apiBaseUrl = process.env.EFFECT_RAILWAY_API_URL || 'http://localhost:3004/api';

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'analyze_effect',
            description: 'Analyze a specific Effect by name, file:line, or partial match. Returns detailed dependency information, risk assessment, and modification guidance.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Effect name (e.g., "LoggerService"), file:line (e.g., "users.ts:142"), or partial match (e.g., "User")',
                },
                operation: {
                  type: 'string',
                  enum: ['analyze', 'modify', 'use', 'extend'],
                  default: 'analyze',
                  description: 'Type of analysis to perform',
                },
                refresh: {
                  type: 'string',
                  enum: ['auto', 'force'],
                  default: 'auto',
                  description: 'Whether to force refresh the analysis data',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_effects',
            description: 'List all Effects discovered in the target codebase with their types, locations, and basic information.',
            inputSchema: {
              type: 'object',
              properties: {
                type_filter: {
                  type: 'string',
                  enum: ['controller', 'service', 'repository', 'middleware', 'worker', 'utility', 'error'],
                  description: 'Filter effects by type',
                },
                limit: {
                  type: 'number',
                  default: 50,
                  description: 'Maximum number of effects to return',
                },
              },
            },
          },
          {
            name: 'batch_analyze',
            description: 'Analyze multiple Effects at once. Useful for understanding relationships between multiple components.',
            inputSchema: {
              type: 'object',
              properties: {
                queries: {
                  type: 'array',
                  items: {
                    oneOf: [
                      { type: 'string' },
                      {
                        type: 'object',
                        properties: {
                          query: { type: 'string' },
                          operation: { type: 'string' },
                        },
                        required: ['query'],
                      },
                    ],
                  },
                  description: 'Array of Effect names or query objects to analyze',
                },
              },
              required: ['queries'],
            },
          },
          {
            name: 'get_effect_dependencies',
            description: 'Get detailed upstream and downstream dependencies for a specific Effect, including transitive dependencies.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Effect name, file:line, or partial match',
                },
                include_transitive: {
                  type: 'boolean',
                  default: true,
                  description: 'Include transitive (indirect) dependencies',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'assess_modification_risk',
            description: 'Assess the risk and impact of modifying a specific Effect. Provides guidance on testing requirements and potential breaking changes.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Effect name, file:line, or partial match',
                },
                modification_type: {
                  type: 'string',
                  enum: ['signature_change', 'implementation_change', 'error_handling', 'dependency_change'],
                  description: 'Type of modification being considered',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'analyze_functions',
            description: 'Analyze all TypeScript functions in a directory to understand dependencies, complexity, and architecture patterns. Returns detailed function analysis with call graphs.',
            inputSchema: {
              type: 'object',
              properties: {
                targetDir: {
                  type: 'string',
                  description: 'Directory path to analyze (absolute or relative)',
                },
                includeDetails: {
                  type: 'boolean',
                  default: false,
                  description: 'Include full function details in response',
                },
              },
              required: ['targetDir'],
            },
          },
          {
            name: 'start_api_server',
            description: 'Start the Effect Railway API server if not running. Useful for ensuring the analysis service is available.',
            inputSchema: {
              type: 'object',
              properties: {
                target_directory: {
                  type: 'string',
                  description: 'Directory to analyze (overrides ANALYSIS_TARGET_DIR)',
                },
                port: {
                  type: 'number',
                  default: 3004,
                  description: 'Port for the API server',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'analyze_effect':
            return await this.analyzeEffect(args as { query: string; operation?: string; refresh?: string });
          case 'list_effects':
            return await this.listEffects(args as { limit?: number; type_filter?: string });
          case 'batch_analyze':
            return await this.batchAnalyze(args as { queries: Array<string | { query: string; operation?: string }> });
          case 'get_effect_dependencies':
            return await this.getEffectDependencies(args as { query: string; include_transitive?: boolean });
          case 'assess_modification_risk':
            return await this.assessModificationRisk(args as { query: string; modification_type?: string });
          case 'analyze_functions':
            return await this.analyzeFunctions(args as { targetDir: string; includeDetails?: boolean });
          case 'start_api_server':
            return await this.startApiServer(args as { target_directory?: string; port?: number });
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async analyzeEffect(args: { query: string; operation?: string; refresh?: string }) {
    const { query, operation = 'analyze', refresh = 'auto' } = args;

    try {
      const response = await fetch(`${this.apiBaseUrl}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, operation, refresh }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const result: APIAnalysisResult = await response.json();

      const output = [
        `# 🎯 Effect Analysis: ${result.foundEffect.name}`,
        '',
        `**Type:** ${result.foundEffect.type}`,
        `**Location:** ${result.foundEffect.filePath}:${result.foundEffect.line}`,
        `**Risk Level:** ${result.riskLevel.toUpperCase()}`,
        `**Last Analysis:** ${result.lastAnalysis ? new Date(result.lastAnalysis).toLocaleString() : 'N/A'}`,
        '',
        `**Dependencies:** ${result.upstreamCount} upstream, ${result.downstreamCount} downstream`,
        '',
      ];

      if (result.foundEffect.description) {
        output.push(`**Description:** ${result.foundEffect.description}`, '');
      }

      if (result.foundEffect.effectSignature) {
        const sig = result.foundEffect.effectSignature;
        output.push(
          '**Effect Signature:**',
          '```typescript',
          `Effect<${sig.success}, ${sig.error.join(' | ') || 'never'}, ${sig.dependencies.join(' & ') || 'never'}>`,
          '```',
          ''
        );
      }

      if (result.upstreamNodes.length > 0) {
        output.push('**⬆️ Upstream Dependencies:**');
        result.upstreamNodes.slice(0, 5).forEach((node) => {
          output.push(`- **${node.name}** (${node.type}) - ${node.filePath.split('/').pop()}:${node.line}`);
        });
        if (result.upstreamNodes.length > 5) {
          output.push(`- ...and ${result.upstreamNodes.length - 5} more`);
        }
        output.push('');
      }

      if (result.downstreamNodes.length > 0) {
        output.push('**⬇️ Downstream Dependents:**');
        result.downstreamNodes.slice(0, 5).forEach((node) => {
          output.push(`- **${node.name}** (${node.type}) - ${node.filePath.split('/').pop()}:${node.line}`);
        });
        if (result.downstreamNodes.length > 5) {
          output.push(`- ...and ${result.downstreamNodes.length - 5} more`);
        }
        output.push('');
      }

      // Add operation-specific guidance
      if (operation === 'modify') {
        output.push(
          '**🛠️ Modification Guidance:**',
          `- Risk Level: ${result.riskLevel}`,
          `- Impact: ${result.upstreamCount + result.downstreamCount} total dependencies`,
          '- Consider comprehensive testing if risk is medium/high',
          '- Review all dependent components before changes'
        );
      }

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (error) {
      throw new Error(`Failed to analyze effect "${query}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async listEffects(args: { type_filter?: string; limit?: number }) {
    const { type_filter, limit = 50 } = args;

    try {
      const response = await fetch(`${this.apiBaseUrl}/effects`);
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let effects = data.effects || [];

      // Apply type filter
      if (type_filter) {
        effects = effects.filter((effect: EffectNode) => effect.type === type_filter);
      }

      // Apply limit
      effects = effects.slice(0, limit);

      const output = [
        `# 📊 Effects in Codebase${type_filter ? ` (${type_filter})` : ''}`,
        '',
        `**Total:** ${effects.length} effects${data.total ? ` of ${data.total}` : ''}`,
        `**Last Analysis:** ${data.lastAnalysis ? new Date(data.lastAnalysis).toLocaleString() : 'N/A'}`,
        '',
      ];

      // Group by type
      const byType = effects.reduce((acc: Record<string, EffectNode[]>, effect: EffectNode) => {
        if (!acc[effect.type]) acc[effect.type] = [];
        acc[effect.type].push(effect);
        return acc;
      }, {});

      Object.entries(byType).forEach(([type, typeEffects]) => {
        output.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${typeEffects.length})`);
        typeEffects.forEach((effect) => {
          const filePath = effect.filePath.split('/').pop() || effect.filePath;
          output.push(`- **${effect.name}** - ${filePath}:${effect.line}`);
          if (effect.description) {
            output.push(`  ${effect.description}`);
          }
        });
        output.push('');
      });

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (error) {
      throw new Error(`Failed to list effects: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async batchAnalyze(args: { queries: Array<string | { query: string; operation?: string }> }) {
    const { queries } = args;

    try {
      const response = await fetch(`${this.apiBaseUrl}/analyze/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      const output = [
        `# 🔍 Batch Analysis Results`,
        '',
        `**Successful:** ${data.successful || data.results?.length || 0}`,
        `**Failed:** ${data.failed || data.errors?.length || 0}`,
        `**Total:** ${data.total || queries.length}`,
        '',
      ];

      if (data.results && data.results.length > 0) {
        output.push('## ✅ Successful Analyses');
        data.results.forEach((result: APIAnalysisResult, index: number) => {
          output.push(
            `### ${index + 1}. ${result.foundEffect.name}`,
            `**Type:** ${result.foundEffect.type} | **Risk:** ${result.riskLevel} | **Dependencies:** ${result.upstreamCount}↑ ${result.downstreamCount}↓`,
            `**Location:** ${result.foundEffect.filePath.split('/').pop()}:${result.foundEffect.line}`,
            ''
          );
        });
      }

      if (data.errors && data.errors.length > 0) {
        output.push('## ❌ Failed Analyses');
        data.errors.forEach((error: { query: string; error: string }, index: number) => {
          output.push(`${index + 1}. **Query:** ${error.query} - **Error:** ${error.error}`);
        });
      }

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (error) {
      throw new Error(`Failed to batch analyze: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getEffectDependencies(args: { query: string; include_transitive?: boolean }) {
    // This is essentially the same as analyze_effect but focused on dependencies
    const result = await this.analyzeEffect({ query: args.query, operation: 'analyze' });
    return result;
  }

  private async assessModificationRisk(args: { query: string; modification_type?: string }) {
    const result = await this.analyzeEffect({ query: args.query, operation: 'modify' });
    
    // Enhance with modification-specific guidance
    const originalText = result.content[0].text;
    const additionalGuidance = [
      '',
      '**🔬 Modification Risk Assessment:**',
      args.modification_type ? `**Modification Type:** ${args.modification_type}` : '',
      '**Recommended Actions:**',
      '1. Create comprehensive test coverage before changes',
      '2. Review all downstream dependents',
      '3. Consider backwards compatibility',
      '4. Plan gradual rollout if risk is high',
      '',
      '**Testing Strategy:**',
      '- Unit tests for the modified Effect',
      '- Integration tests with immediate dependencies',
      '- End-to-end tests for affected workflows',
    ].filter(Boolean);

    return {
      content: [{ type: 'text', text: originalText + '\n' + additionalGuidance.join('\n') }],
    };
  }

  private async analyzeFunctions(args: { targetDir: string; includeDetails?: boolean }) {
    const { targetDir, includeDetails = false } = args;

    try {
      // Call the analyzer directly instead of via API
      const { result: analysis, logs } = await analyzeFunctions(targetDir);
      // Logs are returned but not printed (no side effects)

      const output = [
        `# 📊 Function Analysis: ${targetDir}`,
        '',
        `**Analyzed at:** ${analysis.metadata.analyzedAt}`,
        `**Total Functions:** ${analysis.summary.totalFunctions}`,
        `**Total Folders:** ${analysis.metadata.totalFolders}`,
        `**Average Dependencies:** ${analysis.metadata.avgDependencies}`,
        '',
        '## 📈 Complexity Distribution',
        `- **Zero Dependencies:** ${analysis.summary.zeroDependencies} functions`,
        `- **Low (1-3 deps):** ${analysis.summary.lowComplexity} functions`,
        `- **Medium (4-9 deps):** ${analysis.summary.mediumComplexity} functions`,
        `- **High (10-19 deps):** ${analysis.summary.highComplexity} functions`,
        `- **Very High (20+ deps):** ${analysis.summary.veryHighComplexity} functions`,
        '',
        '## 📁 Folder Statistics',
      ];

      // Add folder statistics
      if (analysis.folderStats) {
        const folders = Object.entries(analysis.folderStats)
          .sort((a: [string, FolderStatistics], b: [string, FolderStatistics]) => b[1].totalFunctions - a[1].totalFunctions)
          .slice(0, 10);

        folders.forEach(([folder, stats]: [string, FolderStatistics]) => {
          output.push(
            `### ${folder}`,
            `- Functions: ${stats.totalFunctions}`,
            `- Avg Dependencies: ${stats.avgDependencies}`,
            `- Max Dependencies: ${stats.maxDependencies}`,
            `- High Complexity: ${stats.highComplexityFunctions.length}`,
            ''
          );
        });
      }

      // Add top complex functions
      if (analysis.topComplexFunctions && analysis.topComplexFunctions.length > 0) {
        output.push('## 🔥 Top Complex Functions');
        analysis.topComplexFunctions.slice(0, 10).forEach((func: TopComplexFunction, index: number) => {
          output.push(
            `${index + 1}. **${func.name}** (${func.file}:${func.lines})`,
            `   - Dependencies: ${func.callsCount}`,
            `   - Called by: ${func.calledByCount} functions`,
            ''
          );
        });
      }

      // Include detailed function list if requested
      if (includeDetails && analysis.functions) {
        output.push('## 📝 All Functions (Top 50 by complexity)');
        analysis.functions
          .sort((a: FunctionInfo, b: FunctionInfo) => b.callsCount - a.callsCount)
          .slice(0, 50)
          .forEach((func: FunctionInfo) => {
            output.push(
              `- **${func.name}** (${func.file}:${func.startLine}-${func.endLine})`,
              `  Calls: ${func.callsCount} | Called by: ${func.calledByCount}`,
              ''
            );
          });
      }

      return {
        content: [{ type: 'text', text: output.join('\n') }],
      };
    } catch (error) {
      throw new Error(`Failed to analyze functions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async startApiServer(args: { target_directory?: string; port?: number }) {
    const { target_directory, port = 3004 } = args;

    try {
      // Check if server is already running
      const healthResponse = await fetch(`http://localhost:${port}/api/health`);
      if (healthResponse.ok) {
        const health = await healthResponse.json();
        return {
          content: [
            {
              type: 'text',
              text: `✅ Effect Railway API server is already running on port ${port}\n\n**Target Directory:** ${health.targetDirectory}\n**Total Nodes:** ${health.totalNodes}\n**Status:** ${health.status}`,
            },
          ],
        };
      }
    } catch (error) {
      // Server not running, this is expected
    }

    // Instructions for starting the server
    const instructions = [
      '🚀 **Effect Railway API Server Setup**',
      '',
      'The API server is not currently running. To start it:',
      '',
      '**Option 1: From this directory**',
      '```bash',
      target_directory ? `ANALYSIS_TARGET_DIR="${target_directory}" npm run api` : 'npm run api',
      '```',
      '',
      '**Option 2: Direct execution**',
      '```bash',
      target_directory ? `ANALYSIS_TARGET_DIR="${target_directory}" tsx api-server.ts` : 'tsx api-server.ts',
      '```',
      '',
      '**Configuration:**',
      `- **Port:** ${port}`,
      `- **Target Directory:** ${target_directory || process.env.ANALYSIS_TARGET_DIR || 'default'}`,
      '',
      'Once started, you can use all Effect Railway MCP tools for analysis.',
    ];

    return {
      content: [{ type: 'text', text: instructions.join('\n') }],
    };
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Server Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Effect Railway MCP server running on stdio');
  }
}

const server = new EffectRailwayMCPServer();
server.run().catch(console.error);