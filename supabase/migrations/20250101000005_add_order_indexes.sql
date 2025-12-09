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

-- 3. Index on payment_intent_id (for idempotency checks)
-- This is critical for fast duplicate order detection
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id 
ON orders(payment_intent_id) 
WHERE payment_intent_id IS NOT NULL;

COMMENT ON INDEX idx_orders_payment_intent_id IS 
'Index on payment_intent_id for fast idempotency checks. Partial index (excludes NULLs) for efficiency.';

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
