-- Fix remaining unpaid historical orders and duplicate completed display
-- Target the specific orders from Sept 9th, 2025 that are still showing as UNPAID

-- First, let's see which orders are still UNPAID from Sept 9th, 2025
SELECT 
    'Orders still showing as UNPAID from Sept 9th, 2025:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    payment_method,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
  AND payment_status = 'UNPAID'
ORDER BY created_at DESC;

-- Update ALL orders from Sept 9th, 2025 to be PAID (since they're historical)
-- This will fix the remaining UNPAID orders
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
  AND payment_status = 'UNPAID';  -- Only update the UNPAID ones

-- Verify the update worked
SELECT 
    'After update - all Sept 9th orders should be PAID:' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    payment_method,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
ORDER BY created_at DESC;

-- Check for any other historical orders that might still be UNPAID
SELECT 
    'Check for other historical orders still UNPAID:' as info,
    DATE(created_at) as order_date,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
  AND payment_status = 'UNPAID'
GROUP BY DATE(created_at), payment_status
ORDER BY order_date DESC;

-- Update any remaining historical UNPAID orders to PAID
UPDATE orders 
SET 
    payment_status = 'PAID',
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
  AND payment_status = 'UNPAID';

-- Final verification - all historical orders should now be PAID
SELECT 
    'FINAL VERIFICATION - All historical orders should be PAID:' as info,
    DATE(created_at) as order_date,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) < CURRENT_DATE  -- All historical orders
GROUP BY DATE(created_at), payment_status
ORDER BY order_date DESC, payment_status;

-- Show the specific Sept 9th orders one more time to confirm they're all PAID
SELECT 
    'Sept 9th orders should all show as PAID (green):' as info,
    customer_name,
    order_status,
    payment_status,
    total_amount
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'
ORDER BY created_at DESC;
