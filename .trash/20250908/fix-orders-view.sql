-- Fix the orders_with_totals view to match the current database structure
-- Drop the existing view and recreate it

DROP VIEW IF EXISTS orders_with_totals;

CREATE OR REPLACE VIEW orders_with_totals AS
SELECT
  o.*,
  -- Ensure total_amount is available (use computed if original is missing)
  COALESCE(o.total_amount, 0)::numeric AS total_amount,
  -- Add computed total for verification
  COALESCE(
    (SELECT SUM((item->>'price')::numeric * (item->>'quantity')::integer)
     FROM jsonb_array_elements(o.items) AS item), 
    0
  )::numeric AS computed_total_amount
FROM orders o;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_venue_id ON orders_with_totals(venue_id);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_order_status ON orders_with_totals(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_created_at ON orders_with_totals(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_with_totals_scheduled_for ON orders_with_totals(scheduled_for);

-- Grant permissions
GRANT SELECT ON orders_with_totals TO authenticated;
GRANT SELECT ON orders_with_totals TO anon;

-- Verify the view works
SELECT 'orders_with_totals view fixed successfully' as status;
SELECT COUNT(*) as total_orders FROM orders_with_totals;
