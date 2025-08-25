#!/usr/bin/env bash
set -euo pipefail

echo "[PRE-BUILD] Starting pre-build setup for Railway Nixpacks..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Clean any existing build artifacts
echo "[PRE-BUILD] Cleaning build artifacts..."
rm -rf .next
rm -f .env.production
rm -f .env.local

# Handle Railway Nixpacks directory conflict
echo "[PRE-BUILD] Handling Railway Nixpacks directory setup..."

# Remove any existing app directory or file that might conflict
if [ -e app ]; then
  echo "[PRE-BUILD] Removing existing app entry..."
  rm -rf app
fi

# Create a symlink from app to src/app to satisfy Nixpacks
echo "[PRE-BUILD] Creating app symlink to src/app..."
ln -sf src/app app

# Ensure src/app exists and has content
if [ ! -d src/app ]; then
  echo "[PRE-BUILD] Creating src/app directory..."
  mkdir -p src/app
fi

# Create a basic page if none exists (for Next.js compatibility)
if [ ! -f src/app/page.tsx ] && [ ! -f src/app/page.js ]; then
  echo "[PRE-BUILD] Creating basic page for Next.js compatibility..."
  cat > src/app/page.tsx << 'EOF'
export default function HomePage() {
  return (
    <div>
      <h1>Servio - QR Code Ordering Made Simple</h1>
      <p>Welcome to Servio!</p>
    </div>
  );
}
EOF
fi

echo "[PRE-BUILD] Railway Nixpacks setup complete"
