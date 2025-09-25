-- Template for removing tables from the system and cleaning up their orders
-- 
-- INSTRUCTIONS:
-- 1. Replace the table numbers in the IN clauses below with your desired table numbers
-- 2. Make sure to update both the numeric values (15, 67) and string values ('15', '67')
-- 3. Run this script in your Supabase SQL editor
--
-- Example: To remove tables 23, 45, and 78, change:
--   IN (15, 67) to IN (23, 45, 78)
--   IN ('15', '67') to IN ('23', '45', '78')

BEGIN;

-- Step 1: Update any active orders for the specified tables to COMPLETED status
-- This ensures we don't lose any order data, but marks them as finished
UPDATE orders 
SET 
  order_status = 'COMPLETED',
  updated_at = NOW()
WHERE 
  table_number IN (15, 67)  -- REPLACE WITH YOUR TABLE NUMBERS
  AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- Step 2: Clear table_id references in orders for the specified tables
-- This removes the foreign key constraint before deleting the tables
UPDATE orders 
SET 
  table_id = NULL,
  updated_at = NOW()
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')  -- REPLACE WITH YOUR TABLE NUMBERS AS STRINGS
  );

-- Step 3: Remove any table sessions for the specified tables
DELETE FROM table_sessions 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')  -- REPLACE WITH YOUR TABLE NUMBERS AS STRINGS
  );

-- Step 4: Remove any reservations for the specified tables
DELETE FROM reservations 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')  -- REPLACE WITH YOUR TABLE NUMBERS AS STRINGS
  );

-- Step 5: Now remove the table records for the specified tables
-- This should work now that we've cleared the foreign key references
DELETE FROM tables 
WHERE 
  label IN ('15', '67');  -- REPLACE WITH YOUR TABLE NUMBERS AS STRINGS

COMMIT;

-- Verification queries (run these separately to check the results)
-- Check if the specified tables still exist:
-- SELECT * FROM tables WHERE label IN ('15', '67');

-- Check orders for the specified tables:
-- SELECT table_number, order_status, COUNT(*) as count 
-- FROM orders 
-- WHERE table_number IN (15, 67)
-- GROUP BY table_number, order_status;

-- Check if any table sessions exist for the specified tables:
-- SELECT * FROM table_sessions ts
-- JOIN tables t ON ts.table_id = t.id
-- WHERE t.label IN ('15', '67');
