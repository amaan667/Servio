#!/bin/bash

# Deploy payment-first flow fix
# This ensures orders are only created and counted after successful payment

echo "🚀 Deploying payment-first flow fix..."

# Check if we're in the right directory
if [ ! -f "scripts/fix-dashboard-counts-paid-orders.sql" ]; then
    echo "❌ Error: fix-dashboard-counts-paid-orders.sql not found. Please run this script from the project root."
    exit 1
fi

echo "📋 Summary of changes:"
echo "   ✅ Updated order flow to only create orders after payment"
echo "   ✅ Updated live orders API to only show paid orders"
echo "   ✅ Updated dashboard APIs to only show paid orders"
echo "   ✅ Updated dashboard counts function to only count paid orders"
echo "   ✅ Updated OrdersClient to only show paid orders"
echo ""

echo "🔧 Manual steps required:"
echo "   1. Apply the database fix in Supabase Dashboard:"
echo "      - Go to SQL Editor"
echo "      - Run: scripts/fix-dashboard-counts-paid-orders.sql"
echo ""
echo "   2. Deploy the application changes:"
echo "      - Push to your deployment platform"
echo "      - Or run your usual deployment process"
echo ""

echo "🎯 What this fixes:"
echo "   - Orders are no longer created before payment"
echo "   - Live orders dashboard only shows paid orders"
echo "   - Revenue counts only include paid orders"
echo "   - Order counts only include paid orders"
echo "   - No more unpaid orders appearing in dashboard"
echo ""

echo "📝 New payment flow:"
echo "   1. Customer selects items → Order page"
echo "   2. Customer enters details → Order data stored in localStorage"
echo "   3. Customer redirected to payment page"
echo "   4. Payment processed → Order created with payment_status: 'PAID'"
echo "   5. Order appears in live orders dashboard"
echo "   6. Revenue and counts updated"
echo ""

echo "✅ Payment-first flow fix ready for deployment!"
