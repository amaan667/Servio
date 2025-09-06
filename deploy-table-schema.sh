#!/bin/bash

# Deploy Table Management Schema
# This script provides instructions to fix the table creation 500 error

echo "🔧 Table Management Schema Deployment"
echo "====================================="
echo ""
echo "❌ ISSUE: Table creation is failing with 500 error"
echo "   The 'tables' table doesn't exist in the database yet."
echo ""
echo "✅ SOLUTION: Deploy the table management schema"
echo ""
echo "📋 INSTRUCTIONS:"
echo "   1. Go to your Supabase dashboard"
echo "   2. Navigate to SQL Editor"
echo "   3. Copy and paste the contents of: scripts/create-table-management-tables-safe.sql"
echo "   4. Execute the script"
echo ""
echo "📁 The schema file is located at:"
echo "   $(pwd)/scripts/create-table-management-tables-safe.sql"
echo ""
echo "🔍 After deployment, the /api/tables endpoint will work properly"
echo "   and you'll be able to create tables without the 500 error."
echo ""
echo "📖 For more details, see: TABLE_MANAGEMENT_README.md"
echo ""

# Show the first few lines of the schema file for reference
if [ -f "scripts/create-table-management-tables-safe.sql" ]; then
    echo "📄 Schema file preview (first 10 lines):"
    echo "----------------------------------------"
    head -10 scripts/create-table-management-tables-safe.sql
    echo "..."
    echo ""
    echo "💡 Run 'cat scripts/create-table-management-tables-safe.sql' to see the full schema"
else
    echo "❌ Schema file not found: scripts/create-table-management-tables-safe.sql"
fi
