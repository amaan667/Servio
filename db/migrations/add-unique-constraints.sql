-- Add unique constraints for idempotency to prevent duplicate orders
-- This ensures webhook retries and verify endpoint can't create duplicates

-- Unique constraint on stripe_session_id
CREATE UNIQUE INDEX IF NOT EXISTS orders_stripe_session_id_key
  ON public.orders (stripe_session_id);

-- Unique constraint on stripe_payment_intent_id  
CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_intent_id_key
  ON public.orders (stripe_payment_intent_id);

-- Add comments for clarity
COMMENT ON INDEX orders_stripe_session_id_key IS 'Prevents duplicate orders from webhook retries';
COMMENT ON INDEX orders_payment_intent_id_key IS 'Prevents duplicate orders from payment intent retries';
