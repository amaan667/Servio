-- Comprehensive database schema fix for Servio MVP
-- Run this in your Supabase SQL editor

-- 1. Fix table_number column type from TEXT to INTEGER
DO $$
BEGIN
    -- Check if table_number column exists and is TEXT type
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' 
        AND column_name = 'table_number' 
        AND data_type = 'text'
    ) THEN
        -- Convert table_number from TEXT to INTEGER
        ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_table_number_check;
        ALTER TABLE orders ALTER COLUMN table_number TYPE INTEGER USING table_number::INTEGER;
        RAISE NOTICE 'Successfully converted table_number from TEXT to INTEGER';
    ELSE
        RAISE NOTICE 'table_number column is already INTEGER or does not exist';
    END IF;
END $$;

-- 2. Add order_status column if it doesn't exist
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'PLACED' 
CHECK (order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED'));

-- 3. Add missing columns for orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS prep_lead_minutes INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- 4. First, migrate existing payment_status values BEFORE adding constraint
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

-- 5. Now safely update payment_status constraint
ALTER TABLE orders 
ALTER COLUMN payment_status SET DEFAULT 'UNPAID';

-- Drop the constraint if it exists, then add it back
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'));

-- 6. Migrate existing data from old status field to new order_status field
UPDATE orders 
SET order_status = CASE 
  WHEN status = 'pending' THEN 'PLACED'
  WHEN status = 'confirmed' THEN 'ACCEPTED'
  WHEN status = 'preparing' THEN 'IN_PREP'
  WHEN status = 'ready' THEN 'READY'
  WHEN status = 'delivered' THEN 'COMPLETED'
  WHEN status = 'cancelled' THEN 'CANCELLED'
  ELSE 'PLACED'
END
WHERE order_status IS NULL AND status IS NOT NULL;

-- 7. Drop the old status column if it exists
ALTER TABLE orders DROP COLUMN IF EXISTS status;

-- 8. Create/update indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON orders(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_venue_id ON orders(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- 9. Drop old indexes if they exist
DROP INDEX IF EXISTS idx_orders_status;

-- 10. Verify the changes
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('table_number', 'order_status', 'payment_status')
ORDER BY column_name;

-- 11. Show current orders count for debugging
SELECT 
    COUNT(*) as total_orders,
    COUNT(CASE WHEN order_status = 'PLACED' THEN 1 END) as placed_orders,
    COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_orders,
    COUNT(CASE WHEN order_status NOT IN ('COMPLETED', 'CANCELLED') THEN 1 END) as active_orders
FROM orders;

-- 12. Show any problematic payment_status values (should be empty after migration)
SELECT DISTINCT payment_status, COUNT(*) as count
FROM orders 
GROUP BY payment_status
ORDER BY payment_status;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema has been successfully updated!';
    RAISE NOTICE 'Order insertion should now work properly.';
END $$;
