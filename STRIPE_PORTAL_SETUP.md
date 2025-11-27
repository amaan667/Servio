# Stripe Billing Portal Setup

## What Should Happen When Clicking "Change Plan"

When a user clicks "Change Plan" in the billing section, they should be redirected to the **Stripe Customer Portal** which shows:

1. **Current Active Subscription** - Their current plan (Starter, Pro, or Enterprise)
2. **Plan Switching Options** - Ability to upgrade/downgrade to other tiers
3. **Payment Methods** - Manage credit cards
4. **Billing History** - View past invoices

## Current Issue

The portal is showing **duplicate subscriptions**:
- ✅ **Enterprise Plan** (active) - This is correct
- ❌ **Premium Plan** (scheduled to cancel) - This is an old subscription that needs to be removed

## Solution

### Step 1: Cancel the Old Subscription

The old "Premium Plan" subscription (`sub_1SGp8K4yBiJHDhu18648A8eI`) is already scheduled to cancel on Dec 24, 2025, but it's still showing as active. You should cancel it immediately:

```bash
stripe subscriptions cancel sub_1SGp8K4yBiJHDhu18648A8eI
```

### Step 2: Configure Portal in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Settings → Customer Portal
2. Enable **"Allow customers to switch plans"**
3. Under **"Available products"**, select only:
   - Starter Plan (`prod_TTwxr7H3qXEwB2`)
   - Pro Plan (`prod_TTwxJorNKjIzlN`)
   - Enterprise Plan (`prod_TTwxJPoKvj18CU`)
4. Save changes

### Step 3: Verify Portal Behavior

After configuration, when users click "Change Plan":
- They should see only their **current active subscription**
- They should be able to **upgrade/downgrade** to Starter, Pro, or Enterprise
- They should **not** see old/cancelled subscriptions

## Expected Behavior

✅ **Correct**: User sees their current plan and can switch to other tiers
❌ **Incorrect**: User sees duplicate subscriptions or old tier names

The portal is working correctly - it's just showing what's actually in Stripe. Once the old subscription is cancelled and the portal is configured, it will show the correct behavior.

