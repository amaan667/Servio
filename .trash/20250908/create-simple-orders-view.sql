-- Create a simple orders_with_totals view for the current database structure
-- This view works with embedded JSONB items instead of separate order_items table

CREATE OR REPLACE VIEW orders_with_totals AS
SELECT
  o.*,
  -- Calculate total from embedded items JSONB
  COALESCE(
    (SELECT SUM((item->>'price')::numeric * (item->>'quantity')::integer)
     FROM jsonb_array_elements(o.items) AS item), 
    0
  )::numeric AS calculated_total,
  -- Use the stored total_amount as fallback
  COALESCE(o.total_amount, 0)::numeric AS total_amount
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
SELECT 'orders_with_totals view created successfully' as status;
SELECT COUNT(*) as total_orders FROM orders_with_totals;
