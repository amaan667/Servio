-- Migration script to update orders table with new status fields
-- Run this on your production database

-- First, add the new columns
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'PLACED' CHECK (order_status IN ('PLACED', 'ACCEPTED', 'IN_PREP', 'READY', 'OUT_FOR_DELIVERY', 'SERVING', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'EXPIRED')),
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS prep_lead_minutes INTEGER DEFAULT 30;

-- Update payment_status to use new values
ALTER TABLE orders 
ALTER COLUMN payment_status SET DEFAULT 'UNPAID',
DROP CONSTRAINT IF EXISTS orders_payment_status_check;

ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'IN_PROGRESS', 'PAID', 'REFUNDED'));

-- Migrate existing data
UPDATE orders 
SET order_status = CASE 
  WHEN status = 'pending' THEN 'PLACED'
  WHEN status = 'paid' THEN 'ACCEPTED'
  WHEN status = 'preparing' THEN 'IN_PREP'
  WHEN status = 'served' THEN 'COMPLETED'
  WHEN status = 'cancelled' THEN 'CANCELLED'
  ELSE 'PLACED'
END,
payment_status = CASE 
  WHEN payment_status = 'pending' THEN 'UNPAID'
  WHEN payment_status = 'paid' THEN 'PAID'
  WHEN payment_status = 'failed' THEN 'UNPAID'
  WHEN payment_status = 'refunded' THEN 'REFUNDED'
  ELSE 'UNPAID'
END
WHERE order_status IS NULL OR payment_status IS NULL;

-- Drop the old status column
ALTER TABLE orders DROP COLUMN IF EXISTS status;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_scheduled_for ON orders(scheduled_for);

-- Drop old index
DROP INDEX IF EXISTS idx_orders_status;
