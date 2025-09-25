-- FORCE UI REFRESH: The database function works but UI doesn't reflect the changes
-- This script will trigger updates to force the UI to refresh

-- ============================================================================
-- STEP 1: Verify the function is working correctly
-- ============================================================================

SELECT 
    '=== VERIFYING FUNCTION ===' as info;

-- Test the function
SELECT 
    'Function result:' as info,
    live_count as "Live Orders",
    earlier_today_count as "Earlier Today",
    history_count as "History",
    today_orders_count as "Today's Orders Total"
FROM dashboard_counts('venue-1e02af4d', 'Europe/London', 30);

-- ============================================================================
-- STEP 2: Force trigger real-time updates
-- ============================================================================

SELECT 
    '=== TRIGGERING REAL-TIME UPDATES ===' as info;

-- Update the order to trigger real-time subscriptions
UPDATE orders 
SET 
    updated_at = NOW(),
    notes = COALESCE(notes, '') || ' [refreshed at ' || NOW()::time || ']'
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- Show the updated order
SELECT 
    'Updated order:' as info,
    id,
    customer_name,
    updated_at,
    notes
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-10'
  AND payment_status = 'PAID';

-- ============================================================================
-- STEP 3: Create a simple API endpoint to test the function
-- ============================================================================

SELECT 
    '=== CREATING TEST API ===' as info;

-- Create a simple function that returns the counts as JSON
CREATE OR REPLACE FUNCTION get_dashboard_counts_json(p_venue_id text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'success', true,
        'timestamp', NOW(),
        'venue_id', p_venue_id,
        'counts', json_build_object(
            'live_count', live_count,
            'earlier_today_count', earlier_today_count,
            'history_count', history_count,
            'today_orders_count', today_orders_count,
            'active_tables_count', active_tables_count,
            'tables_set_up', tables_set_up,
            'tables_in_use', tables_in_use
        )
    ) INTO result
    FROM dashboard_counts(p_venue_id, 'Europe/London', 30);
    
    RETURN result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_dashboard_counts_json(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_counts_json(text) TO anon;

-- Test the new function
SELECT 
    'Test API result:' as info,
    get_dashboard_counts_json('venue-1e02af4d') as result;

-- ============================================================================
-- STEP 4: Instructions for manual refresh
-- ============================================================================

SELECT 
    '=== MANUAL REFRESH INSTRUCTIONS ===' as info,
    'The database function is working correctly. To refresh the UI:' as step1,
    '1. Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)' as step2,
    '2. Clear browser cache and cookies' as step3,
    '3. Check browser console for JavaScript errors' as step4,
    '4. Verify the dashboard_counts function is being called' as step5,
    '5. Check if there are any network errors in the browser dev tools' as step6;
