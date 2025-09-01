-- Create a view for orders with computed totals
-- This fixes the issue where order cards show £0.00 instead of correct totals

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

-- Create index on the view for better performance
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_venue_id ON orders_with_totals(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_order_status ON orders_with_totals(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_created_at ON orders_with_totals(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_scheduled_for ON orders_with_totals(scheduled_for);

-- Grant permissions
GRANT SELECT ON orders_with_totals TO authenticated;
GRANT SELECT ON orders_with_totals TO anon;
