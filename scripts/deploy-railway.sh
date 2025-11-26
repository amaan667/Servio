#!/bin/bash
# Railway deployment script that forces deployment
# This script ensures deployments are not skipped by:
# 1. Updating a deployment trigger file to ensure Railway detects changes
# 2. Using Railway CLI which bypasses "Wait for CI" setting
# 3. Forcing a new deployment even if Railway thinks nothing changed

set -e

echo "🚀 Starting Railway deployment..."

# Update deployment trigger file with timestamp and commit hash to force a new deployment
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
DEPLOY_ID=$(date +%s)

echo "# Railway deployment trigger - $TIMESTAMP" > .railway-deploy
echo "# Commit: $COMMIT_HASH" >> .railway-deploy
echo "# Deploy ID: $DEPLOY_ID" >> .railway-deploy

# Stage the trigger file
git add .railway-deploy

# Commit if there are changes (this ensures git push will trigger deployment too)
if ! git diff --cached --quiet; then
  git commit -m "Trigger Railway deployment - $TIMESTAMP [Deploy ID: $DEPLOY_ID]" || true
  echo "📝 Committed deployment trigger file"
fi

# Deploy using Railway CLI with detach to prevent blocking
# Note: railway up bypasses "Wait for CI" setting and forces a deployment
echo "📦 Uploading to Railway (this bypasses 'Wait for CI' setting)..."
railway up --detach

echo ""
echo "✅ Deployment initiated successfully!"
echo "🔗 Build logs: https://railway.com/project/e6c4e838-04f0-4f31-b884-5768f9354ee4/service/ff79c439-caf4-4f83-8f90-ee90c7692959"
echo "📊 Check Railway dashboard for deployment status"

