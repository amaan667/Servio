#!/usr/bin/env bash
set -euo pipefail

echo "[PRE-BUILD] Starting Railway Nixpacks setup..."

# Ensure we're in the right directory
cd "$(dirname "$0")/.."

# Clean any existing build artifacts
echo "[PRE-BUILD] Cleaning build artifacts..."
rm -rf .next
rm -f .env.production
rm -f .env.local

# Handle Railway Nixpacks directory setup
echo "[PRE-BUILD] Setting up directory structure for Railway Nixpacks..."

# Remove any existing app directory
if [ -e app ]; then
  echo "[PRE-BUILD] Removing existing app directory..."
  rm -rf app
fi

# Create app directory and copy content from src/app
echo "[PRE-BUILD] Creating app directory with content from src/app..."
mkdir -p app

# Copy all content from src/app to app
if [ -d src/app ] && [ "$(ls -A src/app 2>/dev/null)" ]; then
  echo "[PRE-BUILD] Copying content from src/app to app..."
  cp -r src/app/* app/
fi

# Ensure we have the necessary files for Next.js
if [ ! -f app/layout.tsx ]; then
  echo "[PRE-BUILD] Creating layout.tsx..."
  cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Servio - QR Code Ordering Made Simple',
  description: 'Streamline your business operations with contactless QR code ordering.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
EOF
fi

if [ ! -f app/page.tsx ]; then
  echo "[PRE-BUILD] Creating page.tsx..."
  cat > app/page.tsx << 'EOF'
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
