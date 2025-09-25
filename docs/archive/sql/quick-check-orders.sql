-- Quick Check: What orders exist and why aren't they showing?

-- Check total orders
SELECT 'TOTAL ORDERS' as check_type, COUNT(*) as count FROM orders WHERE venue_id = 'venue-1e02af4d';

-- Check payment status
SELECT 'PAYMENT STATUS' as check_type, payment_status, COUNT(*) as count 
FROM orders WHERE venue_id = 'venue-1e02af4d' 
GROUP BY payment_status;

-- Check current time and date boundaries
SELECT 
    'TIME BOUNDARIES' as check_type,
    NOW() as current_time,
    DATE_TRUNC('day', NOW()) as start_of_today,
    NOW() - INTERVAL '30 minutes' as thirty_minutes_ago;

-- Check orders by time windows
SELECT 
    'ORDERS BY TIME WINDOW' as check_type,
    COUNT(*) as total,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as last_30_min,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as today,
    COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as before_today
FROM orders WHERE venue_id = 'venue-1e02af4d';

-- Show all orders with their timestamps
SELECT 
    'ALL ORDERS' as check_type,
    id,
    customer_name,
    payment_status,
    created_at,
    NOW() - created_at as age,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
        WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 'EARLIER_TODAY'
        ELSE 'HISTORY'
    END as should_appear_in
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 10;
