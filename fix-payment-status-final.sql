-- Final corrected payment status fix using allowed database values
-- Based on the constraint error, we need to use the original payment status values

-- First, let's see what payment status values are currently allowed
SELECT 
    'Current payment status values:' as info,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status
ORDER BY payment_status;

-- Fix historical orders (yesterday and earlier) - all should be PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- Historical orders only
  AND payment_status != 'PAID';  -- Only update if not already PAID

-- Fix today's orders (including live orders) - show actual payment status
-- Pay Now orders (demo/stripe) should be PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = CURRENT_DATE  -- Today's orders
  AND payment_method IN ('demo', 'stripe')  -- Pay Now orders
  AND payment_status != 'PAID';  -- Only update if not already PAID

-- Pay at Till orders should be TILL (using original value)
UPDATE orders 
SET 
    payment_status = 'TILL',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = CURRENT_DATE  -- Today's orders
  AND payment_method = 'till'  -- Pay at Till orders
  AND payment_status != 'TILL';  -- Only update if not already correct

-- Pay Later orders should be UNPAID (using original value)
UPDATE orders 
SET 
    payment_status = 'UNPAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = CURRENT_DATE  -- Today's orders
  AND payment_method = 'later'  -- Pay Later orders
  AND payment_status != 'UNPAID';  -- Only update if not already correct

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

-- Show historical orders (should all be PAID)
SELECT 
    'Historical orders (should all be PAID):' as info,
    DATE(created_at) as order_date,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- Historical orders
GROUP BY DATE(created_at), payment_status
ORDER BY order_date DESC, payment_status;

-- Expected results:
-- Historical orders: payment_status = 'PAID' (green)
-- Live/Today Pay Now: payment_status = 'PAID' (green)
-- Live/Today Pay at Till: payment_status = 'TILL' (orange/yellow)
-- Live/Today Pay Later: payment_status = 'UNPAID' (red)
