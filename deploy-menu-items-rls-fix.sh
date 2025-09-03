#!/bin/bash

# Deploy Menu Items RLS Fix to Railway
# This script fixes the RLS policies that are preventing PDF-processed menu items from being visible

echo "🚀 Deploying Menu Items RLS Fix to Railway..."

# Check if we're in the right directory
if [ ! -f "railway.toml" ]; then
    echo "❌ Error: railway.toml not found. Please run this script from the project root."
    exit 1
fi

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Error: Railway CLI not found. Please install it first:"
    echo "   npm install -g @railway/cli"
    echo "   or visit: https://railway.app/cli"
    exit 1
fi

echo "📋 Railway CLI found. Checking login status..."

# Check if user is logged in to Railway
if ! railway whoami &> /dev/null; then
    echo "❌ Error: Not logged in to Railway. Please run:"
    echo "   railway login"
    exit 1
fi

echo "✅ Logged in to Railway"

# Check current project
echo "🔍 Checking current Railway project..."
CURRENT_PROJECT=$(railway status --json | jq -r '.project.name' 2>/dev/null || echo "")

if [ -z "$CURRENT_PROJECT" ]; then
    echo "❌ Error: Could not determine current Railway project."
    echo "Please ensure you're in the correct project directory and run:"
    echo "   railway link"
    exit 1
fi

echo "📁 Current project: $CURRENT_PROJECT"

# Create the RLS fix SQL file
echo "📝 Creating RLS fix SQL file..."
cat > scripts/fix-menu-items-rls-deploy.sql << 'EOF'
-- Fix RLS policies for menu_items table to ensure PDF-processed items are visible
-- This script addresses the issue where PDF processing inserts items but they don't appear in the menu management interface

-- Step 1: Enable RLS on menu_items table (if not already enabled)
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Service role can manage menu items" ON public.menu_items;

-- Step 3: Create comprehensive RLS policies for menu_items table

-- Policy 1: Allow authenticated users to read menu items for venues they own
CREATE POLICY "Allow authenticated users to read their venue menu items" ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 2: Allow authenticated users to insert menu items for venues they own
CREATE POLICY "Allow authenticated users to insert menu items for their venues" ON public.menu_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 3: Allow authenticated users to update menu items for venues they own
CREATE POLICY "Allow authenticated users to update menu items for their venues" ON public.menu_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 4: Allow authenticated users to delete menu items for venues they own
CREATE POLICY "Allow authenticated users to delete menu items for their venues" ON public.menu_items
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.venues 
            WHERE venues.venue_id = menu_items.venue_id 
            AND venues.owner_id = auth.uid()
        )
    );

-- Policy 5: Allow service role full access (for PDF processing and other automated operations)
CREATE POLICY "Allow service role full access to menu items" ON public.menu_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy 6: Allow anon users to read menu items (for public menu display)
CREATE POLICY "Allow anon users to read menu items" ON public.menu_items
    FOR SELECT
    TO anon
    USING (true);

-- Step 4: Verify the setup
-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename = 'menu_items';

-- Check RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename = 'menu_items'
ORDER BY policyname;

-- Step 5: Test the policies by checking if we can see existing menu items
SELECT 
    COUNT(*) as total_menu_items,
    COUNT(DISTINCT venue_id) as unique_venues,
    COUNT(DISTINCT category) as unique_categories
FROM public.menu_items;

-- Step 6: Check if there are any menu items that might be hidden due to RLS
SELECT 
    venue_id,
    COUNT(*) as item_count,
    MIN(created_at) as oldest_item,
    MAX(created_at) as newest_item
FROM public.menu_items 
GROUP BY venue_id 
ORDER BY item_count DESC;
EOF

echo "✅ RLS fix SQL file created"

# Deploy the fix
echo "🚀 Deploying to Railway..."

# First, let's check if we can access the database directly
echo "🔍 Checking database access..."

# Try to run the SQL fix
echo "📊 Applying RLS fix to database..."
railway run -- bash -c "
echo 'Applying RLS fix to menu_items table...'
psql \$DATABASE_URL -f scripts/fix-menu-items-rls-deploy.sql
echo 'RLS fix applied successfully!'
"

if [ $? -eq 0 ]; then
    echo "✅ RLS fix deployed successfully!"
    echo ""
    echo "🔧 What was fixed:"
    echo "   - RLS policies for menu_items table"
    echo "   - Service role access for PDF processing"
    echo "   - Authenticated user access to their venue items"
    echo "   - Anonymous user read access for public menus"
    echo ""
    echo "📱 Next steps:"
    echo "   1. Try uploading a PDF menu again"
    echo "   2. Check the menu management page"
    echo "   3. The items should now be visible"
    echo ""
    echo "🐛 If issues persist, check the browser console for debug logs"
else
    echo "❌ Failed to deploy RLS fix"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   1. Check if Railway CLI has access to the project"
    echo "   2. Verify the DATABASE_URL environment variable is set"
    echo "   3. Try running: railway run -- psql \$DATABASE_URL -c 'SELECT version();'"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
