#!/bin/bash

# =====================================================
# CATALOG SYSTEM DEPLOYMENT SCRIPT
# =====================================================
# This script sets up the complete catalog system for
# "Clear & Upload PDF" functionality

set -e

echo "🚀 Starting Catalog System Deployment"
echo "====================================="

# Check if we're in the right directory
if [ ! -f "scripts/create-catalog-schema.sql" ]; then
    echo "❌ Error: create-catalog-schema.sql not found. Please run from project root."
    exit 1
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Please set DATABASE_URL to your Supabase database connection string"
    exit 1
fi

echo "📊 Pre-deployment analysis..."
echo "============================="

# Show current state before deployment
echo "Current menu_items count:"
psql "$DATABASE_URL" -c "
SELECT COUNT(*) as menu_items_count 
FROM menu_items;
" || echo "⚠️  Could not connect to database - please check DATABASE_URL"

echo ""
echo "Current categories in menu_items:"
psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count 
FROM menu_items 
WHERE category IS NOT NULL
GROUP BY category 
ORDER BY count DESC 
LIMIT 10;
" || echo "⚠️  Could not query categories"

echo ""
echo "🚀 Deploying catalog schema..."
echo "=============================="

# Deploy the catalog schema
if psql "$DATABASE_URL" -f "scripts/create-catalog-schema.sql"; then
    echo "✅ Catalog schema deployed successfully!"
else
    echo "❌ Error deploying catalog schema"
    exit 1
fi

echo ""
echo "🚀 Deploying replace catalog RPC..."
echo "==================================="

# Deploy the RPC function
if psql "$DATABASE_URL" -f "scripts/create-replace-catalog-rpc.sql"; then
    echo "✅ Replace catalog RPC deployed successfully!"
else
    echo "❌ Error deploying replace catalog RPC"
    exit 1
fi

echo ""
echo "📊 Post-deployment analysis..."
echo "============================="

# Show results after deployment
echo "New catalog tables created:"
psql "$DATABASE_URL" -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('categories', 'options', 'option_choices', 'item_aliases', 'item_images')
ORDER BY table_name;
"

echo ""
echo "Categories migrated from menu_items:"
psql "$DATABASE_URL" -c "
SELECT c.name, COUNT(mi.id) as item_count
FROM categories c
LEFT JOIN menu_items mi ON c.id = mi.category_id
GROUP BY c.id, c.name
ORDER BY item_count DESC;
"

echo ""
echo "RPC functions created:"
psql "$DATABASE_URL" -c "
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('api_replace_catalog', 'validate_catalog_payload')
ORDER BY routine_name;
"

echo ""
echo "🎉 Catalog system deployment completed!"
echo "======================================"
echo ""
echo "Summary of deployment:"
echo "✅ Extended catalog schema with options, variants, aliases"
echo "✅ Atomic replace catalog RPC function"
echo "✅ Validation function for payload checking"
echo "✅ Proper foreign key relationships and cascade deletes"
echo "✅ Row Level Security policies"
echo "✅ Migration of existing data to new schema"
echo ""
echo "New features available:"
echo "1. Clear & Upload PDF with atomic replacement"
echo "2. Replace vs Append toggle in UI"
echo "3. Bulletproof parsing with validation"
echo "4. Proper options and variants support"
echo "5. Item aliases for search flexibility"
echo ""
echo "Next steps:"
echo "1. Test the new catalog replacement functionality"
echo "2. Verify that existing menu items are properly migrated"
echo "3. Test the Replace vs Append toggle in the UI"
echo "4. Ensure the clear catalog functionality works correctly"
