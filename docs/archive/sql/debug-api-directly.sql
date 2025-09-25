-- Debug API Logic Directly
-- This will test the exact same queries the API should be running

-- Test 1: Live Orders Query (last 30 minutes, PAID only)
SELECT 
    'LIVE ORDERS API QUERY' as test_type,
    COUNT(*) as count,
    'Should match API response' as note
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- Test 2: Earlier Today Query (today but >30 min ago, PAID only)
SELECT 
    'EARLIER TODAY API QUERY' as test_type,
    COUNT(*) as count,
    'Should match API response' as note
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < NOW() - INTERVAL '30 minutes';

-- Test 3: History Query (before today, PAID only)
SELECT 
    'HISTORY API QUERY' as test_type,
    COUNT(*) as count,
    'Should match API response' as note
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at < DATE_TRUNC('day', NOW());

-- Test 4: Show actual orders that should be returned
SELECT 
    'LIVE ORDERS DETAILS' as test_type,
    id,
    customer_name,
    payment_status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

-- Test 5: Check if there are any orders with different payment statuses
SELECT 
    'PAYMENT STATUS CHECK' as test_type,
    payment_status,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status;

-- Test 6: Check current time boundaries
SELECT 
    'TIME BOUNDARIES' as test_type,
    NOW() as current_time,
    NOW() - INTERVAL '30 minutes' as thirty_minutes_ago,
    DATE_TRUNC('day', NOW()) as start_of_today;
