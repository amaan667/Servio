-- Fix all historical orders to show as COMPLETED and PAID in green
-- This addresses the mixed statuses and duplicate "completed" display issue

-- First, let's see the current problematic orders from Sept 9th, 2025
SELECT 
    'Current problematic orders from Sept 9th, 2025:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
ORDER BY created_at DESC;

-- Update ALL orders from Sept 9th, 2025 to be COMPLETED and PAID
-- This will fix the mixed statuses (placed, serving, ready) and make them all green
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09';

-- Verify the update worked - all should now be COMPLETED and PAID
SELECT 
    'After update - all orders should be COMPLETED and PAID:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
ORDER BY created_at DESC;

-- Check for any other historical orders that might need fixing
SELECT 
    'Check for other historical orders that need fixing:' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Update any remaining historical orders to be COMPLETED and PAID
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
  AND (order_status != 'COMPLETED' OR payment_status != 'PAID');

-- Final verification - all historical orders should now be COMPLETED and PAID
SELECT 
    'FINAL VERIFICATION - All historical orders should be COMPLETED and PAID:' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;

-- Show the specific Sept 9th orders one more time to confirm they're all green
SELECT 
    'Sept 9th orders should all show as COMPLETED and PAID (green):' as info,
    customer_name,
    order_status,
    payment_status,
    total_amount
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
ORDER BY created_at DESC;
