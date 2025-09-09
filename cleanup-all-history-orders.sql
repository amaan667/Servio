-- Comprehensive cleanup of all historical orders
-- This will mark all orders from previous days as completed and paid
-- Live orders (last 30 minutes) and today's orders will be left unchanged

-- Show current state before cleanup
SELECT 
    'BEFORE CLEANUP - Current orders by date and status:' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Update all orders from previous days (yesterday and earlier) to completed
-- These orders appear in the "History" tab and should all be marked as completed
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All previous days
  AND (order_status != 'COMPLETED' OR payment_status != 'PAID');  -- Only update if needed

-- Show results after cleanup
SELECT 
    'AFTER CLEANUP - Orders by date and status:' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Verify that all historical orders are now completed and paid
SELECT 
    'VERIFICATION - All historical orders should be COMPLETED and PAID:' as info,
    COUNT(*) as total_historical_orders,
    COUNT(CASE WHEN order_status = 'COMPLETED' THEN 1 END) as completed_orders,
    COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_orders
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE;  -- Historical orders only

-- Show today's orders (these should remain unchanged for staff management)
SELECT 
    'TODAY\'S ORDERS (unchanged for staff management):' as info,
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

-- Show live orders (last 30 minutes) - these should remain unchanged
SELECT 
    'LIVE ORDERS (last 30 minutes - unchanged for staff):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Last 30 minutes
ORDER BY created_at DESC;
