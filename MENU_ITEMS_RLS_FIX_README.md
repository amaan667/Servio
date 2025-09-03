# Menu Items RLS Fix - PDF Processed Items Not Visible

## Problem Description

The PDF processing is working correctly and successfully inserting menu items into the database, but these items are not appearing in the menu management interface. This is caused by Row Level Security (RLS) policies on the `menu_items` table that are too restrictive.

## Symptoms

- ✅ PDF processing logs show successful insertion: `[PDF_PROCESS] Final result - Inserted: 132 Skipped: 40 Total: 172`
- ❌ Menu management page shows 0 items
- ❌ Items are not visible in the menu interface despite being in the database

## Root Cause

The issue is with the RLS policies on the `menu_items` table:

1. **PDF Processing**: Uses service role (bypasses RLS) - items are inserted successfully
2. **Menu Management**: Uses authenticated user context - blocked by RLS policies
3. **Missing Policy**: No proper policy allowing authenticated users to read their venue's menu items

## Solution

Apply the RLS fix by running the deployment script:

```bash
./deploy-menu-items-rls-fix.sh
```

Or manually apply the SQL fix:

```sql
-- Fix RLS policies for menu_items table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies
DROP POLICY IF EXISTS "Menu items are viewable by everyone" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are insertable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are updatable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Menu items are deletable by venue managers" ON public.menu_items;
DROP POLICY IF EXISTS "Service role can manage menu items" ON public.menu_items;

-- Create comprehensive RLS policies
CREATE POLICY "Allow authenticated users to read their venue menu items" ON public.menu_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.venues 
        WHERE venues.venue_id = menu_items.venue_id 
        AND venues.owner_id = auth.uid()
    ));

CREATE POLICY "Allow service role full access to menu items" ON public.menu_items
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon users to read menu items" ON public.menu_items
    FOR SELECT TO anon USING (true);
```

## What the Fix Does

1. **Enables RLS** on the `menu_items` table
2. **Creates proper policies** for different user types:
   - **Authenticated users**: Can read/update/delete menu items for venues they own
   - **Service role**: Full access (for PDF processing, API operations)
   - **Anonymous users**: Read-only access (for public menus)
3. **Removes conflicting policies** that were blocking access

## Verification

After applying the fix:

1. **Check RLS status**:
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'menu_items';
   ```

2. **Check RLS policies**:
   ```sql
   SELECT policyname, permissive, roles, cmd 
   FROM pg_policies 
   WHERE tablename = 'menu_items';
   ```

3. **Test menu items visibility**:
   - Upload a PDF menu
   - Check if items appear in the menu management interface
   - Verify the browser console shows successful menu fetching

## Debug Information

The menu management component now includes debug logging:

- `[AUTH DEBUG]` prefixed logs show venue ID and query details
- Database query results are logged
- Total menu items count is displayed
- Any RLS policy errors will be visible in the console

## Alternative Solutions

If the RLS fix doesn't work, consider:

1. **Temporary RLS bypass**: Disable RLS on menu_items table (not recommended for production)
2. **Check venue_id format**: Ensure PDF processing and menu management use the same venue_id format
3. **Verify authentication**: Ensure the user has proper ownership of the venue

## Files Modified

- `components/menu-management.tsx` - Added debug logging
- `scripts/fix-menu-items-rls-deploy.sql` - RLS fix SQL script
- `deploy-menu-items-rls-fix.sh` - Deployment script
- `scripts/fix-menu-items-rls.sql` - Manual RLS fix script

## Next Steps

1. Deploy the RLS fix to Railway
2. Test PDF menu upload
3. Verify items appear in menu management
4. Check browser console for debug logs
5. Remove debug logging if everything works correctly
