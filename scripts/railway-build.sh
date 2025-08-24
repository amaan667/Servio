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

echo "📦 Checking for conflicting files and directories..."
# Check for any files that might conflict with directories
if [ -f "app" ]; then
    echo "❌ Found file named 'app' - removing it"
    rm -f app
fi

if [ -f "App" ]; then
    echo "❌ Found file named 'App' - removing it"
    rm -f App
fi

if [ -f "APP" ]; then
    echo "❌ Found file named 'APP' - removing it"
    rm -f APP
fi

# Check for problematic directories
if [ -d "App" ]; then
    echo "⚠️ Found directory named 'App' - this might cause conflicts"
    echo "📋 App directory contents:"
    ls -la App/
fi

if [ -d "APP" ]; then
    echo "⚠️ Found directory named 'APP' - this might cause conflicts"
    echo "📋 APP directory contents:"
    ls -la APP/
fi

echo "🔍 Checking app directory structure..."
if [ -d "app" ]; then
    echo "✅ app directory exists"
    echo "📋 app directory contents:"
    ls -la app/
    
    # Check if app is actually a directory and not a symlink
    if [ -L "app" ]; then
        echo "⚠️ app is a symlink - resolving..."
        ls -la app
    fi
else
    echo "❌ app directory missing!"
    exit 1
fi

echo "🔧 Running environment check..."
node scripts/railway-env-check.js

echo "🏗️ Starting Next.js build..."
echo "📊 Node version: $(node --version)"
echo "📊 pnpm version: $(pnpm --version)"

# Ensure we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ package.json not found in current directory!"
    exit 1
fi

# Run the build with verbose output
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

echo "🏗️ Building application..."
pnpm build

echo "✅ Build completed successfully!"
echo "📋 Final .next directory contents:"
if [ -d ".next" ]; then
    ls -la .next/
else
    echo "❌ .next directory not found after build!"
    exit 1
fi

echo "🚀 Railway build script finished!"
