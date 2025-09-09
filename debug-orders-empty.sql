-- Debug: Why are orders not appearing on the Live Orders page?
-- This script will help identify the issue

-- ============================================================================
-- STEP 1: Check if any orders exist at all
-- ============================================================================

SELECT 
    'TOTAL ORDERS IN DATABASE' as check_type,
    COUNT(*) as count,
    'All orders regardless of venue' as description
FROM orders;

-- ============================================================================
-- STEP 2: Check orders for the specific venue
-- ============================================================================

SELECT 
    'ORDERS FOR VENUE venue-1e02af4d' as check_type,
    COUNT(*) as count,
    'Orders for the venue shown in the URL' as description
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 3: Check payment status distribution
-- ============================================================================

SELECT 
    'PAYMENT STATUS DISTRIBUTION' as check_type,
    payment_status,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
GROUP BY payment_status;

-- ============================================================================
-- STEP 4: Check order status distribution
-- ============================================================================

SELECT 
    'ORDER STATUS DISTRIBUTION' as check_type,
    order_status,
    COUNT(*) as count
FROM orders
WHERE venue_id = 'venue-1e02af4d'
GROUP BY order_status;

-- ============================================================================
-- STEP 5: Check time distribution
-- ============================================================================

SELECT 
    'TIME DISTRIBUTION' as check_type,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as last_30_min,
    COUNT(CASE WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 1 END) as today,
    COUNT(CASE WHEN created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history,
    MIN(created_at) as oldest_order,
    MAX(created_at) as newest_order
FROM orders
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 6: Show all orders with full details
-- ============================================================================

SELECT 
    'ALL ORDERS DETAILS' as check_type,
    id,
    venue_id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at,
    updated_at,
    EXTRACT(EPOCH FROM (NOW() - created_at))/60 as minutes_ago,
    CASE 
        WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN 'SHOULD APPEAR IN LIVE'
        WHEN created_at >= DATE_TRUNC('day', NOW()) THEN 'SHOULD APPEAR IN EARLIER TODAY'
        ELSE 'SHOULD APPEAR IN HISTORY'
    END as expected_tab
FROM orders
WHERE venue_id = 'venue-1e02af4d'
ORDER BY created_at DESC;

-- ============================================================================
-- STEP 7: Check what the API would return for LIVE orders
-- ============================================================================

SELECT 
    'API LIVE ORDERS QUERY RESULT' as check_type,
    COUNT(*) as count,
    'Orders that should appear in Live tab (PAID + last 30 min)' as description
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= NOW() - INTERVAL '30 minutes';

-- ============================================================================
-- STEP 8: Check what the API would return for EARLIER TODAY orders
-- ============================================================================

SELECT 
    'API EARLIER TODAY QUERY RESULT' as check_type,
    COUNT(*) as count,
    'Orders that should appear in Earlier Today tab (PAID + today but >30min ago)' as description
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at >= DATE_TRUNC('day', NOW())
  AND created_at < NOW() - INTERVAL '30 minutes';

-- ============================================================================
-- STEP 9: Check what the API would return for HISTORY orders
-- ============================================================================

SELECT 
    'API HISTORY QUERY RESULT' as check_type,
    COUNT(*) as count,
    'Orders that should appear in History tab (PAID + before today)' as description
FROM orders
WHERE venue_id = 'venue-1e02af4d'
  AND payment_status = 'PAID'
  AND created_at < DATE_TRUNC('day', NOW());

-- ============================================================================
-- STEP 10: Check venue table
-- ============================================================================

SELECT 
    'VENUE CHECK' as check_type,
    venue_id,
    name,
    owner_id,
    created_at
FROM venues
WHERE venue_id = 'venue-1e02af4d';

-- ============================================================================
-- STEP 11: Quick fix - Create a test order if none exist
-- ============================================================================

-- Insert a test order if no orders exist for this venue
INSERT INTO orders (
    venue_id, 
    table_number, 
    customer_name, 
    customer_phone, 
    items, 
    total_amount, 
    order_status, 
    payment_status, 
    created_at, 
    updated_at
)
SELECT 
    'venue-1e02af4d' as venue_id,
    1 as table_number,
    'Test Customer' as customer_name,
    '+1234567890' as customer_phone,
    '[{"menu_item_id": "test-item", "quantity": 1, "price": 10.00, "item_name": "Test Item"}]'::jsonb as items,
    1000 as total_amount, -- £10.00 in pence
    'PLACED' as order_status,
    'PAID' as payment_status,
    NOW() - INTERVAL '5 minutes' as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM orders 
    WHERE venue_id = 'venue-1e02af4d'
);

-- ============================================================================
-- STEP 12: Final verification
-- ============================================================================

SELECT 
    'FINAL CHECK' as check_type,
    COUNT(*) as total_orders,
    COUNT(CASE WHEN payment_status = 'PAID' AND created_at >= NOW() - INTERVAL '30 minutes' THEN 1 END) as live_orders,
    COUNT(CASE WHEN payment_status = 'PAID' AND created_at >= DATE_TRUNC('day', NOW()) AND created_at < NOW() - INTERVAL '30 minutes' THEN 1 END) as earlier_today_orders,
    COUNT(CASE WHEN payment_status = 'PAID' AND created_at < DATE_TRUNC('day', NOW()) THEN 1 END) as history_orders
FROM orders
WHERE venue_id = 'venue-1e02af4d';
