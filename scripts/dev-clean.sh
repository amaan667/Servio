#!/bin/bash
# Clear Next.js cache and restart dev server
echo "🧹 Clearing Next.js cache..."
rm -rf .next
echo "✅ Cache cleared!"
echo ""
echo "🚀 Starting dev server..."
pnpm dev
