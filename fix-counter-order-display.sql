-- Fix counter order display by adding source column and updating existing order
-- Run this in your Supabase SQL editor

-- Step 1: Add the source column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));

-- Step 2: Update the most recent order to be a counter order
-- This assumes the order you placed on counter 1 is the most recent one
UPDATE orders 
SET source = 'counter' 
WHERE id = (
  SELECT id 
  FROM orders 
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Step 3: Verify the update worked
SELECT id, table_number, source, created_at, customer_name 
FROM orders 
ORDER BY created_at DESC 
LIMIT 5;
