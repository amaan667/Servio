-- Check what payment status values are allowed by the database constraint
-- This will help us understand what values we can use

-- Check the constraint definition
SELECT 
    'Payment status constraint definition:' as info,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE '%payment_status%'
  AND contype = 'c';  -- Check constraints

-- Check what payment status values currently exist
SELECT 
    'Current payment status values in database:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status
ORDER BY payment_status;

-- Check what payment method values exist
SELECT 
    'Current payment method values in database:' as info,
    payment_method,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_method
ORDER BY payment_method;

-- Show some sample orders to understand the current structure
SELECT 
    'Sample orders with current payment status:' as info,
    id,
    customer_name,
    payment_status,
    payment_method,
    order_status,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 10;
