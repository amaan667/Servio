# Tier System Guide - Pulling Tiers Directly from Stripe

## Overview

The platform uses **3 tiers**: `starter`, `pro`, `enterprise`. **Stripe is the single source of truth** - tiers are pulled directly from Stripe product/price metadata without any normalization.

## Single Source of Truth

**Stripe Product/Price Metadata** - `metadata.tier`:
- Must be set to exactly: `"starter"`, `"pro"`, or `"enterprise"`
- No normalization - we use what Stripe says directly
- `getTierFromStripeSubscription()` reads from Stripe and returns the raw tier value

## Tier Flow

### 1. **Stripe → Database (Webhooks)**
```
Stripe Product (metadata.tier = "starter"/"pro"/"enterprise")
    ↓
Webhook: customer.subscription.updated
    ↓
getTierFromStripeSubscription() reads from product metadata
    ↓
Returns raw tier from Stripe (no normalization)
    ↓
Database: organizations.subscription_tier = "starter"/"pro"/"enterprise"
```

### 2. **Database → UI (Display)**
```
Database: organizations.subscription_tier
    ↓
(Should match Stripe exactly - no normalization)
    ↓
BillingSection / PlanCard displays tier
    ↓
Features shown based on TIER_LIMITS[tier]
```

### 3. **User Action → Stripe (Plan Change)**
```
User clicks "Change Plan"
    ↓
BillingSection calls /api/stripe/create-portal-session
    ↓
Stripe Portal opens
    ↓
User changes plan in Stripe
    ↓
Webhook: customer.subscription.updated
    ↓
Tier synced to database (see flow #1)
```

## Key Files

### Tier Extraction
- **`lib/stripe-tier-helper.ts`** - `getTierFromStripeSubscription()` - Pulls tier directly from Stripe
- **`lib/tier-restrictions.ts`** - `getUserTier()` - Reads from DB (should match Stripe)

### Tier Display
- **`lib/pricing-tiers.ts`** - `PRICING_TIERS` - Tier definitions (starter, pro, enterprise)
- **`components/settings/BillingSection.tsx`** - Uses `normalizeTier()` + `TIER_LIMITS`
- **`app/select-plan/page.tsx`** - Uses `normalizeTier()` + `PRICING_TIERS`

### Tier Validation
- **`app/api/stripe/create-checkout-session/route.ts`** - Validates tier is one of starter/pro/enterprise
- **`app/api/stripe/webhooks/route.ts`** - Stores raw tier from Stripe (no normalization)

## Ensuring Correct Tiers

### ✅ What's Already Done

1. **Checkout Session** - Validates tier is one of starter/pro/enterprise
2. **Webhooks** - Stores raw tier from Stripe (no normalization)
3. **BillingSection** - Uses tier directly from database (should match Stripe)
4. **Select Plan Page** - Uses tier directly from database (should match Stripe)
5. **getUserTier()** - Validates tier when reading from database
6. **Settings Page** - Syncs tier directly from Stripe (no normalization)

### ✅ Tier Validation

All tier inputs are validated:
- Checkout session: `if (!["starter", "pro", "enterprise"].includes(tier))`
- Plan selection: Uses `PRICING_TIERS` which only has starter/pro/enterprise
- Billing section: Uses `TIER_LIMITS` which only has starter/pro/enterprise
- `getTierFromStripeSubscription()`: Validates tier from Stripe metadata

## How Plan Changes Work

1. **User clicks "Change Plan"** → Opens Stripe billing portal
2. **User selects new plan in Stripe** → Stripe updates subscription
3. **Webhook fires** → `customer.subscription.updated`
4. **System reads tier** → From product metadata using `getTierFromStripeSubscription()`
5. **Tier stored directly** → No normalization - uses what Stripe says
6. **Database updated** → `organizations.subscription_tier` updated with raw Stripe tier
7. **UI updates** → Next page load shows new tier

## Stripe Product Setup

Your 3 Stripe products must have:
- **Product metadata**: `tier = "starter"`, `"pro"`, or `"enterprise"`
- **Price metadata**: `tier = "starter"`, `"pro"`, or `"enterprise"` (optional but recommended)
- **Product names**: "Starter Plan", "Pro Plan", "Enterprise Plan"

## Environment Variables

Set these in Railway (price IDs, not product IDs):
```
STRIPE_BASIC_PRICE_ID=price_1SWz3u4yBiJHDhu149xX42zU  # Starter
STRIPE_STANDARD_PRICE_ID=price_1SWz3v4yBiJHDhu1pOsJ2Rb9  # Pro
STRIPE_PREMIUM_PRICE_ID=price_1SWz3v4yBiJHDhu16CXIxBV0  # Enterprise
```

## Testing

To verify tiers are correct:

1. **Check database**: `SELECT subscription_tier FROM organizations;` (should only see starter/pro/enterprise)
2. **Check Stripe**: Products should have `metadata.tier` set
3. **Test plan change**: Change plan in Stripe portal, verify database updates
4. **Check UI**: Billing section should show correct tier and features

## Summary

✅ **Tier extraction happens at:**
- Stripe webhooks (subscription updates) - uses `getTierFromStripeSubscription()`
- Settings page sync - uses `getTierFromStripeSubscription()`
- Subscription refresh - uses `getTierFromStripeSubscription()`

✅ **Tier validation happens at:**
- Checkout session creation - validates tier is one of starter/pro/enterprise
- `getTierFromStripeSubscription()` - validates tier from Stripe metadata
- Database reads - validates tier when reading from database

✅ **Single source of truth:**
- **Stripe product/price metadata.tier** - must be exactly "starter", "pro", or "enterprise"
- `getTierFromStripeSubscription()` - reads directly from Stripe (no normalization)
- Database stores what Stripe says - no transformation

The platform pulls tiers directly from Stripe without normalization. Stripe product/price metadata must be set correctly.

