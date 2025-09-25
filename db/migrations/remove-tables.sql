-- Remove specified tables from the system and clean up their orders
-- Usage: Replace the table numbers in the IN clauses below with your desired table numbers
-- This script removes tables 15 and 67 and handles all associated orders

BEGIN;

-- Step 1: Update any active orders for tables 15 and 67 to COMPLETED status
-- This ensures we don't lose any order data, but marks them as finished
UPDATE orders 
SET 
  order_status = 'COMPLETED',
  updated_at = NOW()
WHERE 
  table_number IN (15, 67)
  AND order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'SERVING');

-- Step 2: Clear table_id references in orders for tables 15 and 67
-- This removes the foreign key constraint before deleting the tables
UPDATE orders 
SET 
  table_id = NULL,
  updated_at = NOW()
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')
  );

-- Step 3: Remove any table sessions for tables 15 and 67
-- This cleans up any active sessions for these tables
DELETE FROM table_sessions 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')
  );

-- Step 4: Remove any reservations for tables 15 and 67
DELETE FROM reservations 
WHERE 
  table_id IN (
    SELECT id FROM tables 
    WHERE label IN ('15', '67')
  );

-- Step 5: Now remove the table records for tables 15 and 67
-- This should work now that we've cleared the foreign key references
DELETE FROM tables 
WHERE 
  label IN ('15', '67');

COMMIT;

-- Verification queries (run these separately to check the results)
-- Check if tables 15 and 67 still exist:
-- SELECT * FROM tables WHERE label IN ('15', '67');

-- Check orders for tables 15 and 67:
-- SELECT table_number, order_status, COUNT(*) as count 
-- FROM orders 
-- WHERE table_number IN (15, 67)
-- GROUP BY table_number, order_status;

-- Check if any table sessions exist for tables 15 and 67:
-- SELECT * FROM table_sessions ts
-- JOIN tables t ON ts.table_id = t.id
-- WHERE t.label IN ('15', '67');
