# Stripe Metadata Setup Guide

## How Stripe Links to Your Platform

### 1. **Price IDs vs Organization ID**

- **Price IDs** (required): Used to create checkout sessions - tells Stripe which product/price to charge
  - Set as environment variables: `STRIPE_BASIC_PRICE_ID`, `STRIPE_STANDARD_PRICE_ID`, `STRIPE_PREMIUM_PRICE_ID`
  - These are the **price IDs** from your 3 products, not product IDs

- **Organization ID** (automatic): Used to link Stripe subscriptions back to your platform
  - Automatically set in checkout session metadata
  - Automatically set in subscription metadata
  - Webhooks use this to update the correct organization

### 2. **Metadata Flow**

```
User clicks "Change Plan"
    ↓
Checkout session created with:
  - price: <price_id> (from env vars)
  - metadata.organization_id: <org_id>
  - metadata.tier: <tier>
    ↓
User completes checkout
    ↓
Webhook: checkout.session.completed
  - Reads metadata.organization_id
  - Reads tier from product/price metadata (most reliable)
  - Updates organization in database
    ↓
Webhook: customer.subscription.updated
  - Reads metadata.organization_id
  - Reads tier from product/price metadata
  - Syncs tier to database
```

### 3. **Tier Detection Priority**

The system reads tier in this order (most reliable first):

1. **Product metadata.tier** ← Most reliable (set by you)
2. **Price metadata.tier** ← Backup (set by you)
3. **Product name parsing** ← Fallback (Basic→starter, Standard→pro, Premium→enterprise)
4. **Subscription metadata.tier** ← From checkout session

### 4. **Plan Changes**

When users change plans in Stripe billing portal:

1. Stripe updates the subscription to a different price
2. Webhook `customer.subscription.updated` fires
3. System reads the new price's product metadata.tier
4. Organization tier is automatically updated in database
5. User sees updated tier in settings

### 5. **Required Setup**

✅ **Products must have:**
- `metadata.tier = "starter"`, `"pro"`, or `"enterprise"`
- Correct names: "Starter Plan", "Pro Plan", "Enterprise Plan"

✅ **Prices should have:**
- `metadata.tier = "starter"`, `"pro"`, or `"enterprise"` (optional but recommended)

✅ **Environment variables:**
- `STRIPE_BASIC_PRICE_ID` = starter price ID
- `STRIPE_STANDARD_PRICE_ID` = pro price ID  
- `STRIPE_PREMIUM_PRICE_ID` = enterprise price ID

### 6. **Verification**

Run this to verify metadata is set correctly:

```bash
# Check products
stripe products list --limit 100 | jq '.data[] | select(.active == true) | {name, tier: .metadata.tier, id}'

# Check prices
stripe prices list --limit 100 | jq '.data[] | select(.active == true) | {id, product, tier: .metadata.tier}'
```

### 7. **Why This Works**

- **Organization ID** links Stripe → Your Platform (one-way: Stripe knows about your org)
- **Product/Price metadata.tier** ensures tier is always correct (read from Stripe, not stored)
- **Webhooks** automatically sync changes (real-time updates)
- **Price IDs** are only needed for creating checkout sessions (which product to charge)

This setup ensures:
- ✅ Tier is always correct (read from Stripe, not stored)
- ✅ Plan changes work automatically (webhooks handle it)
- ✅ No manual syncing needed (automatic via webhooks)
- ✅ Single source of truth (Stripe product metadata)

