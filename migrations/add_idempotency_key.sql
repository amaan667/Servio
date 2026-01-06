-- Add idempotency key to orders table for duplicate prevention
-- This prevents duplicate order creation from retries/timeouts

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique constraint on venue + idempotency_key to prevent duplicates
-- This ensures the same order can't be created twice within a venue
ALTER TABLE orders
ADD CONSTRAINT unique_order_idempotency_key UNIQUE (venue_id, idempotency_key);

-- Add index for efficient idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);

-- Update existing orders with generated idempotency keys (for backwards compatibility)
-- Only update orders that don't have an idempotency key yet
UPDATE orders
SET idempotency_key = gen_random_uuid()::text
WHERE idempotency_key IS NULL;

-- Make the column NOT NULL after backfilling
ALTER TABLE orders
ALTER COLUMN idempotency_key SET NOT NULL;

COMMENT ON COLUMN orders.idempotency_key IS 'Unique key to prevent duplicate order creation from retries';
COMMENT ON INDEX idx_orders_idempotency_key IS 'Index for efficient idempotency key lookups';