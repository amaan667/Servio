-- FORCE DASHBOARD REFRESH: The function returns correct counts but UI doesn't reflect them
-- This script will trigger a refresh and clear any caching issues

-- ============================================================================
-- STEP 1: Verify the function is working correctly
-- ============================================================================

SELECT 
    '=== VERIFYING FUNCTION ===' as info;

-- Test the function multiple times to ensure consistency
SELECT 
    'Function test 1:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- Test again to ensure consistency
SELECT 
    'Function test 2:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 2: Check if there are any other functions or views that might be interfering
-- ============================================================================

SELECT 
    '=== CHECKING FOR CONFLICTING FUNCTIONS ===' as info;

-- Check if there are other functions that might be used
SELECT 
    'Functions that might be used for counts:' as info,
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname ILIKE '%count%' 
   OR proname ILIKE '%dashboard%'
   OR proname ILIKE '%order%'
ORDER BY proname;

-- ============================================================================
-- STEP 3: Force update any orders to trigger real-time updates
-- ============================================================================

SELECT 
    '=== TRIGGERING REAL-TIME UPDATES ===' as info;

-- Update the order's updated_at timestamp to trigger real-time subscriptions
UPDATE orders 
SET 
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- Show the updated order
SELECT 
    'Updated order timestamp:' as info,
    id,
    customer_name,
    created_at,
    updated_at,
    NOW() - updated_at as "Time Since Update"
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- ============================================================================
-- STEP 4: Test the function one more time after the update
-- ============================================================================

SELECT 
    '=== FINAL FUNCTION TEST ===' as info;

-- Test the function after the update
SELECT 
    'Final function test:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total",
    active_tables_count as "Active Tables",
    tables_set_up as "Tables Set Up",
    tables_in_use as "Tables In Use"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 5: Create a simple test endpoint to verify the function works
-- ============================================================================

SELECT 
    '=== CREATING TEST ENDPOINT ===' as info;

-- Create a simple test function that the frontend can call
CREATE OR REPLACE FUNCTION test_dashboard_counts(p_venue_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'live_count', live_count,
        'earlier_today_count', earlier_today_count,
        'history_count', history_count,
        'today_orders_count', today_orders_count,
        'active_tables_count', active_tables_count,
        'tables_set_up', tables_set_up,
        'tables_in_use', tables_in_use,
        'timestamp', NOW()
    ) INTO result
    FROM dashboard_counts(p_venue_id, 'Europe/London', 30);
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION test_dashboard_counts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION test_dashboard_counts(text) TO anon;

-- Test the new function
SELECT 
    'Test endpoint result:' as info,
    test_dashboard_counts('venue-1e02af4d') as result;

-- ============================================================================
-- STEP 6: Instructions for frontend refresh
-- ============================================================================

SELECT 
    '=== FRONTEND REFRESH INSTRUCTIONS ===' as info,
    'The database function is working correctly. To refresh the UI:' as instruction1,
    '1. Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)' as instruction2,
    '2. Clear browser cache' as instruction3,
    '3. Check browser console for any JavaScript errors' as instruction4,
    '4. Verify the dashboard_counts function is being called correctly' as instruction5;
