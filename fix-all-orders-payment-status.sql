-- Comprehensive fix for all orders payment status display
-- Ensures all orders show correct payment status based on customer's payment choice

-- Show current payment status distribution
SELECT 
    'Current payment status distribution:' as info,
    payment_method,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_method, payment_status
ORDER BY payment_method, payment_status;

-- Fix Pay Now orders (demo/stripe) - these should always be PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND payment_method IN ('demo', 'stripe')  -- Pay Now orders
  AND payment_status != 'PAID';  -- Only update if not already PAID

-- Fix Pay at Till orders - these should be TILL
UPDATE orders 
SET 
    payment_status = 'TILL',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND payment_method = 'till'  -- Pay at Till orders
  AND payment_status != 'TILL';  -- Only update if not already TILL

-- Fix Pay Later orders - these should be UNPAID
UPDATE orders 
SET 
    payment_status = 'UNPAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND payment_method = 'later'  -- Pay Later orders
  AND payment_status != 'UNPAID';  -- Only update if not already UNPAID

-- Show updated payment status distribution
SELECT 
    'Updated payment status distribution:' as info,
    payment_method,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_method, payment_status
ORDER BY payment_method, payment_status;

-- Show live orders specifically (last 30 minutes)
SELECT 
    'Live orders (last 30 minutes) payment status:' as info,
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
  AND created_at >= NOW() - INTERVAL '30 minutes'  -- Live orders
ORDER BY created_at DESC;

-- Show today's orders (excluding live orders)
SELECT 
    'Today''s orders (excluding live) payment status:' as info,
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
  AND DATE(created_at) = CURRENT_DATE  -- Today
  AND created_at < NOW() - INTERVAL '30 minutes'  -- Exclude live orders
ORDER BY created_at DESC;

-- Expected results:
-- Pay Now (demo/stripe): payment_status = 'PAID' (green)
-- Pay at Till: payment_status = 'TILL' (orange/yellow)
-- Pay Later: payment_status = 'UNPAID' (red)
