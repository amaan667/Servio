#!/bin/bash

# Quick Deploy - No tests, just build and deploy
echo "🚀 Quick Deploy - Building and deploying..."

# Build
echo "📦 Building..."
npm run build

# Deploy
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo ""
echo "Monitor logs: railway logs --follow"
echo "Check health: curl https://your-domain.com/api/health"

