-- Fix all existing orders to be marked as COMPLETED and PAID
-- This will update all orders in the system to have the correct status

-- First, let's see what orders we have and their current status
SELECT 
  'Current order statuses:' as info,
  order_status,
  payment_status,
  COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- Update all orders to be COMPLETED and PAID
UPDATE orders 
SET 
  order_status = 'COMPLETED',
  payment_status = 'PAID',
  updated_at = NOW()
WHERE venue_id = 'venue-1e02af4d';

-- Show the results after update
SELECT 
  'After update - order statuses:' as info,
  order_status,
  payment_status,
  COUNT(*) as count
FROM orders 
WHERE venue_id = 'venue-1e02af4d'
GROUP BY order_status, payment_status
ORDER BY order_status, payment_status;

-- Show total orders updated
SELECT 
  'Total orders updated:' as info,
  COUNT(*) as total_orders
FROM orders 
WHERE venue_id = 'venue-1e02af4d';