-- Migration: Add UNIQUE constraints on payment identifiers
-- This prevents duplicate orders/charges for the same payment intent or session
-- CRITICAL for financial safety in production

-- 1. Add UNIQUE constraint on payment_intent_id (or stripe_payment_intent_id)
-- This ensures no duplicate orders can be created for the same payment intent
-- NULL values are allowed (for orders without payment intents, e.g., PAY_AT_TILL)
-- NOTE: Checks for both payment_intent_id and stripe_payment_intent_id column names
DO $$
DECLARE
  payment_intent_column TEXT;
BEGIN
  -- Determine which column exists: payment_intent_id or stripe_payment_intent_id
  SELECT column_name INTO payment_intent_column
  FROM information_schema.columns
  WHERE table_name = 'orders'
    AND column_name IN ('payment_intent_id', 'stripe_payment_intent_id')
  LIMIT 1;
  
  -- If column exists, add unique constraint
  IF payment_intent_column IS NOT NULL THEN
    -- First, handle any existing duplicates by keeping only the first order per payment_intent_id
    -- This is a one-time cleanup for existing data
    EXECUTE format('
      WITH duplicates AS (
        SELECT 
          %I,
          id,
          ROW_NUMBER() OVER (PARTITION BY %I ORDER BY created_at ASC) as rn
        FROM orders
        WHERE %I IS NOT NULL
      )
      UPDATE orders
      SET %I = NULL
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
      AND %I IS NOT NULL',
      payment_intent_column, payment_intent_column, payment_intent_column,
      payment_intent_column, payment_intent_column
    );
    
    -- Now add the UNIQUE constraint
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'orders_payment_intent_id_unique'
    ) THEN
      -- Use partial unique index to allow NULL values
      EXECUTE format('
        CREATE UNIQUE INDEX orders_payment_intent_id_unique 
        ON orders (%I) 
        WHERE %I IS NOT NULL',
        payment_intent_column, payment_intent_column
      );
      
      EXECUTE format('
        COMMENT ON INDEX orders_payment_intent_id_unique IS 
        ''Ensures no duplicate orders for the same %I. NULL values are allowed for orders without payment intents (e.g., PAY_AT_TILL).''',
        payment_intent_column
      );
    END IF;
  ELSE
    RAISE NOTICE 'Neither payment_intent_id nor stripe_payment_intent_id column found in orders table. Skipping unique constraint.';
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
