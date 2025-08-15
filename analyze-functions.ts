#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { analyzeFunctions } from './src/analyzer/function-analyzer-pure';

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

async function main() {
  const targetDir = process.argv[2] || process.env.ANALYSIS_TARGET_DIR || './src';
  const resolvedDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`❌ Error: Target directory does not exist: ${resolvedDir}`);
    process.exit(1);
  }

  // Run the analyzer
  const { result: output } = await analyzeFunctions(resolvedDir);

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
}

// Run main function
main().catch(error => {
  console.error(`❌ Error: ${error.message}`);
  process.exit(1);
});