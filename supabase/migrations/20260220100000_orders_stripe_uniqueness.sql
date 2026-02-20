-- Enforce uniqueness for Stripe identifiers on orders to prevent duplicate side effects.
-- Empty-string values are excluded because legacy flows may store ''.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_payment_intent_unique
  ON public.orders (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_stripe_session_unique
  ON public.orders (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL AND stripe_session_id <> '';
