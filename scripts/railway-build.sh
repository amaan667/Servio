#!/bin/bash

echo "🚂 Railway Build Script Starting..."
echo "=================================="

# Set error handling
set -e

echo "📁 Current directory: $(pwd)"
echo "📋 Directory contents:"
ls -la

echo "🧹 Cleaning build artifacts..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo

echo "📦 Checking for conflicting files..."
if [ -f "app" ]; then
    echo "❌ Found file named 'app' - removing it"
    rm -f app
fi

if [ -d "App" ]; then
    echo "❌ Found directory named 'App' - this might cause conflicts"
    ls -la App/
fi

echo "🔍 Checking app directory structure..."
if [ -d "app" ]; then
    echo "✅ app directory exists"
    echo "📋 app directory contents:"
    ls -la app/
else
    echo "❌ app directory missing!"
    exit 1
fi

echo "🔧 Running environment check..."
node scripts/railway-env-check.js

echo "🏗️ Starting Next.js build..."
echo "📊 Node version: $(node --version)"
echo "📊 pnpm version: $(pnpm --version)"

# Run the build with verbose output
pnpm build

echo "✅ Build completed successfully!"
echo "📋 Final .next directory contents:"
ls -la .next/

echo "🚀 Railway build script finished!"
