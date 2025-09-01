#!/bin/bash

# Servio MVP Fixes Deployment Script
# This script applies all the database and code fixes

set -e

echo "🚀 Deploying Servio MVP Fixes..."
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -f "scripts/run-all-fixes.sql" ]; then
    echo "❌ Error: Please run this script from the Servio MVP project root directory"
    exit 1
fi

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
    echo "⚠️  Warning: DATABASE_URL or SUPABASE_DB_URL not set"
    echo "   Database fixes will need to be run manually"
    echo "   Run: psql -d your_database -f scripts/run-all-fixes.sql"
fi

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Build the project
echo "🔨 Building project..."
npm run build

# 3. Run database migrations (if possible)
if [ ! -z "$DATABASE_URL" ]; then
    echo "🗄️  Running database fixes..."
    psql "$DATABASE_URL" -f scripts/run-all-fixes.sql
elif [ ! -z "$SUPABASE_DB_URL" ]; then
    echo "🗄️  Running database fixes..."
    psql "$SUPABASE_DB_URL" -f scripts/run-all-fixes.sql
else
    echo "⏭️  Skipping database fixes (no database URL provided)"
    echo "   Please run manually: psql -d your_database -f scripts/run-all-fixes.sql"
fi

# 4. Run tests
echo "🧪 Running tests..."
if [ -f "scripts/test-fixes.js" ]; then
    node scripts/test-fixes.js
else
    echo "⚠️  Test script not found, skipping tests"
fi

# 5. Show deployment summary
echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "📋 What was deployed:"
echo "   • Fixed Live Orders query and real-time updates"
echo "   • New Order Summary page"
echo "   • Fixed total calculations with orders_with_totals view"
echo "   • Updated order status handling"
echo "   • Middleware updates for public order access"
echo ""
echo "🔍 Next steps:"
echo "   1. Test the Live Orders tab - new orders should appear immediately"
echo "   2. Test order submission - should redirect to summary page"
echo "   3. Verify order totals are no longer £0.00"
echo "   4. Test real-time updates across multiple browser tabs"
echo ""
echo "📚 Documentation:"
echo "   • See SERVIO_MVP_FIXES_README.md for detailed information"
echo "   • Run 'node scripts/test-fixes.js' to verify all fixes"
echo ""
echo "🐛 If you encounter issues:"
echo "   • Check the troubleshooting section in the README"
echo "   • Verify database view exists: SELECT * FROM orders_with_totals LIMIT 1;"
echo "   • Check browser console for any errors"
echo ""

# 6. Optional: Start development server
if [ "$1" = "--dev" ]; then
    echo "🚀 Starting development server..."
    npm run dev
fi
