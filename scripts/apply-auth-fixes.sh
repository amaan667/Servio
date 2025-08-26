#!/bin/bash

# Auth Fixes Application Script
# This script helps apply the authentication fixes to your Supabase database

echo "🔧 Applying Authentication Fixes..."
echo "=================================="

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql is not installed or not in PATH"
    echo "Please install PostgreSQL client tools or run the SQL manually in Supabase dashboard"
    exit 1
fi

# Check if environment variables are set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL environment variable is not set"
    echo "Please set it to your Supabase database connection string"
    echo "Example: export SUPABASE_DB_URL='postgresql://postgres:[password]@[host]:5432/postgres'"
    exit 1
fi

echo "📋 Running database fixes..."
echo ""

# Run the SQL script
psql "$SUPABASE_DB_URL" -f scripts/run-auth-fixes.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database fixes applied successfully!"
    echo ""
    echo "🔍 Next steps:"
    echo "1. Test Google OAuth sign-in flow"
    echo "2. Verify venue creation for new users"
    echo "3. Check browser console for debug logs"
    echo ""
    echo "📖 For more information, see AUTH_FIXES_README.md"
else
    echo ""
    echo "❌ Error applying database fixes"
    echo "Please check the error messages above and try again"
    echo "You can also run the SQL manually in your Supabase dashboard"
    exit 1
fi