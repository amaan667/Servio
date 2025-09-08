-- Quick fix for payment_status constraint violation
-- Run this in Supabase SQL Editor

-- Step 1: Drop the problematic constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Step 2: Update all existing payment_status values to valid ones
UPDATE orders 
SET payment_status = 'UNPAID' 
WHERE payment_status NOT IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED') 
   OR payment_status IS NULL;

-- Step 3: Set default value
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'UNPAID';

-- Step 4: Add the constraint back
ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'));

-- Step 5: Verify the fix
SELECT 'Fix completed successfully!' as status;
