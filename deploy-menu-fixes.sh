#!/bin/bash

# =====================================================
# MENU IMPORT FIXES DEPLOYMENT SCRIPT
# =====================================================
# This script applies all the menu import fixes to resolve:
# 1. Modifier explosion (Coffee with a shot of X)
# 2. £0.00 prices
# 3. Misfiled items (lobster in coffee)
# 4. Duplicates/near-duplicates
# 5. Truncated descriptions
# 6. Component items that should be removed
# 7. Category validation

set -e

echo "🔧 Starting Menu Import Fixes Deployment"
echo "========================================"

# Check if we're in the right directory
if [ ! -f "scripts/fix-menu-import-issues.sql" ]; then
    echo "❌ Error: fix-menu-import-issues.sql not found. Please run from project root."
    exit 1
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Please set DATABASE_URL to your Supabase database connection string"
    exit 1
fi

echo "📊 Pre-fix analysis..."
echo "====================="

# Show current state before fixes
echo "Current category counts:"
psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count 
FROM menu_items 
GROUP BY category 
ORDER BY count DESC;
" || echo "⚠️  Could not connect to database - please check DATABASE_URL"

echo ""
echo "Items with £0.00 prices:"
psql "$DATABASE_URL" -c "
SELECT name, category, price 
FROM menu_items 
WHERE price = 0.00 
LIMIT 10;
" || echo "⚠️  Could not query zero-price items"

echo ""
echo "Coffee category item count:"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as coffee_items 
FROM menu_items 
WHERE category = 'COFFEE';
" || echo "⚠️  Could not query coffee items"

echo ""
echo "🚀 Applying menu fixes..."
echo "========================"

# Apply the fixes
if psql "$DATABASE_URL" -f "scripts/fix-menu-import-issues.sql"; then
    echo "✅ Menu fixes applied successfully!"
else
    echo "❌ Error applying menu fixes"
    exit 1
fi

echo ""
echo "📊 Post-fix analysis..."
echo "======================"

# Show results after fixes
echo "Updated category counts:"
psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count 
FROM menu_items 
GROUP BY category 
ORDER BY count DESC;
"

echo ""
echo "Remaining items with £0.00 prices:"
psql "$DATABASE_URL" -c "
SELECT name, category, price 
FROM menu_items 
WHERE price = 0.00;
"

echo ""
echo "Updated coffee category item count:"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as coffee_items 
FROM menu_items 
WHERE category = 'COFFEE';
"

echo ""
echo "🎉 Menu fixes deployment completed!"
echo "=================================="
echo ""
echo "Summary of fixes applied:"
echo "✅ Fixed £0.00 prices for core drinks"
echo "✅ Removed modifier explosion items (Coffee with a shot of X)"
echo "✅ Moved misfiled items to correct categories"
echo "✅ Removed duplicates and near-duplicates"
echo "✅ Fixed truncated descriptions (granular → granola)"
echo "✅ Removed component items (club sandwich, etc.)"
echo "✅ Validated category assignments"
echo ""
echo "Next steps:"
echo "1. Test the menu display in your application"
echo "2. Verify that coffee category now has reasonable item count"
echo "3. Check that all items have proper prices"
echo "4. Consider implementing the improved menu parser for future imports"
