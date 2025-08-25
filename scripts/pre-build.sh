#!/usr/bin/env bash
set -euo pipefail

echo "[PRE-BUILD] Starting pre-build setup..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Clean any existing build artifacts
echo "[PRE-BUILD] Cleaning build artifacts..."
rm -rf .next
rm -f .env.production
rm -f .env.local

# Handle potential directory conflicts
echo "[PRE-BUILD] Checking for directory conflicts..."

# If 'app' exists as a file, remove it
if [ -f app ]; then
  echo "[PRE-BUILD] Found 'app' as a file, removing it..."
  rm -f app
fi

# If 'app' doesn't exist as a directory, create it (for Nixpacks)
if [ ! -d app ]; then
  echo "[PRE-BUILD] Creating app directory for Nixpacks compatibility..."
  mkdir -p app
fi

# Ensure src/app exists
if [ ! -d src/app ]; then
  echo "[PRE-BUILD] Creating src/app directory..."
  mkdir -p src/app
fi

# Copy any necessary files from src/app to app if needed
if [ -d src/app ] && [ "$(ls -A src/app 2>/dev/null)" ]; then
  echo "[PRE-BUILD] Ensuring app directory has necessary files..."
  cp -r src/app/* app/ 2>/dev/null || true
fi

echo "[PRE-BUILD] Pre-build setup complete"
