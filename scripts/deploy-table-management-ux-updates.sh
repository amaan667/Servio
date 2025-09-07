#!/bin/bash

# Deploy Table Management UX & Logic Updates
# This script applies all the database changes for the new table management system

set -e

echo "🚀 Deploying Table Management UX & Logic Updates..."

# 1. Add reservation blocking window column
echo "📝 Adding reservation blocking window column..."
psql $DATABASE_URL -f scripts/add-reservation-blocking-window.sql

# 2. Update table management API functions
echo "🔧 Updating table management API functions..."
psql $DATABASE_URL -f scripts/table-management-api-functions.sql

echo "✅ Table Management UX & Logic Updates deployed successfully!"
echo ""
echo "📋 Summary of changes:"
echo "  • Removed 'Waiting' counter and filter from UI"
echo "  • Made 'Seat Party' the primary action for FREE tables"
echo "  • Added QR icon to each table card"
echo "  • Created new Assign QR Code modal with copy/print/regenerate"
echo "  • Updated counters to use session-based logic"
echo "  • Implemented business type-based reservation blocking:"
echo "    - CAFE: 0 minutes (no early blocking)"
echo "    - RESTAURANT: 30 minutes (blocks 30min before reservation)"
echo "  • Updated table cards to show live status + reservation badges"
echo ""
echo "🎯 Next steps:"
echo "  1. Test the new table management interface"
echo "  2. Verify reservation blocking works correctly for different business types"
echo "  3. Test QR code assignment and regeneration"
echo "  4. Confirm counters show accurate real-time data"
