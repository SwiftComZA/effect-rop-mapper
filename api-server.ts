/**
 * Purpose: HTTP API server for Targeted Effect Calculator
 * Dependencies: Express, CORS, TargetedEffectCalculator
 * 
 * Example Input:
 * ```
 * GET /api/analyze?query=LoggerService
 * POST /api/analyze { "query": "getUserById", "operation": "modify" }
 * ```
 * 
 * Expected Output:
 * ```
 * JSON response with effect analysis
 * ```
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';
import type { AnalysisResult, EffectNode } from './src/types/effect-node.js';
import { FunctionAnalyzer } from './src/analyzer/function-analyzer.js';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const execAsync = promisify(exec);

const app = express();
const PORT = process.env.PORT || 3004;

// Configuration from environment variables
const ANALYSIS_TARGET_DIR = process.env.ANALYSIS_TARGET_DIR || __dirname;
const ANALYSIS_CACHE_MS = parseInt(process.env.ANALYSIS_CACHE_MS) || 30000;

// Middleware
app.use(cors());
app.use(express.json());

// Type definitions for API
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

interface BatchAnalysisRequest {
  queries: Array<string | { query: string; operation?: string }>;
}

interface AnalyzeRequest {
  query: string;
  operation?: string;
  context?: string;
  refresh?: 'auto' | 'force';
}

// Load sample data (in production, this would come from the actual analysis)
let analysisData: AnalysisResult | null = null;
let lastAnalysisTime = 0;

async function refreshAnalysisData(force = false) {
  const now = Date.now();
  if (!force && analysisData && (now - lastAnalysisTime) < ANALYSIS_CACHE_MS) {
    console.log('📋 Using cached analysis data');
    return analysisData;
  }

  console.log(`🔄 Refreshing codebase analysis for: ${ANALYSIS_TARGET_DIR}`);
  try {
    // Run the AST analyzer to get fresh data
    const analyzeCommand = `npx tsx src/crawler/ast-analyzer.ts "${ANALYSIS_TARGET_DIR}"`;
    const { stdout, stderr } = await execAsync(analyzeCommand, {
      cwd: __dirname,
      timeout: 30000 // 30 second timeout
    });
    
    if (stderr) {
      console.warn('⚠️ Analysis warnings:', stderr);
    }
    
    // Try to load the newly generated data
    const dataPath = path.join(__dirname, 'src/data/railway-data.json');
    if (fs.existsSync(dataPath)) {
      const newData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      analysisData = newData;
      lastAnalysisTime = now;
      console.log(`✅ Refreshed analysis data: ${newData.railway?.nodes?.length || 0} nodes, ${newData.railway?.edges?.length || 0} edges`);
      return analysisData;
    }
  } catch (error) {
    console.warn('⚠️ Failed to refresh analysis, using cached/sample data:', error.message);
  }
  
  // If no data available, throw error
  if (!analysisData) {
    throw new Error(`No analysis data available. Please run: ANALYSIS_TARGET_DIR="${ANALYSIS_TARGET_DIR}" npm run analyze`);
  }
  
  return analysisData;
}

function loadAnalysisData() {
  try {
    // Try to load from generated file first
    const dataPath = path.join(__dirname, 'src/data/railway-data.json');
    if (fs.existsSync(dataPath)) {
      analysisData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      lastAnalysisTime = Date.now();
      console.log('✅ Loaded railway data from file');
    } else {
      console.warn(`⚠️ No analysis data found at ${dataPath}`);
      console.warn(`Please run: ANALYSIS_TARGET_DIR="${ANALYSIS_TARGET_DIR}" npm run analyze`);
      analysisData = null;
    }
  } catch (error) {
    console.error('❌ Failed to load data:', error);
    analysisData = null;
  }
}

// Sample data removed - only real analysis data from target directory is used

// Simple TargetedEffectCalculator implementation for API
class APITargetedEffectCalculator {
  constructor(analysisData) {
    this.nodes = new Map();
    this.nodesByName = new Map();
    this.dependencyGraph = new Map();
    this.reverseGraph = new Map();
    this.analysis = analysisData;
    this.buildLookupMaps();
  }

  buildLookupMaps() {
    this.analysis.railway.nodes.forEach(node => {
      this.nodes.set(node.id, node);
      
      // Index by name variations
      const names = [
        node.name,
        node.name.toLowerCase(),
        node.name.replace(/\s+/g, ''),
        node.name.replace(/[^a-zA-Z0-9]/g, '')
      ];
      
      names.forEach(name => {
        if (!this.nodesByName.has(name)) {
          this.nodesByName.set(name, []);
        }
        this.nodesByName.get(name).push(node);
      });
    });

    // Build dependency graphs
    this.analysis.railway.edges.forEach(edge => {
      if (!this.dependencyGraph.has(edge.target)) {
        this.dependencyGraph.set(edge.target, new Set());
      }
      this.dependencyGraph.get(edge.target).add(edge.source);

      if (!this.reverseGraph.has(edge.source)) {
        this.reverseGraph.set(edge.source, new Set());
      }
      this.reverseGraph.get(edge.source).add(edge.target);
    });
  }

  findEffect(query) {
    // Try exact name match first
    const exactMatches = this.nodesByName.get(query) || this.nodesByName.get(query.toLowerCase());
    if (exactMatches && exactMatches.length > 0) {
      return exactMatches[0];
    }

    // Try partial match
    for (const [name, nodes] of this.nodesByName.entries()) {
      if (name.includes(query.toLowerCase()) || query.toLowerCase().includes(name)) {
        return nodes[0];
      }
    }

    return null;
  }

  analyzeEffect(query, operation = 'analyze') {
    const foundEffect = this.findEffect(query);
    if (!foundEffect) {
      throw new Error(`Effect not found: ${query}`);
    }

    const upstream = this.getAllUpstream(foundEffect.id);
    const downstream = this.getAllDownstream(foundEffect.id);
    
    return {
      foundEffect,
      upstreamCount: upstream.length,
      downstreamCount: downstream.length,
      upstreamNodes: upstream.map(id => this.nodes.get(id)).filter(Boolean),
      downstreamNodes: downstream.map(id => this.nodes.get(id)).filter(Boolean),
      riskLevel: this.calculateRisk(upstream.length, downstream.length, foundEffect),
      operation,
      timestamp: new Date().toISOString()
    };
  }

  getAllUpstream(nodeId) {
    const visited = new Set();
    const upstream = [];
    
    const traverse = (currentId) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const dependencies = this.dependencyGraph.get(currentId) || new Set();
      for (const depId of dependencies) {
        upstream.push(depId);
        traverse(depId);
      }
    };
    
    traverse(nodeId);
    return upstream;
  }

  getAllDownstream(nodeId) {
    const visited = new Set();
    const downstream = [];
    
    const traverse = (currentId) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      
      const dependents = this.reverseGraph.get(currentId) || new Set();
      for (const depId of dependents) {
        downstream.push(depId);
        traverse(depId);
      }
    };
    
    traverse(nodeId);
    return downstream;
  }

  calculateRisk(upstreamCount, downstreamCount, node) {
    if (node.type === 'controller' || upstreamCount + downstreamCount > 10) return 'high';
    if (upstreamCount + downstreamCount > 5 || node.type === 'service') return 'medium';
    return 'low';
  }

  listAllEffects() {
    return this.analysis.railway.nodes.map(node => ({
      id: node.id,
      name: node.name,
      type: node.type,
      filePath: node.filePath,
      line: node.line,
      description: node.description
    }));
  }
}

// Initialize calculator
let calculator = null;

// API Routes

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    dataLoaded: !!analysisData,
    totalNodes: analysisData?.railway?.nodes?.length || 0,
    targetDirectory: ANALYSIS_TARGET_DIR
  });
});

// List all effects
app.get('/api/effects', async (req, res) => {
  try {
    // Refresh data before listing
    const freshData = await refreshAnalysisData();
    calculator = new APITargetedEffectCalculator(freshData);
    
    const effects = calculator.listAllEffects();
    res.json({
      effects,
      total: effects.length,
      timestamp: new Date().toISOString(),
      lastAnalysis: new Date(lastAnalysisTime).toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Analyze specific effect (GET)
app.get('/api/analyze', async (req, res) => {
  try {
    const { query, operation = 'analyze', refresh = 'auto' } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    // Refresh data before analysis
    const forceRefresh = refresh === 'force';
    const freshData = await refreshAnalysisData(forceRefresh);
    calculator = new APITargetedEffectCalculator(freshData);

    const result = calculator.analyzeEffect(query, operation);
    result.lastAnalysis = new Date(lastAnalysisTime).toISOString();
    res.json(result);
  } catch (error) {
    res.status(404).json({ 
      error: error.message,
      suggestions: [
        'Try exact Effect name: "LoggerService"',
        'Try partial match: "Logger" or "Service"',
        'Check /api/effects for available Effect names',
        'Add ?refresh=force to force refresh analysis'
      ]
    });
  }
});

// Analyze specific effect (POST) 
app.post('/api/analyze', async (req, res) => {
  try {
    const { query, operation = 'analyze', context, refresh = 'auto' } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query field is required' });
    }
    
    // Refresh data before analysis
    const forceRefresh = refresh === 'force';
    const freshData = await refreshAnalysisData(forceRefresh);
    calculator = new APITargetedEffectCalculator(freshData);

    const result = calculator.analyzeEffect(query, operation);
    if (context) {
      result.context = context;
    }
    result.lastAnalysis = new Date(lastAnalysisTime).toISOString();
    res.json(result);
  } catch (error) {
    res.status(404).json({ 
      error: error.message,
      suggestions: [
        'Try exact Effect name: "LoggerService"',
        'Try partial match: "Logger" or "Service"',  
        'Check /api/effects for available Effect names',
        'Add "refresh": "force" to force refresh analysis'
      ]
    });
  }
});

// Analyze functions in a directory
app.post('/api/analyze/functions', async (req, res) => {
  try {
    const { targetDir } = req.body;
    
    if (!targetDir) {
      return res.status(400).json({ error: 'targetDir field is required' });
    }
    
    const resolvedDir = path.resolve(targetDir);
    
    if (!fs.existsSync(resolvedDir)) {
      return res.status(400).json({ error: `Directory does not exist: ${resolvedDir}` });
    }
    
    console.log(`🔍 Starting function analysis for: ${resolvedDir}`);
    const analyzer = new FunctionAnalyzer(resolvedDir);
    const result = await analyzer.analyze();
    
    res.json({
      success: true,
      analysis: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Function analysis error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to analyze functions in the specified directory'
    });
  }
});

// Get function analysis for current target directory
app.get('/api/analyze/functions', async (req, res) => {
  try {
    const targetDir = req.query.targetDir || ANALYSIS_TARGET_DIR;
    const resolvedDir = path.resolve(targetDir);
    
    if (!fs.existsSync(resolvedDir)) {
      return res.status(400).json({ error: `Directory does not exist: ${resolvedDir}` });
    }
    
    console.log(`🔍 Starting function analysis for: ${resolvedDir}`);
    const analyzer = new FunctionAnalyzer(resolvedDir);
    const result = await analyzer.analyze();
    
    res.json({
      success: true,
      analysis: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Function analysis error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Failed to analyze functions in the specified directory'
    });
  }
});

// Batch analyze multiple effects
app.post('/api/analyze/batch', (req, res) => {
  try {
    const { queries } = req.body;
    
    if (!Array.isArray(queries)) {
      return res.status(400).json({ error: 'Queries must be an array' });
    }

    if (!calculator) {
      return res.status(500).json({ error: 'Calculator not initialized' });
    }

    const results = [];
    const errors = [];

    queries.forEach(queryItem => {
      try {
        const query = typeof queryItem === 'string' ? queryItem : queryItem.query;
        const operation = typeof queryItem === 'object' ? queryItem.operation || 'analyze' : 'analyze';
        
        const result = calculator.analyzeEffect(query, operation);
        results.push(result);
      } catch (error) {
        errors.push({ query: queryItem, error: error.message });
      }
    });

    res.json({
      results,
      errors,
      total: queries.length,
      successful: results.length,
      failed: errors.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Effect Railway API Server running at http://localhost:${PORT}`);
  console.log('📊 Available endpoints:');
  console.log('  GET  /api/health         - Health check');
  console.log('  GET  /api/effects        - List all effects');
  console.log('  GET  /api/analyze?query=<name> - Analyze effect (GET)');
  console.log('  POST /api/analyze        - Analyze effect (POST)');
  console.log('  POST /api/analyze/batch  - Batch analyze effects');
  console.log('  GET  /api/analyze/functions - Analyze functions in target directory');
  console.log('  POST /api/analyze/functions - Analyze functions with custom directory');
  console.log('');
  console.log('🎯 Example queries:');
  console.log('  curl "http://localhost:3004/api/analyze?query=LoggerService"');
  console.log('  curl "http://localhost:3004/api/analyze?query=journalists"');
  console.log('  curl "http://localhost:3004/api/effects"');
  
  // Initialize data and calculator
  loadAnalysisData();
  calculator = new APITargetedEffectCalculator(analysisData);
  console.log('✅ API server ready!');
});