#!/usr/bin/env bash
set -e

echo "[RAILWAY-DEBUG] Starting comprehensive build with debugging"

# Set up comprehensive logging
export NIXPACKS_LOG_LEVEL=debug
export NPM_CONFIG_LOGLEVEL=verbose
export PNPM_LOG_LEVEL=debug

# Enable corepack
corepack enable

# Clean everything
echo "[RAILWAY-DEBUG] Cleaning build environment"
rm -rf .next node_modules .pnpm-store

# Install dependencies
echo "[RAILWAY-DEBUG] Installing dependencies"
pnpm install --frozen-lockfile

# Make guard script executable and run pre-build check
echo "[RAILWAY-DEBUG] Running pre-build guard"
chmod +x scripts/guard-app-path.sh || true
[ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true

# Run the build
echo "[RAILWAY-DEBUG] Running build"
pnpm run build

# Run post-build guard
echo "[RAILWAY-DEBUG] Running post-build guard"
[ -f scripts/guard-app-path.sh ] && scripts/guard-app-path.sh || true

echo "[RAILWAY-DEBUG] Build completed successfully"