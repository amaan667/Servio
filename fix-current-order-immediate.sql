-- Quick Fix for Current Order
-- Run this immediately to fix the order showing as "Counter 10" when it should be "Table 10"

-- Step 1: Ensure source column exists
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'qr' CHECK (source IN ('qr', 'counter'));

-- Step 2: Fix the current order (most recent order with table_number 10)
UPDATE orders 
SET source = 'qr' 
WHERE id = (
  SELECT id 
  FROM orders 
  WHERE table_number = 10 
    AND source = 'counter'
  ORDER BY created_at DESC 
  LIMIT 1
);

-- Step 3: Verify the fix
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
WHERE table_number = 10
ORDER BY created_at DESC 
LIMIT 3;
