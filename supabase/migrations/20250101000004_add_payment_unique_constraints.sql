-- Migration: Add UNIQUE constraints on payment identifiers
-- This prevents duplicate orders/charges for the same payment intent or session
-- CRITICAL for financial safety in production

-- 1. Add UNIQUE constraint on payment_intent_id
-- This ensures no duplicate orders can be created for the same payment intent
-- NULL values are allowed (for orders without payment intents, e.g., PAY_AT_TILL)
DO $$
BEGIN
  -- First, handle any existing duplicates by keeping only the first order per payment_intent_id
  -- This is a one-time cleanup for existing data
  WITH duplicates AS (
    SELECT 
      payment_intent_id,
      id,
      ROW_NUMBER() OVER (PARTITION BY payment_intent_id ORDER BY created_at ASC) as rn
    FROM orders
    WHERE payment_intent_id IS NOT NULL
  )
  UPDATE orders
  SET payment_intent_id = NULL
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  )
  AND payment_intent_id IS NOT NULL;
  
  -- Now add the UNIQUE constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_payment_intent_id_unique'
  ) THEN
    -- Use partial unique index to allow NULL values (PostgreSQL allows multiple NULLs in UNIQUE constraints)
    CREATE UNIQUE INDEX orders_payment_intent_id_unique 
    ON orders (payment_intent_id) 
    WHERE payment_intent_id IS NOT NULL;
    
    COMMENT ON INDEX orders_payment_intent_id_unique IS 
    'Ensures no duplicate orders for the same payment_intent_id. NULL values are allowed for orders without payment intents (e.g., PAY_AT_TILL).';
  END IF;
END $$;

-- 2. Add UNIQUE constraint on stripe_session_id
-- This ensures no duplicate order updates from webhook retries
-- NULL values are allowed (for orders without Stripe sessions)
DO $$
BEGIN
  -- First, handle any existing duplicates by keeping only the first order per stripe_session_id
  WITH duplicates AS (
    SELECT 
      stripe_session_id,
      id,
      ROW_NUMBER() OVER (PARTITION BY stripe_session_id ORDER BY created_at ASC) as rn
    FROM orders
    WHERE stripe_session_id IS NOT NULL
  )
  UPDATE orders
  SET stripe_session_id = NULL
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  )
  AND stripe_session_id IS NOT NULL;
  
  -- Now add the UNIQUE constraint
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'orders_stripe_session_id_unique'
  ) THEN
    -- Use partial unique index to allow NULL values
    CREATE UNIQUE INDEX orders_stripe_session_id_unique 
    ON orders (stripe_session_id) 
    WHERE stripe_session_id IS NOT NULL;
    
    COMMENT ON INDEX orders_stripe_session_id_unique IS 
    'Ensures no duplicate orders for the same stripe_session_id. NULL values are allowed for orders without Stripe sessions.';
  END IF;
END $$;
