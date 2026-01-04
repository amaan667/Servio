#!/bin/bash

# Fix local development 404 errors
# This script clears Next.js cache and restarts the dev server

echo "🔧 Fixing local development issues..."

# Step 1: Stop any running Next.js processes
echo "📦 Stopping any running Next.js processes..."
pkill -f "next dev" || true

# Step 2: Clear Next.js cache
echo "🗑️  Clearing Next.js cache..."
rm -rf .next
echo "✅ Cleared .next cache"

# Step 3: Clear node_modules/.cache if it exists
if [ -d "node_modules/.cache" ]; then
  echo "🗑️  Clearing node_modules cache..."
  rm -rf node_modules/.cache
  echo "✅ Cleared node_modules cache"
fi

# Step 4: Check for .env.local
if [ ! -f ".env.local" ]; then
  echo "⚠️  WARNING: .env.local not found!"
  echo "   Make sure you have environment variables set up for local development"
  echo "   You need at minimum:"
  echo "   - NEXT_PUBLIC_SUPABASE_URL"
  echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "   - SUPABASE_SERVICE_ROLE_KEY"
fi

# Step 5: Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
  echo "⚠️  Port 3000 is already in use"
  echo "   Run: lsof -ti:3000 | xargs kill"
fi

echo ""
echo "✅ Cache cleared! Now run:"
echo "   pnpm dev"
echo ""
echo "Or start the dev server now? (y/n)"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  echo "🚀 Starting dev server..."
  pnpm dev
fi

