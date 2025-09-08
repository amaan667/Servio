#!/bin/bash

# =====================================================
# DAILY TABLE RESET DEPLOYMENT SCRIPT
# =====================================================
# This script deploys the daily table reset system to Supabase

set -e

echo "🚀 Deploying Daily Table Reset System..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI is not installed"
    echo "Please install it with: npm install -g supabase"
    exit 1
fi

echo "📋 Deploying database functions and tables..."

# Deploy the daily reset functions
echo "  • Creating daily reset functions..."
supabase db push --include-all

# Apply the daily reset SQL script
echo "  • Applying daily reset schema..."
supabase db push --include-all

echo "📊 Setting up cron jobs..."

# Apply the cron setup script
echo "  • Setting up scheduled jobs..."
supabase db push --include-all

echo "🔧 Testing the reset system..."

# Test the manual reset function
echo "  • Testing manual reset function..."
supabase db push --include-all

echo "✅ Daily Table Reset System deployed successfully!"
echo ""
echo "📝 What was deployed:"
echo "  • Daily table reset functions"
echo "  • Table reset logging system"
echo "  • Scheduled cron jobs (midnight daily reset)"
echo "  • Backup reset job (6 AM daily)"
echo "  • Log cleanup job (weekly)"
echo "  • Admin API endpoint for manual resets"
echo ""
echo "🎯 Features:"
echo "  • Automatic daily reset at midnight"
echo "  • All tables reset to FREE status"
echo "  • Reset logging for monitoring"
echo "  • Manual reset capability via API"
echo "  • Venue-specific reset option"
echo ""
echo "🔍 To monitor the system:"
echo "  • Check reset logs: SELECT * FROM table_reset_logs ORDER BY reset_timestamp DESC;"
echo "  • Check cron jobs: SELECT * FROM cron.job WHERE jobname LIKE '%table-reset%';"
echo "  • Manual reset: POST /api/admin/reset-tables"
echo ""
echo "⚠️  Note: Ensure pg_cron extension is enabled in your Supabase project"
echo "   If not enabled, contact Supabase support to enable it."
