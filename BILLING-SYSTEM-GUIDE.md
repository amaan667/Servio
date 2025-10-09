# 💳 Servio Billing System Guide

## Overview

Servio now has a **complete subscription billing system** with:
- ✅ 3 pricing tiers (Basic, Standard, Premium)
- ✅ Grandfathered accounts (existing users)
- ✅ Multi-venue support
- ✅ Stripe integration
- ✅ 14-day free trial for new signups

---

## 🏆 Grandfathered Accounts

### What It Means
**Existing accounts** (created before this billing system) are **grandfathered** with:
- ♾️ Unlimited access to ALL features
- 💰 No payment required
- 🚀 All premium capabilities enabled

This includes accounts like **"Cafe Nur"** and any other existing venues.

### How It Works
When the multi-venue migration runs, all existing venues are:
1. Automatically assigned to organizations
2. Marked as `is_grandfathered = true`
3. Given `subscription_tier = 'grandfathered'`
4. Have unlimited access to all features

### Verification
Check if your account is grandfathered:
```sql
SELECT name, subscription_tier, is_grandfathered 
FROM organizations 
WHERE owner_id = 'your-user-id';
```

---

## 📊 Pricing Tiers (New Accounts)

### Basic - £99/month
**Limits:**
- 10 tables max
- 50 menu items max
- 3 staff members max
- 1 venue only

**Features:**
- ✅ QR ordering
- ✅ Order tracking
- ✅ Basic analytics
- ❌ No KDS
- ❌ No inventory
- ❌ No AI assistant

### Standard - £249/month (Most Popular)
**Limits:**
- 20 tables max
- 200 menu items max
- 10 staff members max
- 1 venue only

**Features:**
- ✅ Everything in Basic, plus:
- ✅ Kitchen Display System (KDS)
- ✅ Inventory management
- ✅ Advanced analytics
- ✅ Priority support
- ❌ No AI assistant
- ❌ No multi-venue

### Premium - £449+/month
**Limits:**
- ♾️ Unlimited tables
- ♾️ Unlimited menu items
- ♾️ Unlimited staff
- ♾️ Unlimited venues

**Features:**
- ✅ Everything in Standard, plus:
- ✅ AI Assistant (all 13 tools)
- ✅ Multi-venue management
- ✅ Custom integrations
- ✅ Dedicated account manager

---

## 🔧 Setup Instructions

### 1. Run Database Migrations

```bash
# Run migrations in order:
psql $DATABASE_URL < migrations/multi-venue-schema.sql
psql $DATABASE_URL < migrations/inventory-auto-deduction.sql
```

### 2. Configure Stripe

#### Create Products in Stripe Dashboard
1. Go to https://dashboard.stripe.com/products
2. Click "Add product"
3. Create three products:

**Product 1: Basic**
- Name: "Servio Basic"
- Price: £99.00 GBP/month
- Billing period: Monthly
- Trial period: 14 days
- Copy Price ID → `STRIPE_BASIC_PRICE_ID`

**Product 2: Standard**
- Name: "Servio Standard"  
- Price: £249.00 GBP/month
- Billing period: Monthly
- Trial period: 14 days
- Copy Price ID → `STRIPE_STANDARD_PRICE_ID`

**Product 3: Premium**
- Name: "Servio Premium"
- Price: £449.00 GBP/month
- Billing period: Monthly
- Trial period: 14 days
- Copy Price ID → `STRIPE_PREMIUM_PRICE_ID`

#### Set Up Webhooks
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-production-domain.com/api/stripe/webhooks`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy webhook signing secret → `STRIPE_WEBHOOK_SECRET`

### 3. Add Environment Variables

Add to Railway or your deployment platform:

```bash
# Stripe Keys
STRIPE_SECRET_KEY=sk_live_...  # Use sk_test_ for testing
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...  # Use pk_test_ for testing
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from step 2)
STRIPE_BASIC_PRICE_ID=price_1ABC...
STRIPE_STANDARD_PRICE_ID=price_1XYZ...
STRIPE_PREMIUM_PRICE_ID=price_1DEF...
```

### 4. Test the Flow

#### Test Existing Account (Grandfathered)
1. Sign in to existing account (e.g., Cafe Nur)
2. Go to Billing page
3. Should see: "Grandfathered - Legacy account with unlimited access"
4. Verify all features accessible

#### Test New Account (Requires Payment)
1. Create new account via `/api/signup/with-subscription`
2. Select tier (Basic/Standard/Premium)
3. Redirects to Stripe Checkout
4. Use test card: `4242 4242 4242 4242`
5. After checkout, redirected to dashboard
6. Features restricted based on tier

---

## 🎯 User Flows

### Existing User (Grandfathered)
```
1. Sign in → See all features
2. Visit /billing → See grandfathered status
3. No payment required
4. All features enabled
```

### New User (Free Trial)
```
1. Sign up → Choose tier
2. Enter payment info → Start 14-day trial
3. Use full features during trial
4. After 14 days → Payment charged
5. If payment fails → Downgrade to Basic (limited)
```

### Upgrading User
```
1. Click "Upgrade" in navbar
2. See UpgradeModal with 3 tiers
3. Select higher tier
4. Redirects to Stripe Checkout
5. Webhook updates tier immediately
6. Features unlock automatically
```

---

## 🔒 Tier Enforcement

### How It Works

#### API Routes
Tier limits are checked in API routes before creating resources:

```typescript
// Example: Menu items
const tierCheck = await enforceResourceLimit(
  user.id, 
  venueId, 
  "maxMenuItems", 
  newTotal
);

if (!tierCheck.allowed) {
  return tierCheck.response; // 403 with upgrade message
}
```

#### Features
Feature access is checked before allowing access:

```typescript
// Example: AI Assistant
const access = await checkFeatureAccess(user.id, "aiAssistant");

if (!access.allowed) {
  return { error: "Upgrade to Premium for AI Assistant" };
}
```

### Bypassing Limits
Grandfathered accounts automatically bypass all checks:
```typescript
if (org?.is_grandfathered) {
  return { allowed: true, tier: "grandfathered" };
}
```

---

## 📱 UI Components

### Upgrade Modal
Shows pricing tiers and redirects to Stripe:
```tsx
<UpgradeModal 
  open={showUpgradeModal}
  onOpenChange={setShowUpgradeModal}
  currentTier="basic"
  organizationId={orgId}
/>
```

### Billing Page
Full billing dashboard at `/dashboard/[venueId]/billing`:
- Current plan status
- Usage vs limits
- Stripe billing portal link
- Feature access matrix

### Venue Switcher
Multi-venue dropdown in navbar:
```tsx
<VenueSwitcher currentVenueId={venueId} />
```

---

## 🧪 Testing

### Test Cards (Stripe)
```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient Funds: 4000 0000 0000 9995
```

### Test Scenarios

**1. Grandfathered Account**
```bash
# Check organization
curl /api/tier-check -d '{"venueId":"venue-123","action":"access","resource":"aiAssistant"}'
# Expected: { allowed: true, tier: "grandfathered" }
```

**2. Basic Tier Limit**
```bash
# Try creating 11th table
curl /api/tables -d '{"venue_id":"venue-abc","label":"Table 11"}'
# Expected: 403 with "Limit reached: 10/10 tables"
```

**3. Feature Access**
```bash
# Try accessing KDS on Basic tier
curl /api/kds/tickets?venueId=venue-abc
# Expected: 403 with "This feature requires Standard tier"
```

---

## 🚨 Troubleshooting

### "Organization not found"
- Run multi-venue migration
- Check user has organization in DB

### "Stripe price ID not found"
- Verify price IDs in environment variables
- Check products exist in Stripe dashboard

### "Webhook signature invalid"
- Verify webhook secret matches Stripe
- Check endpoint URL is correct

### "Grandfathered account can't access billing"
- This is expected - grandfathered accounts don't have Stripe customers
- No billing management needed

---

## 📈 Business Metrics to Track

### Key Metrics
1. **MRR** (Monthly Recurring Revenue)
2. **Trial conversion rate** (trials → paid)
3. **Churn rate** (cancellations per month)
4. **Upgrade rate** (Basic → Standard → Premium)
5. **ARPU** (Average Revenue Per User)

### Where to See Them
- Stripe Dashboard → Analytics
- `/api/tier-check` → Organization distribution
- `subscription_history` table → Tier changes

---

## 🎉 Launch Checklist

- [ ] Run multi-venue migration
- [ ] Create Stripe products
- [ ] Add price IDs to env vars
- [ ] Set up webhooks
- [ ] Test grandfathered account
- [ ] Test new signup flow
- [ ] Test upgrade flow
- [ ] Monitor webhook delivery
- [ ] Set up billing alerts
- [ ] Document for team

---

## 💡 Future Enhancements

### Phase 1 (Next Week)
- Email notifications for trial ending
- Usage approaching limit warnings
- Automatic downgrade on payment failure

### Phase 2 (Next Month)
- Annual billing (save 20%)
- Add-ons (extra venues, extra tables)
- Enterprise tier for chains

### Phase 3 (Quarter)
- Reseller/agency pricing
- White-label options
- API access tier

---

**Your existing account (Cafe Nur) is safe with unlimited access! 🎉**

