#!/bin/bash

# Deploy Table Management Improvements
# This script deploys all the improvements to the table management system

echo "🚀 Deploying Table Management Improvements..."

# 1. Update dashboard counts function with table counters
echo "📊 Updating dashboard counts function..."
psql $DATABASE_URL -f scripts/fix-dashboard-counts.sql

# 2. Create waiting list table
echo "📝 Creating waiting list table..."
psql $DATABASE_URL -f scripts/create-waiting-list-table.sql

# 3. Create table management API functions
echo "🔧 Creating table management API functions..."
psql $DATABASE_URL -f scripts/table-management-api-functions.sql

# 4. Ensure all active tables have free sessions
echo "🔄 Ensuring free sessions for active tables..."
psql $DATABASE_URL -f scripts/ensure-free-sessions.sql

echo "✅ Table Management Improvements deployed successfully!"
echo ""
echo "🎉 New Features:"
echo "  • Dynamic table counters that sync with actual tables"
echo "  • Seat Party flow with QR code popup and timer"
echo "  • Reserved Now vs Reserved Later logic with countdown"
echo "  • Waiting list management with manual entry"
echo "  • Comprehensive table actions menu"
echo ""
echo "📋 Next Steps:"
echo "  1. Test the new Seat Party functionality"
echo "  2. Verify table counters are accurate"
echo "  3. Test waiting list management"
echo "  4. Check reservation time-based logic"
