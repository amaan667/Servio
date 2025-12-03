#!/bin/bash
# Script to disable Railway Metal builds via Railway CLI
# Metal builds are not ready for production and should be disabled

set -e

echo "🔧 Disabling Railway Metal Builds..."
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed."
    echo "   Install it with: npm i -g @railway/cli"
    exit 1
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway."
    echo "   Run: railway login"
    exit 1
fi

echo "📋 Current Railway projects:"
railway status

echo ""
echo "⚠️  IMPORTANT: Metal builds must be disabled manually in Railway Dashboard:"
echo ""
echo "   1. Go to Railway Dashboard: https://railway.app"
echo "   2. Select your project"
echo "   3. Go to Settings > Build"
echo "   4. Disable 'Metal Builds' toggle"
echo "   5. Save settings"
echo ""
echo "   Metal builds cannot be disabled via CLI - it's a dashboard-only setting."
echo ""
echo "✅ Make sure 'Metal Builds' is OFF in Railway Dashboard Settings > Build"
echo ""

# Try to get project info
PROJECT_ID=$(railway status --json 2>/dev/null | grep -o '"projectId":"[^"]*' | cut -d'"' -f4 || echo "")

if [ -n "$PROJECT_ID" ]; then
    echo "📌 Project ID: $PROJECT_ID"
    echo "   Dashboard URL: https://railway.app/project/$PROJECT_ID/settings/build"
else
    echo "⚠️  Could not detect project ID. Please check manually."
fi

echo ""
echo "💡 Tip: Railway will skip deployments if Metal builds are enabled but not ready."
echo "   Disabling Metal builds ensures standard builds are used."
