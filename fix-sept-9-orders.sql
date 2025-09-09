-- Fix specific orders from September 9th, 2025 that are showing in History tab
-- Based on the dashboard screenshot, these orders need to be marked as completed

-- First, check the current status of orders from Sept 9th, 2025
SELECT 
    'Orders from September 9th, 2025 (current status):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'  -- September 9th, 2025
ORDER BY created_at DESC;

-- Update all orders from September 9th, 2025 to completed status
-- These are the orders showing in the History tab that need cleanup
UPDATE orders 
SET 
    order_status = 'COMPLETED',
    payment_status = 'PAID',  -- Mark as paid since they're in history
    updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'  -- September 9th, 2025
  AND order_status != 'COMPLETED';  -- Only update if not already completed

-- Verify the update worked
SELECT 
    'Orders from September 9th, 2025 (after cleanup):' as info,
    id,
    table_number,
    customer_name,
    order_status,
    payment_status,
    total_amount,
    created_at::time as order_time
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
  AND DATE(created_at) = '2025-09-09'  -- September 9th, 2025
ORDER BY created_at DESC;

-- Show summary of all orders by date to verify the cleanup
SELECT 
    'Summary of all orders by date (History should all be COMPLETED):' as info,
    DATE(created_at) as order_date,
    order_status,
    payment_status,
    COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY DATE(created_at), order_status, payment_status
ORDER BY order_date DESC, order_status;
