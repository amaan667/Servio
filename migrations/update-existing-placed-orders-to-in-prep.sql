-- Migration: Update all PLACED orders to IN_PREP
-- Reason: Orders now start as IN_PREP so they show in Live Orders immediately
-- This updates existing orders to match the new flow

-- Update all active PLACED orders to IN_PREP
UPDATE orders
SET 
  order_status = 'IN_PREP',
  updated_at = NOW()
WHERE 
  order_status = 'PLACED'
  AND venue_id IS NOT NULL
  AND payment_status IN ('PAID', 'UNPAID', 'TILL')
  AND order_status != 'CANCELLED'
  AND order_status != 'REFUNDED'
  AND order_status != 'COMPLETED';

-- Log the count
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % orders from PLACED to IN_PREP', updated_count;
END $$;

