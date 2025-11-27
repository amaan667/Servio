-- Fix subscription_tier constraint to allow new tier names
-- Run this in Supabase SQL Editor
-- IMPORTANT: Run all statements in a single transaction

BEGIN;

-- Step 1: Drop the old constraint FIRST (this allows us to update rows)
ALTER TABLE organizations 
DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;

-- Step 2: Update existing rows with old tier names to new tier names
UPDATE organizations 
SET subscription_tier = 'starter'
WHERE subscription_tier = 'basic';

UPDATE organizations 
SET subscription_tier = 'pro'
WHERE subscription_tier = 'standard';

UPDATE organizations 
SET subscription_tier = 'enterprise'
WHERE subscription_tier = 'premium';

-- Step 3: Create new constraint with correct tier names (starter, pro, enterprise)
ALTER TABLE organizations 
ADD CONSTRAINT organizations_subscription_tier_check 
CHECK (subscription_tier IN ('starter', 'pro', 'enterprise'));

COMMIT;
