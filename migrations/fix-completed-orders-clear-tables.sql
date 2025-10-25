-- Migration: Clear tables for completed orders
-- This fixes existing completed orders that still have occupied tables

-- Close table sessions for completed orders
UPDATE table_sessions ts
SET 
  status = 'FREE',
  order_id = NULL,
  closed_at = NOW(),
  updated_at = NOW()
WHERE 
  ts.venue_id IS NOT NULL
  AND ts.closed_at IS NULL
  AND ts.order_id IN (
    SELECT id 
    FROM orders 
    WHERE order_status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
  )
  -- Only close if no other active orders for this table
  AND NOT EXISTS (
    SELECT 1 
    FROM orders o
    WHERE o.venue_id = ts.venue_id
    AND (o.table_id = ts.table_id OR o.table_number = ts.table_number)
    AND o.order_status IN ('IN_PREP', 'READY', 'SERVING', 'SERVED')
    AND o.id != ts.order_id
  );

-- Log the count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Cleared % table sessions for completed orders', updated_count;
END $$;

