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

# Ensure src/app directory exists and has the correct structure
echo "[PRE-BUILD] Ensuring src/app directory structure..."

# Create src/app directory if it doesn't exist
if [ ! -d src/app ]; then
  echo "[PRE-BUILD] Creating src/app directory..."
  mkdir -p src/app
fi

# Ensure we have the necessary files for Next.js
if [ ! -f src/app/layout.tsx ]; then
  echo "[PRE-BUILD] Creating layout.tsx..."
  cat > src/app/layout.tsx << 'EOF'
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

if [ ! -f src/app/page.tsx ]; then
  echo "[PRE-BUILD] Creating page.tsx..."
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
