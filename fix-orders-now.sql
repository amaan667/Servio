-- Fix Orders Now - Simple and Direct
-- This will make your existing orders visible immediately

-- Step 1: Make all orders PAID
UPDATE orders 
SET payment_status = 'PAID'
WHERE venue_id = 'venue-1e02af4d';

-- Step 2: Move some orders to last 30 minutes (LIVE tab)
UPDATE orders 
SET created_at = NOW() - INTERVAL '10 minutes'
WHERE venue_id = 'venue-1e02af4d' 
  AND id IN (
    SELECT id FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    ORDER BY RANDOM() 
    LIMIT 3
  );

-- Step 3: Move some orders to earlier today (EARLIER TODAY tab)
UPDATE orders 
SET created_at = NOW() - INTERVAL '2 hours'
WHERE venue_id = 'venue-1e02af4d' 
  AND id IN (
    SELECT id FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    ORDER BY RANDOM() 
    LIMIT 4
  );

-- Step 4: Show results
SELECT 
    'RESULTS' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as earlier_today_orders,
    COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';
