# Column Name Mismatch Fix

## Problem
The application expects `owner_user_id` column but the database schema uses `owner_id`. This causes:
- Venues to be created but not found during lookups
- "Venue not found" errors in customer ordering
- Dashboard access issues

## Root Cause
There are **73 occurrences** of `owner_user_id` throughout the codebase, but the database schema uses `owner_id`.

## Solution
Run this SQL in your **Supabase SQL Editor** to fix the database column name:

```sql
-- Rename owner_id to owner_user_id in venues table
ALTER TABLE venues RENAME COLUMN owner_id TO owner_user_id;

-- Update any indexes that reference the old column name  
DROP INDEX IF EXISTS idx_venues_owner;
CREATE INDEX IF NOT EXISTS idx_venues_owner_user ON venues(owner_user_id);

-- Verify the change worked
SELECT column_name, data_type, is_nullable
FROM information_schema.columns  
WHERE table_name = 'venues' AND column_name LIKE '%owner%'
ORDER BY column_name;
```

## What This Fixes
- ✅ Venue creation and lookup consistency
- ✅ Dashboard access for venue owners
- ✅ Customer ordering "venue not found" errors
- ✅ Profile completion flow
- ✅ All 73+ references to owner_user_id in the codebase

## After Running SQL
1. Venues will be found correctly during lookups
2. Dashboard will load properly for venue owners  
3. Customer ordering will work with existing venue IDs
4. Profile completion will redirect correctly

This is a **one-time database fix** that aligns the schema with the application code.
