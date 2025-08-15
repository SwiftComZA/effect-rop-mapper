/**
 * Purpose: File IO operations separated from pure analysis logic
 * Dependencies: fs, path, TypeScript Compiler API
 * 
 * Example Input:
 * ```
 * loadSourceFiles("../backend/src")
 * ```
 * 
 * Expected Output:
 * ```
 * Array of SourceFileInput objects ready for pure analysis
 * ```
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import type { SourceFileInput } from './ast-analyzer-pure.js';

// IO function to find TypeScript files
export const findTypeScriptFiles = (dir: string): string[] => {
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
};

// IO function to load a source file
export const loadSourceFile = async (filePath: string): Promise<SourceFileInput | null> => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );
    
    return {
      path: filePath,
      content,
      sourceFile
    };
  } catch (error) {
    console.warn(`Failed to load file ${filePath}:`, error);
    return null;
  }
};

// IO function to load all source files from a path
export const loadSourceFiles = async (rootPath: string): Promise<SourceFileInput[]> => {
  const filePaths = findTypeScriptFiles(rootPath);
  const sourceFiles: SourceFileInput[] = [];
  
  for (const filePath of filePaths) {
    const sourceFile = await loadSourceFile(filePath);
    if (sourceFile) {
      sourceFiles.push(sourceFile);
    }
  }
  
  return sourceFiles;
};

// IO function to save analysis result
export const saveAnalysisResult = (result: any, outputPath: string): void => {
  const json = JSON.stringify(result, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');
};

// IO function to load analysis result
export const loadAnalysisResult = (inputPath: string): any => {
  const json = fs.readFileSync(inputPath, 'utf-8');
  return JSON.parse(json);
};