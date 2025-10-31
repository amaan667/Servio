-- ROLLBACK: Revert payment_status constraint to original
-- This reverts the changes from 20251031190000_update_payment_status_constraint.sql

-- Drop the constraint we added
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Restore original constraint (if it existed)
-- Commenting this out as we need to check what the original was
-- ALTER TABLE orders 
-- ADD CONSTRAINT orders_payment_status_check 
-- CHECK (payment_status IN ('UNPAID', 'PAID', 'REFUNDED'));
