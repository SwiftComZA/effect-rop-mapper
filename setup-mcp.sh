#!/bin/bash

# Effect Railway Visualizer MCP Setup Script

set -e

echo "🚄 Setting up Effect Railway Visualizer MCP Server"
echo ""

# Check if ANALYSIS_TARGET_DIR is provided
if [ -z "$1" ]; then
    echo "❌ Error: Please provide the target directory to analyze"
    echo "Usage: ./setup-mcp.sh /path/to/your/effect-ts-project/src"
    echo ""
    echo "Examples:"
    echo "  ./setup-mcp.sh ../my-effect-project/src"
    echo "  ./setup-mcp.sh /absolute/path/to/project/src"
    exit 1
fi

TARGET_DIR="$1"
ABS_TARGET_DIR=$(realpath "$TARGET_DIR")

# Validate target directory exists
if [ ! -d "$ABS_TARGET_DIR" ]; then
    echo "❌ Error: Target directory does not exist: $ABS_TARGET_DIR"
    exit 1
fi

echo "📁 Target directory: $ABS_TARGET_DIR"
echo ""

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔍 Running initial analysis..."
ANALYSIS_TARGET_DIR="$ABS_TARGET_DIR" npm run analyze

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo ""
echo "1. Add the following to your Claude Code MCP configuration:"
echo ""
echo "{"
echo "  \"mcpServers\": {"
echo "    \"effect-railway-visualizer\": {"
echo "      \"command\": \"tsx\","
echo "      \"args\": [\"mcp-server.ts\"],"
echo "      \"cwd\": \"$(pwd)\","
echo "      \"env\": {"
echo "        \"ANALYSIS_TARGET_DIR\": \"$ABS_TARGET_DIR\","
echo "        \"EFFECT_RAILWAY_API_URL\": \"http://localhost:3004/api\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo ""
echo "2. Start the API server (optional, for web UI and real-time analysis):"
echo "   ANALYSIS_TARGET_DIR=\"$ABS_TARGET_DIR\" npm run api"
echo ""
echo "3. Start the web visualization (optional):"
echo "   npm run dev"
echo ""
echo "🤖 Available MCP tools in Claude Code:"
echo "  - analyze_effect: Quick Effect analysis by name/file/partial match"
echo "  - list_effects: Get all Effects in the target codebase"
echo "  - batch_analyze: Analyze multiple Effects at once"
echo "  - get_effect_dependencies: Get upstream/downstream dependencies" 
echo "  - assess_modification_risk: Risk assessment for Effect modifications"
echo "  - start_api_server: Start the analysis API server"
echo ""