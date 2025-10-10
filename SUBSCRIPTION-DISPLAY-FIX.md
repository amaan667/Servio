# Subscription Display Fix - Complete Guide

## 🐛 Issues Identified

1. **Homepage shows "basic" plan despite standard plan upgrade confirmation**
2. **Pricing cards scattered across multiple pages** (clarified: properly organized)
3. **No plan display in dashboard** (fixed: TrialStatusBanner exists)

## ✅ Fixes Implemented

### 1. **Webhook Endpoint Verification**
- **Correct webhook endpoint**: `/api/stripe/webhooks` (with 's')
- **Do NOT use**: `/api/stripe/webhook` (this is for order payments only)
- Enhanced logging with emojis for easy debugging:
  - ✅ Success operations
  - ❌ Errors
  - 📝 Updates
  - ⚠️ Warnings

**Action Required**: Verify in Stripe Dashboard that webhook is configured to:
```
https://your-domain.com/api/stripe/webhooks
```

### 2. **Dashboard Plan Display**
- ✅ Already implemented via `TrialStatusBanner` component
- Shows current tier (Basic/Standard/Premium)
- Displays trial status and days remaining
- Located at top of dashboard page

### 3. **Immediate Tier Update on Checkout Success**
- Added backup tier update in `/app/checkout/success/page.tsx`
- Calls `/api/test/update-plan` immediately when checkout completes
- Ensures tier is updated even if webhook is delayed

### 4. **Homepage Tier Refresh**
- Already has retry logic when `?upgrade=success` parameter is present
- Retries up to 3 times with exponential backoff
- Removes URL parameter after successful refresh

### 5. **Debug Endpoints Created**

#### Check Organization Status
```bash
GET /api/debug/check-organization
```
Returns complete organization details including:
- Current subscription tier
- Subscription status
- Stripe customer/subscription IDs
- Trial information

#### Manually Fix Subscription Tier
```bash
POST /api/debug/fix-subscription
Content-Type: application/json

{
  "tier": "standard"  // or "basic", "premium"
}
```
Immediately updates organization to the specified tier.

## 🔍 Troubleshooting Guide

### Issue: Homepage still shows "basic" after upgrade

**Step 1: Check Organization in Database**
```bash
curl https://your-domain.com/api/debug/check-organization \
  -H "Cookie: your-auth-cookie"
```

**Step 2: Verify Webhook Logs**
Check Railway logs for:
```
[STRIPE WEBHOOK] ===== CHECKOUT COMPLETED =====
[STRIPE WEBHOOK] ✅ Successfully updated organization
```

**Step 3: Check Stripe Webhook Configuration**
1. Go to https://dashboard.stripe.com/webhooks
2. Verify endpoint URL is `/api/stripe/webhooks` (with 's')
3. Check webhook events include:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`

**Step 4: Manual Fix (Temporary)**
If webhook isn't working, manually update the tier:
```bash
curl -X POST https://your-domain.com/api/debug/fix-subscription \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{"tier": "standard"}'
```

### Issue: Dashboard doesn't show plan

**Verification Steps:**
1. Check if `TrialStatusBanner` is rendered in dashboard
2. Look for console logs: `[TRIAL DEBUG]` in browser console
3. Verify organization has valid subscription_tier in database

**If TrialStatusBanner is hidden:**
- It only shows for `trialing` or `active` subscription status
- Hidden for `canceled`, `past_due`, etc.

### Issue: Pricing cards appear in multiple places

**This is intentional and correct:**
1. **Homepage** (`/`): Shows pricing to visitors
2. **Signup** (`/sign-up`): For tier selection during registration
3. **Upgrade Modal**: For existing users to change plans

All three use consistent pricing:
- Basic: £99/month
- Standard: £249/month
- Premium: £449+/month

## 📊 Subscription Flow Diagram

```
User Clicks "Upgrade" 
    ↓
UpgradeModal Opens
    ↓
Selects Tier → POST /api/stripe/create-checkout-session
    ↓
Redirects to Stripe Checkout
    ↓
User Completes Payment
    ↓
┌─────────────────────────────────────┐
│ TWO UPDATE PATHS (redundant safety) │
└─────────────────────────────────────┘
         ↓                    ↓
    Webhook Path        Immediate Path
         ↓                    ↓
POST /api/stripe/webhooks   POST /api/test/update-plan
         ↓                    ↓
Updates organization    Updates organization
         ↓                    ↓
    ┌────────────────────────┘
    ↓
Redirects to /checkout/success?tier=standard
    ↓
Shows success page → Redirect to /?upgrade=success
    ↓
Homepage refreshes tier (with retry logic)
    ↓
✅ Displays new tier in pricing cards
```

## 🧪 Testing Instructions

### Test 1: Check Current Organization Status
1. Open browser console
2. Go to: `https://your-domain.com/api/debug/check-organization`
3. Verify response shows correct tier

### Test 2: Manually Update Tier (For Testing)
```javascript
// In browser console
fetch('/api/debug/fix-subscription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tier: 'standard' })
})
.then(r => r.json())
.then(console.log)
```

### Test 3: Verify Homepage Refresh
1. Go to homepage: `https://your-domain.com/?upgrade=success`
2. Open browser console
3. Look for logs:
   ```
   [UPGRADE SUCCESS] Detected upgrade success
   [TIER REFRESH] Attempt 1/4
   [TIER DEBUG] Setting tier to: standard
   ```

### Test 4: Check Dashboard Display
1. Go to dashboard
2. Look for TrialStatusBanner at top
3. Should show: "Standard Plan - Free Trial Active" or "Standard Plan (Active)"

### Test 5: Test Full Upgrade Flow (Production)
1. Login as test user on basic plan
2. Go to homepage → Click "Upgrade Now"
3. Select Standard → Complete Stripe checkout (use test card: 4242 4242 4242 4242)
4. Verify redirect to success page
5. Click "Go to Dashboard" or "Back to Home"
6. Verify plan shows as "Standard" on homepage
7. Verify dashboard shows "Standard Plan" in TrialStatusBanner

## 🔧 Environment Variables to Verify

```bash
# Required for subscription system
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... or pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Required price IDs
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_STANDARD_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
```

## 📝 Quick Fix Commands

### Immediately update plan to Standard:
```bash
curl -X POST https://your-domain.com/api/debug/fix-subscription \
  -H "Content-Type: application/json" \
  -H "Cookie: $(document.cookie)" \
  -d '{"tier": "standard"}'
```

### Check organization status:
```bash
curl https://your-domain.com/api/debug/check-organization
```

### Force tier refresh on homepage:
```javascript
// In browser console on homepage
window.location.href = '/?upgrade=success'
```

## 🚨 Common Issues & Solutions

### Issue: "Organization not found"
**Solution**: Call `/api/organization/ensure` to create organization:
```javascript
fetch('/api/organization/ensure', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

### Issue: Webhook not firing
**Solutions**:
1. Check Stripe Dashboard → Webhooks → View logs
2. Verify webhook secret matches `STRIPE_WEBHOOK_SECRET` env var
3. Test webhook from Stripe Dashboard "Send test webhook"
4. Use immediate update fallback in checkout success page (already implemented)

### Issue: Homepage shows old tier
**Solutions**:
1. Hard refresh: Cmd/Ctrl + Shift + R
2. Check organization in database
3. Manually trigger refresh: Go to `/?upgrade=success`
4. Use debug endpoint to manually update tier

## ✨ Summary

The subscription display system now has:
1. ✅ Enhanced webhook logging for debugging
2. ✅ Immediate tier update on checkout success (backup)
3. ✅ Homepage refresh with retry logic
4. ✅ Dashboard plan display via TrialStatusBanner
5. ✅ Debug endpoints for manual intervention
6. ✅ Comprehensive troubleshooting guide

**Most likely issue**: Stripe webhook is configured to use the wrong endpoint. 
**Quick fix**: Update webhook to `/api/stripe/webhooks` or use debug endpoint to manually update tier.

