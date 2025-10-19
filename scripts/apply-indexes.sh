#!/bin/bash

# Apply Database Performance Indexes
# Run this script to apply all performance indexes

echo "📊 Applying Database Performance Indexes..."
echo ""

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ Error: SUPABASE_DB_URL environment variable is not set"
  echo ""
  echo "Please set it with:"
  echo "  export SUPABASE_DB_URL='postgresql://...'"
  echo ""
  exit 1
fi

# Apply indexes
echo "🔧 Applying indexes..."
psql "$SUPABASE_DB_URL" -f docs/migrations/performance-indexes.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Performance indexes applied successfully!"
  echo ""
  echo "📈 Expected improvements:"
  echo "  - Menu queries: 30-50% faster"
  echo "  - Order queries: 40-60% faster"
  echo "  - Table queries: 25-35% faster"
  echo ""
else
  echo ""
  echo "❌ Error applying indexes"
  exit 1
fi

