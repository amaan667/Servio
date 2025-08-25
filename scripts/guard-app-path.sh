#!/usr/bin/env bash
set -euo pipefail

echo "[GUARD] Checking app directory integrity..."

# Check if 'app' exists as a file (this causes the Railway error)
if [ -f app ]; then
  echo "[GUARD] ERROR: 'app' exists as a file, removing it..."
  rm -f app
fi

# Ensure app directory exists
if [ ! -d app ]; then
  echo "[GUARD] Creating app directory..."
  mkdir -p app
fi

# Verify app is a directory
if [ -d app ]; then
  echo "[GUARD] App directory integrity verified ✓"
else
  echo "[GUARD] ERROR: App directory is not a directory"
  exit 1
fi