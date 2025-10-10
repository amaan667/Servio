# Fix: "Failed to create organization" Error When Selecting Plan

## Problem
When users click "Select Plan" in the upgrade modal, they receive the error:
```
Failed to create organization. Please try again.
```

## Root Cause
The `organizations` table has Row Level Security (RLS) enabled, but it was missing an **INSERT policy** for authenticated users. The existing policies only allowed:
- ✅ SELECT (view organizations)
- ✅ UPDATE (modify organizations)
- ❌ **INSERT (create organizations)** - THIS WAS MISSING!

When the API tried to create an organization for a new user selecting a plan, the database blocked the insert operation due to missing permissions.

## Solution
Added an INSERT policy to allow authenticated users to create organizations for themselves.

### Migration File
Created: `migrations/fix-organization-insert-policy.sql`

This migration adds the missing INSERT policy:

```sql
-- Organizations: Authenticated users can create organizations for themselves
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());
```

### Files Changed
1. ✅ `migrations/multi-venue-schema.sql` - Updated to include the INSERT policy in the main schema
2. ✅ `migrations/fix-organization-insert-policy.sql` - Created standalone migration for easy application

## How to Apply the Fix

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `migrations/fix-organization-insert-policy.sql`
4. Click **Run** to execute the migration

### Option 2: Via Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db execute --file migrations/fix-organization-insert-policy.sql
```

### Option 3: Manual SQL Execution
Connect to your Supabase database and run:
```sql
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());
```

## Verification
After applying the fix, test by:
1. Logging in as a user without an organization
2. Opening the Upgrade Modal
3. Clicking "Select Plan" on any tier
4. The checkout session should be created successfully without errors

## Technical Details

### Code Flow
1. User clicks "Select Plan" → `UpgradeModal.tsx:handleUpgrade()`
2. Calls API → `/api/stripe/create-checkout-session`
3. API attempts to create organization → `supabase.from("organizations").insert(...)`
4. **Previously Failed Here** due to missing INSERT policy
5. **Now Succeeds** with the new policy in place
6. Creates Stripe customer and checkout session
7. Redirects user to Stripe Checkout

### RLS Policy Details
```sql
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());
```

This policy ensures:
- Only authenticated users can create organizations
- Users can only create organizations where they are the owner (`owner_id = auth.uid()`)
- Prevents users from creating organizations for other users

## Related Files
- `app/api/stripe/create-checkout-session/route.ts` - Creates organizations when selecting plans
- `app/api/organization/ensure/route.ts` - Ensures users have organizations
- `components/UpgradeModal.tsx` - UI component for plan selection
- `migrations/multi-venue-schema.sql` - Main organization schema

## Impact
- ✅ Fixes the "Failed to create organization" error
- ✅ Allows users to successfully select and upgrade to paid plans
- ✅ Enables proper organization creation during signup flow
- ✅ Maintains security through RLS policies

## Testing Checklist
- [ ] Apply the migration to your Supabase database
- [ ] Log in as a test user without an organization
- [ ] Open the Upgrade Modal from the dashboard
- [ ] Click "Select Plan" for Basic or Standard tier
- [ ] Verify no error appears
- [ ] Verify redirection to Stripe Checkout page
- [ ] Check Supabase database to confirm organization was created

## Notes
- This fix is backward compatible and won't affect existing organizations
- The policy uses `WITH CHECK` to validate that `owner_id` matches the authenticated user
- Service role has full access via the existing "Service role full access to organizations" policy
- The fix has been added to both the main schema file and as a standalone migration
