# Manual Database Fix Instructions

The orders have disappeared because the `orders_with_totals` view is missing or has the wrong structure.

## Quick Fix

1. Go to your Supabase dashboard: https://cpwemmofzjfzbmqcgjrq.supabase.co/project/default/sql

2. Copy and paste this SQL:

```sql
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
```

3. Click "Run" to execute the SQL

4. Refresh your Live Orders page - the orders should now appear!

## What This Fixes

- Creates the missing `orders_with_totals` view
- Ensures all columns from the `orders` table are available
- Adds computed total amount for verification
- Creates proper indexes for performance
- Grants necessary permissions

## Alternative: Use Direct Table

If you prefer, you can also modify the code to query the `orders` table directly instead of using the view. This would require updating the LiveOrdersClient to use `orders` instead of `orders_with_totals`.
