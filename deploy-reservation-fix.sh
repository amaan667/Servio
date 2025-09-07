#!/bin/bash

# Deploy reservation feature fix
# This script applies the database fixes needed for the reservation feature

echo "🚀 Deploying reservation feature fix..."

# Check if we're in the right directory
if [ ! -f "scripts/fix-reservation-complete.sql" ]; then
    echo "❌ Error: fix-reservation-complete.sql not found. Please run this from the project root."
    exit 1
fi

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "❌ Error: Railway CLI not found. Please install it first."
    echo "   Visit: https://docs.railway.app/develop/cli"
    exit 1
fi

echo "📋 Applying database fixes..."

# Apply the SQL fix
railway run --service web "psql \$DATABASE_URL -f scripts/fix-reservation-complete.sql"

if [ $? -eq 0 ]; then
    echo "✅ Reservation feature fix deployed successfully!"
    echo ""
    echo "🔧 What was fixed:"
    echo "   • Added missing reservation_duration_minutes column"
    echo "   • Updated table_status enum with RESERVED, ORDERING, etc."
    echo "   • Updated tables_with_sessions view"
    echo "   • Cleaned up existing data"
    echo ""
    echo "🎉 The reservation feature should now work properly!"
else
    echo "❌ Error: Failed to apply database fixes"
    echo "   Please check the error messages above and try again"
    exit 1
fi
