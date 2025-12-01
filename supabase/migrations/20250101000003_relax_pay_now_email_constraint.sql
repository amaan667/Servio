-- Migration: Remove PAY_NOW email requirement constraint
-- Allow null email initially (collected in Stripe Checkout)
-- Email will be updated from Stripe webhook after payment

-- Drop the existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_pay_now_requires_email'
  ) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_pay_now_requires_email;
    RAISE NOTICE 'Dropped existing orders_pay_now_requires_email constraint - email will be collected in Stripe Checkout';
  END IF;
END $$;

-- Note: Email is now optional for PAY_NOW orders
-- Stripe Checkout will collect the email, and the webhook can update the order with it

