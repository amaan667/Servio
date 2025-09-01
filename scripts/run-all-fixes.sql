-- Comprehensive fix script for Servio MVP
-- Run this script to fix all the identified issues

-- 1. Create the orders_with_totals view
CREATE OR REPLACE VIEW orders_with_totals AS
SELECT
  o.*,
  COALESCE(SUM(oi.unit_price * oi.quantity), 0)::numeric AS subtotal_amount,
  COALESCE(SUM(oi.tax_amount), 0)::numeric AS tax_amount,
  COALESCE(SUM(oi.service_amount), 0)::numeric AS service_amount,
  COALESCE(
    SUM(oi.unit_price * oi.quantity) + 
    SUM(COALESCE(oi.tax_amount, 0)) + 
    SUM(COALESCE(oi.service_amount, 0)), 
    0
  )::numeric AS total_amount
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id;

-- 2. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_venue_id ON orders_with_totals(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_order_status ON orders_with_totals(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_created_at ON orders_with_totals(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_scheduled_for ON orders_with_totals(scheduled_for);

-- 3. Grant permissions
GRANT SELECT ON orders_with_totals TO authenticated;
GRANT SELECT ON orders_with_totals TO anon;

-- 4. Ensure all existing orders have the correct status values
UPDATE orders 
SET order_status = CASE 
  WHEN order_status IS NULL THEN 'PLACED'
  WHEN order_status = 'pending' THEN 'PLACED'
  WHEN order_status = 'preparing' THEN 'IN_PREP'
  WHEN order_status = 'ready' THEN 'READY'
  WHEN order_status = 'completed' THEN 'COMPLETED'
  WHEN order_status = 'cancelled' THEN 'CANCELLED'
  ELSE order_status
END
WHERE order_status IS NULL OR order_status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled');

-- 5. Ensure all existing orders have the correct payment status
UPDATE orders 
SET payment_status = CASE 
  WHEN payment_status IS NULL THEN 'UNPAID'
  WHEN payment_status = 'pending' THEN 'UNPAID'
  WHEN payment_status = 'paid' THEN 'PAID'
  WHEN payment_status = 'failed' THEN 'UNPAID'
  WHEN payment_status = 'refunded' THEN 'REFUNDED'
  ELSE payment_status
END
WHERE payment_status IS NULL OR payment_status IN ('pending', 'paid', 'failed', 'refunded');

-- 6. Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Verify the view works
SELECT 'orders_with_totals view created successfully' as status;
SELECT COUNT(*) as total_orders FROM orders_with_totals;
