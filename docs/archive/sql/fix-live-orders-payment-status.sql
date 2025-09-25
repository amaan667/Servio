-- Fix live orders payment status display
-- Ensure live orders show correct payment status based on customer's payment choice

-- First, let's see the current payment statuses for live orders (last 30 minutes)
SELECT 
    'Current live orders payment statuses:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    payment_method,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Live orders (last 30 minutes)
ORDER BY created_at DESC;

-- Update live orders to show correct payment status based on payment method
-- If payment_method is 'demo' or 'stripe', payment_status should be 'PAID'
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Live orders only
  AND payment_method IN ('demo', 'stripe')  -- Pay Now orders
  AND payment_status != 'PAID';  -- Only update if not already PAID

-- Keep 'till' orders as 'TILL' status (Pay at Till)
-- Keep 'later' orders as 'UNPAID' status (Pay Later)

-- Verify the update worked
SELECT 
    'After update - live orders should show correct payment status:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    payment_method,
    total_amount,
    created_at
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Live orders (last 30 minutes)
ORDER BY created_at DESC;

-- Show summary of payment statuses for live orders
SELECT 
    'Summary of live orders payment statuses:' as info,
    payment_method,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Live orders only
GROUP BY payment_method, payment_status
ORDER BY payment_method, payment_status;

-- Expected result:
-- Pay Now (demo/stripe) orders should show: payment_status = 'PAID'
-- Pay at Till orders should show: payment_status = 'TILL'  
-- Pay Later orders should show: payment_status = 'UNPAID'
