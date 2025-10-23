# Database Migrations

## Overview

This directory contains SQL migrations to properly set up the multi-venue organization architecture.

## Architecture

### Organizations (Parent)
- One organization per company/owner
- Stores billing information (Stripe customer, subscription)
- Manages trial period and subscription tier
- Can have multiple venues (Premium plan feature)

### Venues (Child)
- Belongs to one organization via `organization_id` foreign key
- Stores venue-specific data (name, address, timezone)
- Inherits billing from parent organization
- Premium plans can have unlimited venues

### User-Venue Roles
- Links users to specific venues
- Defines role: owner, manager, staff, kitchen
- Enables staff management across venues

## Running Migrations

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to "SQL Editor"
3. Copy the contents of `001_fix_organization_schema.sql`
4. Paste and run the migration
5. Verify with the verification queries at the bottom

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migration
supabase db push --file migrations/001_fix_organization_schema.sql
```

### Option 3: Direct SQL

```bash
psql "postgresql://user:pass@host:port/database" < migrations/001_fix_organization_schema.sql
```

## Migration 001: Fix Organization Schema

**What it does:**
1. ✅ Adds `organization_id` column to venues table
2. ✅ Creates foreign key constraint to organizations
3. ✅ Links existing venues to their owner's organization
4. ✅ Creates organizations for orphaned venues
5. ✅ Adds RLS policies for organization access
6. ✅ Creates database indexes for performance

**Safe to run:**
- ✅ Uses `IF NOT EXISTS` to prevent errors
- ✅ Migrates existing data automatically
- ✅ No data loss
- ✅ Backward compatible

## Verification

After running the migration, verify it worked:

```sql
-- Should return 0 (no orphaned venues)
SELECT COUNT(*) as orphaned_venues 
FROM venues 
WHERE organization_id IS NULL;

-- Check organization-venue relationships
SELECT 
  o.id as org_id,
  o.owner_user_id,
  o.subscription_tier,
  COUNT(v.venue_id) as venue_count
FROM organizations o
LEFT JOIN venues v ON v.organization_id = o.id
GROUP BY o.id, o.owner_user_id, o.subscription_tier;
```

## Rollback (if needed)

If something goes wrong:

```sql
-- Remove foreign key constraint
ALTER TABLE venues DROP CONSTRAINT IF EXISTS venues_organization_id_fkey;

-- Remove column
ALTER TABLE venues DROP COLUMN IF EXISTS organization_id;

-- Remove RLS policies
DROP POLICY IF EXISTS "Users can read their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can access their organization's venues" ON venues;
```

## Next Steps

After running this migration:

1. Test trial banner loads properly
2. Verify multi-venue support works
3. Check billing displays correct organization data
4. Ensure all queries work with new schema
5. Remove deprecated `subscription_tier` and `trial_ends_at` from venues (future migration)

