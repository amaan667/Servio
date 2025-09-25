-- Fix Today's Orders - Move existing orders to today's time windows
-- This will make your existing orders appear in Live Orders and Earlier Today tabs

-- ============================================================================
-- STEP 1: Show current order timestamps
-- ============================================================================

SELECT 
    'CURRENT ORDER TIMESTAMPS' as info,
    id,
    customer_name,
    order_status,
    payment_status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'LIVE'
        WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 'EARLIER_TODAY'
        ELSE 'HISTORY'
    END as current_category
FROM orders
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 2: Move 3 orders to LIVE tab (last 30 minutes)
-- ============================================================================

UPDATE orders 
SET 
    created_at = NOW() - (RANDOM() * INTERVAL '30 minutes'),
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d' 
  AND id IN (
    SELECT id FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    ORDER BY RANDOM() 
    LIMIT 3
  );

-- ============================================================================
-- STEP 3: Move 4 orders to EARLIER TODAY tab (today but >30 min ago)
-- ============================================================================

UPDATE orders 
SET 
    created_at = DATE_TRUNC('day', NOW()) + (RANDOM() * INTERVAL '8 hours') + INTERVAL '1 hour',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d' 
  AND id IN (
    SELECT id FROM orders 
    WHERE venue_id = 'venue-1e02af4d' 
    ORDER BY RANDOM() 
    LIMIT 4
  );

-- ============================================================================
-- STEP 4: Ensure all moved orders are PAID (required for visibility)
-- ============================================================================

UPDATE orders 
SET payment_status = 'PAID'
WHERE venue_id = 'venue-1e02af4d' 
  AND (created_at >= DATE_TRUNC('day', NOW()) OR created_at >= NOW() - INTERVAL '30 minutes');

-- ============================================================================
-- STEP 5: Set appropriate order statuses
-- ============================================================================

-- Live orders - active statuses
UPDATE orders 
SET order_status = CASE (RANDOM() * 4)::int
    WHEN 0 THEN 'PLACED'
    WHEN 1 THEN 'IN_PREP'
    WHEN 2 THEN 'READY'
    WHEN 3 THEN 'SERVING'
    ELSE 'PLACED'
END
WHERE venue_id = 'venue-1e02af4d' 
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- Earlier today orders - mix of statuses
UPDATE orders 
SET order_status = CASE (RANDOM() * 3)::int
    WHEN 0 THEN 'COMPLETED'
    WHEN 1 THEN 'SERVING'
    WHEN 2 THEN 'READY'
    ELSE 'COMPLETED'
END
WHERE venue_id = 'venue-1e02af4d' 
  AND created_at >= DATE_TRUNC('day', NOW()) 
  AND created_at < NOW() - INTERVAL '30 minutes';

-- ============================================================================
-- STEP 6: Show the results
-- ============================================================================

SELECT 
    'FINAL DISTRIBUTION' as info,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as earlier_today_orders,
    COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 7: Show orders that should now appear in each tab
-- ============================================================================

SELECT 
    'LIVE ORDERS (Last 30 min)' as tab,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;

SELECT 
    'EARLIER TODAY ORDERS' as tab,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < NOW() - INTERVAL '30 minutes'
ORDER BY created_at DESC;
