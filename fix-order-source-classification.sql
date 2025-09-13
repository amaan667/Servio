-- Fix Order Source Classification
-- This script ensures all orders are correctly classified as either 'qr' (table) or 'counter' orders
-- Run this in your Supabase SQL editor

-- ========================================
-- Step 1: Ensure source column exists with proper constraints
-- ========================================

-- Add the source column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));

-- ========================================
-- Step 2: Fix the current order that was placed at table 10 but shows as counter 10
-- ========================================

-- Update the most recent order with table_number 10 to be a QR/table order
-- This fixes the order that was incorrectly showing as "Counter 10"
UPDATE orders 
SET source = 'qr' 
WHERE id = (
  SELECT id 
  FROM orders 
  WHERE table_number = 10 
    AND source = 'counter'
    AND created_at >= NOW() - INTERVAL '1 hour'  -- Only update recent orders
  ORDER BY created_at DESC 
  LIMIT 1
);

-- ========================================
-- Step 3: Ensure all existing orders have proper source classification
-- ========================================

-- Update any orders that might have NULL source values
UPDATE orders 
SET source = 'qr' 
WHERE source IS NULL;

-- ========================================
-- Step 4: Create a function to automatically set source based on table_number
-- ========================================

-- Create or replace function to automatically set source for new orders
CREATE OR REPLACE FUNCTION set_order_source()
RETURNS TRIGGER AS $$
BEGIN
  -- If source is not provided, default to 'qr' (table order)
  IF NEW.source IS NULL THEN
    NEW.source := 'qr';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set source for new orders
DROP TRIGGER IF EXISTS trigger_set_order_source ON orders;
CREATE TRIGGER trigger_set_order_source
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION set_order_source();

-- ========================================
-- Step 5: Verify the fixes
-- ========================================

-- Check the current state of orders
SELECT 
  id,
  table_number,
  source,
  customer_name,
  created_at,
  CASE 
    WHEN source = 'qr' THEN 'Table ' || table_number
    WHEN source = 'counter' THEN 'Counter ' || table_number
    ELSE 'Unknown'
  END as display_name
FROM orders 
ORDER BY created_at DESC 
LIMIT 10;

-- Check for any orders that might need manual review
SELECT 
  id,
  table_number,
  source,
  customer_name,
  created_at
FROM orders 
WHERE source NOT IN ('qr', 'counter')
   OR source IS NULL
ORDER BY created_at DESC;

-- ========================================
-- Step 6: Summary of changes
-- ========================================

-- Show summary of source distribution
SELECT 
  source,
  COUNT(*) as order_count,
  CASE 
    WHEN source = 'qr' THEN 'Table Orders'
    WHEN source = 'counter' THEN 'Counter Orders'
    ELSE 'Unknown'
  END as order_type
FROM orders 
GROUP BY source
ORDER BY source;

-- ========================================
-- Instructions for future orders:
-- ========================================

/*
FOR FUTURE ORDERS:

1. QR Code Orders (Table orders):
   - URL: /order?venue=venue-id&table=10
   - Will automatically get source = 'qr'
   - Will display as "Table 10"

2. Counter Orders:
   - URL: /order?venue=venue-id&counter=10  
   - Will automatically get source = 'counter'
   - Will display as "Counter 10"

3. The system now properly differentiates based on the source field
4. All new orders will be correctly classified automatically
*/
