-- Fix counter 10 orders specifically
-- This script updates orders that were placed on counter 10 but still have source='qr'

-- Step 1: Update orders placed on counter 10 to have source='counter'
UPDATE orders
SET source = 'counter'
WHERE table_number = 10 
  AND source = 'qr'
  AND created_at >= '2025-09-10'::date; -- Only update recent orders

-- Step 2: Verify the update worked
SELECT 
  id, 
  table_number, 
  source, 
  created_at, 
  customer_name,
  order_status,
  payment_status
FROM orders
WHERE table_number = 10
ORDER BY created_at DESC
LIMIT 10;

-- Step 3: Show all recent orders to see the overall picture
SELECT 
  id, 
  table_number, 
  source, 
  created_at, 
  customer_name,
  order_status,
  payment_status
FROM orders
WHERE created_at >= '2025-09-10'::date
ORDER BY created_at DESC
LIMIT 20;
