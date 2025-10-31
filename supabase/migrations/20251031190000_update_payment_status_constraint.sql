-- Migration: Update payment_status constraint to allow PAY_LATER and TILL
-- Created: 2025-10-31
--
-- This migration updates the orders_payment_status_check constraint 
-- to allow PAY_LATER and TILL as valid payment status values

-- Drop the existing constraint
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Add the updated constraint with all valid payment statuses
ALTER TABLE orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED', 'PAY_LATER', 'TILL'));

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Updated orders_payment_status_check constraint to allow PAY_LATER and TILL';
END $$;

