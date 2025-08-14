# 🚄 Effect Railway Visualizer

> **Railway Oriented Programming (ROP) Mapper for Effect TS** - A comprehensive toolkit for visualizing, analyzing, and managing Effect TS dependencies in complex codebases.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6+-blue.svg)](https://www.typescriptlang.org/)
[![Effect TS](https://img.shields.io/badge/Effect-TS-ff6b6b.svg)](https://effect.website/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![API](https://img.shields.io/badge/API-HTTP-orange.svg)](#api-endpoints)

## 📋 Overview

The Effect Railway Visualizer is a powerful development tool that analyzes TypeScript codebases using Effect TS patterns and provides:

- **📊 Visual Railway Maps** - Interactive D3.js visualizations of Effect flow
- **🎯 LLM-Ready Analysis** - AI-optimized dependency reports and modification guides  
- **🔍 Smart Effect Discovery** - Find Effects by name, file:line, or partial match
- **⚡ Real-time API** - HTTP endpoints with auto-refresh for live codebase analysis
- **🧮 Impact Calculator** - Mathematical dependency resolution with risk assessment

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- TypeScript 5.6+
- Effect TS project (target codebase to analyze)

### Installation

```bash
git clone https://github.com/SwiftComZA/effect-rop-mapper.git
cd effect-rop-mapper
npm install
```

### Running the System

```bash
# Start the visualization UI (http://localhost:3002)
npm run dev

# Start the API server (http://localhost:3004)  
npm run api

# Run both simultaneously
npm run start:all
```

### Analyze Your Codebase

```bash
# Run AST analysis on your Effect TS project
npm run analyze
```

## 🎯 Core Features

### 1. **Interactive Railway Visualization**

Visual representation of Effect TS patterns using Railway Oriented Programming principles:

- **Request Flow Mapping** - HTTP Entry → Middleware → Business Logic → Data Access
- **Dependency Chains** - Complete transitive dependency visualization
- **Error Flow Tracking** - Error propagation paths and handling
- **Layer Organization** - Controllers, Services, Repositories, Workers, Utilities

### 2. **LLM-Optimized Analysis**

Perfect for AI-assisted development:

```typescript
// Browser/Console Usage
analyzeEffect("LoggerService")      // Quick analysis
modifyEffect("DatabaseService")     // Modification guidance  
useEffect("JournalistsRepository")  // Usage patterns
```

### 3. **HTTP API for Integration**

RESTful endpoints for programmatic access:

```bash
# Quick effect analysis
curl "http://localhost:3004/api/analyze?query=LoggerService"

# Get all effects in codebase
curl "http://localhost:3004/api/effects"

# Batch analysis
curl -X POST http://localhost:3004/api/analyze/batch \
  -H "Content-Type: application/json" \
  -d '{"queries": ["LoggerService", "DatabaseService"]}'
```

### 4. **Smart Effect Discovery**

Multiple ways to find Effects:

- **Exact name**: `"getUserById"`
- **File location**: `"users.ts:142"`  
- **Partial match**: `"User"` or `"Repository"`
- **Type filtering**: Controllers, Services, Repositories, etc.

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | System health check |
| `GET` | `/api/effects` | List all discovered Effects |
| `GET` | `/api/analyze?query=<name>` | Analyze specific Effect |
| `POST` | `/api/analyze` | Advanced analysis with context |
| `POST` | `/api/analyze/batch` | Batch analyze multiple Effects |

### API Response Example

```json
{
  "foundEffect": {
    "name": "LoggerService",
    "type": "service", 
    "filePath": "/src/services/logger.ts",
    "line": 15
  },
  "upstreamCount": 17,
  "downstreamCount": 0,
  "riskLevel": "high",
  "upstreamNodes": [...],
  "downstreamNodes": [...],
  "lastAnalysis": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Configuration

### Auto-Refresh Analysis

The API automatically refreshes codebase analysis:

- **Auto-refresh**: Every 30 seconds (cached)
- **Force refresh**: Add `?refresh=force` or `"refresh": "force"`
- **Analysis timeout**: 30 seconds max

### Environment Setup

1. **Target Codebase**: Place analyzer in your Effect TS project root
2. **Analysis Scope**: Modify `src/crawler/ast-analyzer.ts` for custom file patterns
3. **Port Configuration**: Update `vite.config.ts` and `api-server.js` for custom ports

## 🎨 Architecture

```
effect-rop-mapper/
├── src/
│   ├── crawler/          # AST analysis and Effect discovery
│   ├── visualization/    # D3.js railway rendering
│   ├── calculator/       # Dependency math and impact analysis
│   ├── export/          # LLM-ready report generation
│   └── types/           # TypeScript interfaces
├── api-server.js        # HTTP API with auto-refresh
└── index.html          # Interactive dashboard
```

### Core Components

- **AST Analyzer** - Parses TypeScript AST to discover Effect patterns
- **Railway Renderer** - D3.js visualization with interactive dependency highlighting  
- **Targeted Calculator** - Fast Effect lookup and impact analysis
- **LLM Tree Generator** - AI-optimized dependency reports
- **Effect Calculator** - Mathematical dependency resolution

## 🤖 LLM Integration

Perfect for AI-assisted Effect TS development:

### Quick Queries
```javascript
// Find and analyze any Effect instantly
analyzeEffect("SearchRepository")

// Get modification guidance
modifyEffect("UserService", "I want to add caching")

// Generate usage patterns
useEffect("DatabaseService", "in a new controller")
```

### API Integration
```python
# Python example for LLM tools
import requests

def analyze_effect(effect_name):
    response = requests.get(f"http://localhost:3004/api/analyze?query={effect_name}")
    return response.json()

# Get instant dependency analysis
result = analyze_effect("LoggerService")
print(f"Risk Level: {result['riskLevel']}")
print(f"Dependencies: {result['upstreamCount']}")
```

## 📈 Use Cases

### 1. **Code Reviews**
- Visualize impact of proposed changes
- Identify breaking change risks
- Generate comprehensive dependency reports

### 2. **Refactoring Planning**  
- Map transitive dependencies before changes
- Calculate modification effort estimates
- Find safe refactoring boundaries

### 3. **New Developer Onboarding**
- Interactive codebase exploration
- Effect pattern learning and discovery
- Architecture understanding through visualization

### 4. **AI-Assisted Development**
- LLM-ready analysis reports
- Automated dependency resolution
- Intelligent modification suggestions

## 🛠️ Development

### Project Structure

The visualizer uses a **functional-first TypeScript architecture** following Effect TS patterns:

```typescript
// Example: Effect Calculator usage
const calculator = new EffectCalculator(analysisData);
const result = calculator.calculateNewEffect({
  name: 'enhancedUserService',
  targetLayer: 'service',
  requiredCapabilities: ['user-creation', 'validation'],
  integrateWithExisting: ['UserRepository', 'LoggerService']
});
```

### Adding Custom Analysis

1. **Extend AST Analyzer**: Add custom Effect pattern detection
2. **Create Calculators**: Build domain-specific dependency resolvers  
3. **Add Visualizations**: Implement custom D3.js renderers
4. **Export Formats**: Generate LLM-optimized reports

### Testing

```bash
# Run type checking
npm run build

# Test API endpoints
curl "http://localhost:3004/api/health"

# Validate analysis output
npm run analyze
```

## 🔒 Security & Privacy

- **No credentials stored** - Pure static analysis tool
- **Local processing** - All analysis happens locally
- **Auto-generated data excluded** - Sensitive paths in `.gitignore`
- **Public repository safe** - No hardcoded secrets or private information

## 📚 Effect TS Patterns Supported

- ✅ **Context.Tag** services and dependencies
- ✅ **Effect.gen** function patterns  
- ✅ **Layer** composition and provision
- ✅ **Error types** and error handling
- ✅ **Runtime** and Effect execution
- ✅ **Pipe operations** and chaining
- ✅ **Service interfaces** and implementations

## 🤝 Contributing

Contributions welcome! This tool is designed to help the Effect TS community visualize and understand complex dependency relationships.

### Areas for Enhancement

- Custom visualization themes
- Additional export formats (Mermaid, PlantUML)
- Integration with popular IDEs
- Advanced dependency cycle detection
- Performance optimization for large codebases

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Effect TS Documentation](https://effect.website/)
- [Railway Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [D3.js Visualization Library](https://d3js.org/)
- [TypeScript AST Processing](https://github.com/microsoft/TypeScript)

---

**Built for the Effect TS community** 🚄⚡

*Transform your Effect TS codebase understanding with visual dependency mapping and AI-ready analysis.*