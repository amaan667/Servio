-- Clean up history orders - mark all orders from previous days as completed
-- This will update orders that are in the "History" tab to have consistent status

-- First, let's see what orders we're working with
SELECT 
    'Current orders by date and status:' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Show orders from yesterday and earlier (these should be in History tab)
SELECT 
    'Orders from yesterday and earlier (History tab):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- Yesterday and earlier
ORDER BY created_at DESC;

-- Update all orders from previous days to completed status
-- This affects orders that appear in the "History" tab
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    payment_status = 'PAID',  -- Assume all historical orders were paid
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- Yesterday and earlier
  AND order_status != 'COMPLETED';  -- Only update if not already completed

-- Show the results after update
SELECT 
    'Orders after cleanup (History tab should all be completed):' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Show specific orders from yesterday and earlier to verify
SELECT 
    'Verification - History orders should all be COMPLETED and PAID:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- Yesterday and earlier
ORDER BY created_at DESC;

-- Show today's orders (these should remain unchanged for staff management)
SELECT 
    'Today\'s orders (should remain unchanged for staff):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = CURRENT_DATE  -- Today only
ORDER BY created_at DESC;
