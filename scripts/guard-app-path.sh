#!/usr/bin/env bash
set -e

echo "[GUARD] Checking app directory integrity..."

# Check if app/ is a directory
if [ ! -d "app" ]; then
    echo "[GUARD] ERROR: app/ is not a directory!"
    
    # Check if there's a file named "app"
    if [ -f "app" ]; then
        echo "[GUARD] Found file named 'app' - removing it"
        rm -f app
    fi
    
    # Create app directory if it doesn't exist
    if [ ! -e "app" ]; then
        echo "[GUARD] Creating app/ directory"
        mkdir -p app
    fi
fi

# Verify app/ is now a directory
if [ -d "app" ]; then
    echo "[GUARD] ✅ app/ is correctly a directory"
else
    echo "[GUARD] ❌ Failed to ensure app/ is a directory"
    exit 1
fi

echo "[GUARD] App directory integrity check passed"
