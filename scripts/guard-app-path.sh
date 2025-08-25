#!/usr/bin/env bash
set -e

echo "[GUARD] Checking src/app directory integrity..."

# Check if src/app/ is a directory
if [ ! -d "src/app" ]; then
    echo "[GUARD] ERROR: src/app/ is not a directory!"
    
    # Check if there's a file named "src/app"
    if [ -f "src/app" ]; then
        echo "[GUARD] Found file named 'src/app' - removing it"
        rm -f src/app
    fi
    
    # Create src/app directory if it doesn't exist
    if [ ! -e "src/app" ]; then
        echo "[GUARD] Creating src/app/ directory"
        mkdir -p src/app
    fi
fi

# Verify src/app/ is now a directory
if [ -d "src/app" ]; then
    echo "[GUARD] ✅ src/app/ is correctly a directory"
else
    echo "[GUARD] ❌ Failed to ensure src/app/ is a directory"
    exit 1
fi

echo "[GUARD] src/app directory integrity check passed"
