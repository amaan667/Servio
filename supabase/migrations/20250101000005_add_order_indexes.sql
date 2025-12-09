-- Migration: Add critical database indexes for performance
-- These indexes are essential for efficient queries on hot paths
-- CRITICAL for pilot launch performance

-- 1. Index on venue_id (most common filter)
-- This is used in almost every order query to filter by venue
CREATE INDEX IF NOT EXISTS idx_orders_venue_id 
ON orders(venue_id);

COMMENT ON INDEX idx_orders_venue_id IS 
'Index on venue_id for efficient venue-scoped queries. Used in all order list endpoints.';

-- 2. Index on order id (primary key, but explicit index helps with joins)
-- While primary keys have implicit indexes, explicit index helps with foreign key lookups
CREATE INDEX IF NOT EXISTS idx_orders_order_id 
ON orders(id);

COMMENT ON INDEX idx_orders_order_id IS 
'Index on order id for efficient order lookups and joins.';

-- 3. Index on payment_intent_id or stripe_payment_intent_id (for idempotency checks)
-- This is critical for fast duplicate order detection
-- NOTE: Checks for both column names and creates index on whichever exists
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
  
  IF payment_intent_column IS NOT NULL THEN
    -- Create index on the existing column
    EXECUTE format('
      CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id 
      ON orders(%I) 
      WHERE %I IS NOT NULL',
      payment_intent_column, payment_intent_column
    );
    
    EXECUTE format('
      COMMENT ON INDEX idx_orders_payment_intent_id IS 
      ''Index on %I for fast idempotency checks. Partial index (excludes NULLs) for efficiency.''',
      payment_intent_column
    );
  ELSE
    RAISE NOTICE 'Neither payment_intent_id nor stripe_payment_intent_id column found. Skipping index.';
  END IF;
END $$;

-- 4. Index on stripe_session_id (for webhook idempotency checks)
-- This is critical for fast duplicate webhook processing detection
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session_id 
ON orders(stripe_session_id) 
WHERE stripe_session_id IS NOT NULL;

COMMENT ON INDEX idx_orders_stripe_session_id IS 
'Index on stripe_session_id for fast webhook idempotency checks. Partial index (excludes NULLs) for efficiency.';

-- 5. Composite index on venue_id + created_at (for ordered list queries)
-- This optimizes the most common query pattern: orders by venue, ordered by date
CREATE INDEX IF NOT EXISTS idx_orders_venue_created 
ON orders(venue_id, created_at DESC);

COMMENT ON INDEX idx_orders_venue_created IS 
'Composite index on venue_id and created_at for efficient ordered list queries. Most order endpoints use this pattern.';
