# TypeScript Function AST Analyzer

A comprehensive TypeScript function analyzer that extracts complete dependency information including function names, file locations, and line numbers for all dependencies.

## Features

- **Complete AST Analysis** - Extracts all functions with start/end line numbers
- **Full Dependency Mapping** - Shows actual function names, files, and line numbers
- **Bidirectional Tracking** - Both calls and calledBy relationships
- **Nested Folder Structure** - Functions organized by directory path
- **Complexity Categorization** - Groups functions by dependency count
- **Detailed Statistics** - Per-folder and overall codebase metrics

## Usage

```bash
# Analyze a specific directory
npm run analyze:functions /path/to/target/directory

# Or use environment variable
ANALYSIS_TARGET_DIR=/path/to/target npm run analyze:functions

# Example: Analyze backend source
ANALYSIS_TARGET_DIR=/Users/chrislemmer/Dev/SwiftCom/phil-chri-dev/backend/src npm run analyze:functions
```

## Output

Files are saved in the `output/` directory:
- `function-analysis-latest.json` - Always contains the most recent analysis
- `function-analysis-{parent}-{target}-{timestamp}.json` - Timestamped version for history

## Output Structure

```json
{
  "metadata": {
    "analyzedAt": "2025-08-15T05:36:33.187Z",
    "targetDirectory": "/path/to/target",
    "totalFunctions": 450,
    "totalFolders": 9,
    "avgDependencies": 2.8
  },
  "summary": {
    "totalFunctions": 450,
    "zeroDependencies": 274,
    "lowComplexity": 110,
    "mediumComplexity": 46,
    "highComplexity": 9,
    "veryHighComplexity": 11
  },
  "functions": [
    {
      "name": "functionName",
      "file": "path/to/file.ts",
      "startLine": 10,
      "endLine": 50,
      "calls": [
        {
          "name": "calledFunction",
          "file": "other/file.ts",
          "line": 25
        }
      ],
      "calledBy": [
        {
          "name": "callerFunction",
          "file": "another/file.ts",
          "line": 100
        }
      ]
    }
  ],
  "byPath": {
    "folder": {
      "file.ts": [...]
    }
  },
  "dependencyTree": {
    "zeroDependencies": [...],
    "lowComplexity": [...],
    "mediumComplexity": [...],
    "highComplexity": [...],
    "veryHighComplexity": [...]
  },
  "folderStats": {...},
  "topComplexFunctions": [...]
}
```

## Complexity Categories

- **Zero Dependencies**: Functions that don't call any other functions (leaf functions)
- **Low Complexity**: 1-3 dependencies
- **Medium Complexity**: 4-9 dependencies  
- **High Complexity**: 10-19 dependencies
- **Very High Complexity**: 20+ dependencies

## Example Analysis

```bash
# Run analysis
ANALYSIS_TARGET_DIR=/Users/chrislemmer/Dev/SwiftCom/phil-chri-dev/backend/src npm run analyze:functions

# Output:
# 🔍 Analyzing TypeScript functions in: /Users/chrislemmer/Dev/SwiftCom/phil-chri-dev/backend/src
# 📁 Found 29 TypeScript files to analyze
# 🔨 Pass 1: Collecting all functions...
# ✅ Found 450 functions
# 🔨 Pass 2: Analyzing function calls and dependencies...
# ✅ Analysis complete!
# 
# 📊 Analysis complete!
# 📁 Output saved to:
#    output/function-analysis-backend-src-2025-08-15T05-36-33.json
#    output/function-analysis-latest.json
#
# Summary:
#   Total functions: 450
#   Zero dependencies: 274
#   Low complexity (1-3): 110
#   Medium complexity (4-9): 46
#   High complexity (10-19): 9
#   Very high complexity (20+): 11
```

## Viewing Results

```bash
# View summary
cat output/function-analysis-latest.json | jq '.summary'

# View top complex functions
cat output/function-analysis-latest.json | jq '.topComplexFunctions[0:5]'

# View functions by folder
cat output/function-analysis-latest.json | jq '.folderStats'

# Find specific function
cat output/function-analysis-latest.json | jq '.functions[] | select(.name == "functionName")'
```