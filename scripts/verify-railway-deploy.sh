#!/bin/bash

# Railway Deployment Verification Script
# This script helps verify Railway deployment status and provides troubleshooting steps

echo "=========================================="
echo "Railway Deployment Verification"
echo "=========================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI is not installed"
    echo ""
    echo "To install Railway CLI:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Then login:"
    echo "  railway login"
    echo ""
    exit 1
fi

echo "✅ Railway CLI is installed"
echo ""

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway"
    echo ""
    echo "Please login:"
    echo "  railway login"
    echo ""
    exit 1
fi

echo "✅ Logged in to Railway"
echo ""

# List projects
echo "📋 Your Railway Projects:"
echo ""
railway project list
echo ""

# Get current project
CURRENT_PROJECT=$(railway project 2>/dev/null | grep -oP '(?<=Project: ).*' || echo "")
if [ -z "$CURRENT_PROJECT" ]; then
    echo "⚠️  No project is currently selected"
    echo ""
    echo "To select a project:"
    echo "  railway project link"
    echo ""
    exit 1
fi

echo "✅ Current project: $CURRENT_PROJECT"
echo ""

# List services
echo "📋 Services in current project:"
echo ""
railway services
echo ""

# Get service name from environment variable or prompt
SERVICE_NAME=${RAILWAY_SERVICE_NAME:-""}
if [ -z "$SERVICE_NAME" ]; then
    echo "⚠️  RAILWAY_SERVICE_NAME environment variable not set"
    echo ""
    echo "Please set it:"
    echo "  export RAILWAY_SERVICE_NAME=<your-service-name>"
    echo ""
    echo "Or pass it as an argument:"
    echo "  ./scripts/verify-railway-deploy.sh <service-name>"
    echo ""
    exit 1
fi

echo "✅ Service name: $SERVICE_NAME"
echo ""

# Check service status
echo "📊 Service Status:"
echo ""
railway status --service "$SERVICE_NAME" 2>/dev/null || echo "Could not get service status"
echo ""

# Check recent deployments
echo "📜 Recent Deployments:"
echo ""
railway deployments --service "$SERVICE_NAME" 2>/dev/null || echo "Could not get deployments"
echo ""

# Check environment variables
echo "🔧 Environment Variables:"
echo ""
railway variables --service "$SERVICE_NAME" 2>/dev/null || echo "Could not get variables"
echo ""

echo "=========================================="
echo "GitHub Actions Deployment Setup"
echo "=========================================="
echo ""
echo "To enable automatic Railway deployment via GitHub Actions:"
echo ""
echo "1. Go to your GitHub repository settings:"
echo "   https://github.com/amaan667/Servio/settings/secrets/actions"
echo ""
echo "2. Add the following secrets:"
echo ""
echo "   RAILWAY_TOKEN:"
echo "     - Get it from: https://railway.app/account/tokens"
echo "     - Create a new token and copy it"
echo ""
echo "   RAILWAY_SERVICE_NAME:"
echo "     - The name of your Railway service (e.g., 'servio-web')"
echo "     - You can find it by running: railway services"
echo ""
echo "3. Push to main branch to trigger deployment"
echo ""
echo "=========================================="
echo "Manual Deployment"
echo "=========================================="
echo ""
echo "To deploy manually:"
echo "  railway up --service=$SERVICE_NAME"
echo ""
echo "=========================================="
