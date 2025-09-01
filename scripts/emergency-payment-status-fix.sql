-- Emergency fix for payment_status constraint violation
-- Run this FIRST if you get the constraint violation error

-- 1. First, let's see what payment_status values exist
SELECT DISTINCT payment_status, COUNT(*) as count
FROM orders 
GROUP BY payment_status
ORDER BY payment_status;

-- 2. Drop the problematic constraint temporarily
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- 3. Migrate all payment_status values to valid ones
UPDATE orders 
SET payment_status = CASE 
  WHEN payment_status = 'pending' THEN 'UNPAID'
  WHEN payment_status = 'paid' THEN 'PAID'
  WHEN payment_status = 'failed' THEN 'UNPAID'
  WHEN payment_status = 'refunded' THEN 'REFUNDED'
  WHEN payment_status IS NULL THEN 'UNPAID'
  WHEN payment_status NOT IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED') THEN 'UNPAID'
  ELSE payment_status
END;

-- 4. Set default value
ALTER TABLE orders ALTER COLUMN payment_status SET DEFAULT 'UNPAID';

-- 5. Now safely add the constraint back
ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'));

-- 6. Verify the fix worked
SELECT DISTINCT payment_status, COUNT(*) as count
FROM orders 
GROUP BY payment_status
ORDER BY payment_status;

-- 7. Test that we can insert a new order
INSERT INTO orders (
  venue_id, 
  customer_name, 
  customer_phone, 
  table_number, 
  total_amount, 
  order_status, 
  payment_status, 
  items
) VALUES (
  'test-venue',
  'Test Customer',
  '+1234567890',
  1,
  10.00,
  'PLACED',
  'UNPAID',
  '[]'::jsonb
) ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM orders WHERE venue_id = 'test-venue';

RAISE NOTICE 'Payment status constraint fix completed successfully!';
