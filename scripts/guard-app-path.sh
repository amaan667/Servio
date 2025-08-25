#!/usr/bin/env bash
set -euo pipefail

# Ensure `app/` is a directory
if [ -e app ] && [ ! -d app ]; then
  echo "ERROR: 'app' exists and is not a directory"
  exit 1
fi

# Pre-create a folder-only sentinel to detect file writes
rm -rf app
mkdir -p app

# After build, ensure nobody replaced it with a file
if [ ! -d app ]; then
  echo "ERROR: Something replaced the 'app' directory with a file named 'app'"
  exit 1
fi

echo "[guard] app directory integrity OK"