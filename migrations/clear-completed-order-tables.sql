-- Clear tables for all completed/cancelled orders
-- Run this to fix existing completed orders that still have occupied tables

-- Close table sessions for completed orders
UPDATE table_sessions ts
SET 
  status = 'FREE',
  order_id = NULL,
  closed_at = NOW(),
  updated_at = NOW()
WHERE 
  ts.closed_at IS NULL
  AND ts.order_id IN (
    SELECT id 
    FROM orders 
    WHERE order_status IN ('COMPLETED', 'CANCELLED', 'REFUNDED')
  );

-- Log the result
SELECT 'Cleared ' || COUNT(*) || ' table sessions for completed orders' AS result
FROM table_sessions
WHERE status = 'FREE' AND closed_at IS NOT NULL AND updated_at > NOW() - INTERVAL '1 minute';

