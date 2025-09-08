#!/bin/bash

# Deploy fix for "Payment completed but failed to update order status" error
# This script applies the RLS policy fix to allow order updates

echo "🚀 Deploying order update fix..."

# Check if we're in the right directory
if [ ! -f "scripts/fix-order-update-rls.sql" ]; then
    echo "❌ Error: fix-order-update-rls.sql not found. Please run this script from the project root."
    exit 1
fi

# Check if Supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found. Please install it first."
    echo "   Visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if we're logged in to Supabase
if ! supabase status &> /dev/null; then
    echo "❌ Error: Not logged in to Supabase. Please run 'supabase login' first."
    exit 1
fi

echo "📋 Applying RLS policy fix for order updates..."

# Apply the SQL fix
supabase db push --include-all

if [ $? -eq 0 ]; then
    echo "✅ Order update fix deployed successfully!"
    echo ""
    echo "🔧 What was fixed:"
    echo "   - Updated RLS policies to allow order updates"
    echo "   - Removed unnecessary payment status update in order summary page"
    echo "   - Orders are now created with correct payment_status: 'PAID'"
    echo ""
    echo "🎉 The 'Payment completed but failed to update order status' error should now be resolved!"
else
    echo "❌ Error: Failed to deploy the fix. Please check the error messages above."
    exit 1
fi
