# Organization & Subscription Update Fix

## Problem
When users upgraded to the Standard plan via Stripe, the homepage and dashboard were still showing "Basic" plan. The Stripe webhook was configured correctly and events were being sent, but the plan information wasn't updating in the database or frontend.

## Root Cause
The issue was caused by **mock/legacy organization IDs** being used during the Stripe checkout process. When users without a real organization record attempted to upgrade:

1. The checkout would create a mock organization ID like `legacy-{userId}` or `default-{userId}`
2. This mock ID would be passed to Stripe in the checkout session metadata
3. When Stripe sent webhook events (checkout.session.completed, subscription.updated), the webhook tried to find the organization using this mock ID
4. Since mock IDs don't exist in the database, the webhook couldn't update the subscription tier
5. The frontend continued showing "Basic" because no database update occurred

## Solution

### 1. **Always Create Real Organizations**
- Removed all mock/legacy organization ID logic
- Modified `/api/stripe/create-checkout-session` to ALWAYS ensure a real organization exists before creating a Stripe session
- If no organization exists, one is created immediately and linked to the user's venues
- Only real database organization IDs are now passed to Stripe

### 2. **Improved Webhook Handling**
- Enhanced `/api/stripe/webhooks` with better error handling and fallback logic
- Added user_id to Stripe metadata for additional fallback organization lookup
- Improved logging to track webhook processing and identify issues quickly

### 3. **Fixed Caching Issues**
- Added `dynamic = 'force-dynamic'` to `/api/organization/ensure`
- Added no-cache headers to API responses
- Ensures frontend always fetches fresh subscription data

### 4. **Updated All Related Endpoints**
- `/api/organization/ensure` - Creates real organizations, never returns mock IDs
- `/api/stripe/create-checkout-session` - Validates and ensures real org before checkout
- `/api/stripe/webhooks` - Properly handles org lookup with fallbacks
- `/api/debug/subscription-status` - Creates real orgs instead of mock data

## Files Changed

### Core API Routes
1. **`/app/api/stripe/create-checkout-session/route.ts`**
   - Simplified organization lookup logic
   - Always creates real organization if none exists
   - Uses actual org ID in Stripe metadata
   - Better error handling and logging

2. **`/app/api/stripe/webhooks/route.ts`**
   - Added user_id to metadata extraction
   - Improved organization lookup with fallbacks
   - Better logging for debugging webhook issues
   - Extracted common logic to helper function

3. **`/app/api/organization/ensure/route.ts`**
   - Added no-cache headers
   - Set `dynamic = 'force-dynamic'`
   - Ensures fresh data on every request

4. **`/app/api/debug/subscription-status/route.ts`**
   - Creates real organizations instead of mock data
   - Links existing venues to new organizations

## How It Works Now

### User Flow
1. User visits homepage → `fetchUserTier()` calls `/api/organization/ensure`
2. If no organization exists, it's created with:
   - Real database ID
   - subscription_tier: "basic"
   - subscription_status: "trialing"
   - trial_ends_at: 14 days from now

3. User clicks "Upgrade to Standard"
4. Checkout session is created with REAL organization ID in metadata
5. User completes payment in Stripe
6. Stripe sends webhook to `/api/stripe/webhooks`
7. Webhook finds organization by ID (with user_id fallback)
8. Database is updated with new tier and status
9. User returns to homepage with `?upgrade=success`
10. Frontend automatically refreshes and shows updated plan

### Webhook Flow
```
Stripe Webhook Event
  ↓
Extract organization_id, tier, user_id from metadata
  ↓
Try to find organization by ID
  ↓ (if not found)
Fallback: Find organization by user_id
  ↓
Update database with new tier/status
  ↓
Log subscription history
  ↓
Return success
```

## Testing Instructions

### 1. Verify Organization Creation
```bash
# Check that user has real organization
curl -X POST https://your-domain.com/api/organization/ensure \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return organization with real UUID, not "legacy-..." or "default-..."
```

### 2. Test Upgrade Flow
1. Log in to your account
2. Go to homepage
3. Check browser console - should see:
   ```
   [TIER DEBUG] Organization ensured: { id: 'real-uuid-here', tier: 'basic', ... }
   ```
4. Click "Upgrade to Standard"
5. Complete Stripe checkout (use test card `4242 4242 4242 4242`)
6. You'll be redirected with `?upgrade=success`
7. Watch console for refresh attempts
8. Page should update to show "Standard" plan within a few seconds

### 3. Verify Webhook Processing
1. Go to Stripe Dashboard → Webhooks
2. Find your webhook endpoint
3. Click on recent events
4. Check "checkout.session.completed" event
5. Verify metadata contains:
   - `organization_id`: Real UUID (not legacy-...)
   - `tier`: "standard"
   - `user_id`: User's ID
6. Click "Send test webhook" to manually trigger

### 4. Check Database
```sql
-- Verify organization exists with correct tier
SELECT id, owner_id, subscription_tier, subscription_status, trial_ends_at
FROM organizations
WHERE owner_id = 'your-user-id';

-- Should show:
-- subscription_tier: 'standard' (after upgrade)
-- subscription_status: 'trialing' or 'active'
```

## Environment Variables Required

Make sure these are set in Railway/production:
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_APP_URL=https://servio-production.up.railway.app
```

## Monitoring

Check Railway logs for these key messages:

**Success indicators:**
- `[STRIPE DEBUG] Created new organization: {real-uuid}`
- `[STRIPE DEBUG] Using organization ID: {real-uuid}`
- `[STRIPE WEBHOOK] ✅ Successfully updated organization`
- `[TIER REFRESH] Updated tier to: standard`

**Error indicators:**
- `[STRIPE ERROR] Failed to create organization`
- `[STRIPE WEBHOOK] ❌ Organization not found`
- `[STRIPE WEBHOOK] ❌ Missing required metadata`

## Key Benefits

1. ✅ **No more mock IDs** - Every account has a real organization record
2. ✅ **Reliable webhooks** - Subscription updates work every time
3. ✅ **Better debugging** - Clear logging at every step
4. ✅ **No caching issues** - Fresh data on every request
5. ✅ **Automatic recovery** - Fallback mechanisms if primary lookup fails
6. ✅ **Venue linking** - Existing venues automatically linked to new organizations

## Next Steps

After this fix:
1. All new users will automatically get real organizations
2. Existing users will get real organizations created on their next login
3. Any legacy users attempting to upgrade will have organizations created before checkout
4. Webhook updates will work reliably for all users

## Rollback Instructions

If issues occur, revert these commits:
- Checkout session organization logic changes
- Webhook handler organization lookup changes
- Organization ensure endpoint caching changes

Then investigate logs and contact support.
