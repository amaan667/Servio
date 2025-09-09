-- Check Authentication and Venue Ownership Issues
-- This will help identify why the API returns 0 orders

-- Check if the venue exists
SELECT 
    'VENUE CHECK' as check_type,
    venue_id,
    name,
    owner_id,
    created_at
FROM venues
WHERE venue_id = 'venue-1e02af4d';

-- Check all venues to see what's available
SELECT 
    'ALL VENUES' as check_type,
    venue_id,
    name,
    owner_id,
    created_at
FROM venues
ORDER BY created_at DESC;

-- Check if there are any orders for this venue (regardless of payment status)
SELECT 
    'ALL ORDERS FOR VENUE' as check_type,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_orders,
    COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_orders,
    COUNT(CASE WHEN payment_status IS NULL THEN 1 END) as null_payment_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- Check orders by payment status
SELECT 
    'ORDERS BY PAYMENT STATUS' as check_type,
    payment_status,
    COUNT(*) as count,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status
ORDER BY count DESC;

-- Check if there are any users in the auth.users table
SELECT 
    'AUTH USERS CHECK' as check_type,
    COUNT(*) as total_users
FROM auth.users;

-- Check if there are any profiles
SELECT 
    'PROFILES CHECK' as check_type,
    COUNT(*) as total_profiles
FROM profiles;
