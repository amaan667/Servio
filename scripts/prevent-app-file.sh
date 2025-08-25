#!/usr/bin/env bash
set -e

echo "[PREVENT-APP] Checking for conflicting app file..."

# Check if there's a file named "app" in the root directory
if [ -f "app" ]; then
    echo "[PREVENT-APP] Found file named 'app' - removing it"
    rm -f app
fi

# Check if there's a directory named "app" in the root directory (shouldn't exist after our fix)
if [ -d "app" ]; then
    echo "[PREVENT-APP] Found directory named 'app' - removing it"
    rm -rf app
fi

# Check if there are any symlinks named "app"
if [ -L "app" ]; then
    echo "[PREVENT-APP] Found symlink named 'app' - removing it"
    rm -f app
fi

# Ensure the dist directory exists and is clean
echo "[PREVENT-APP] Ensuring dist directory is ready..."
if [ ! -d "dist" ]; then
    mkdir -p dist
fi

# Remove any existing .next directory to ensure clean build
if [ -d ".next" ]; then
    echo "[PREVENT-APP] Removing existing .next directory for clean build"
    rm -rf .next
fi

echo "[PREVENT-APP] No conflicting app file/directory found"
echo "[PREVENT-APP] Build environment is clean"
