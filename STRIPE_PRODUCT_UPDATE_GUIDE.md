# Stripe Product Update Guide

## Issue
Stripe products currently use old tier names (Basic, Standard, Premium) instead of the new tier names (Starter, Pro, Enterprise). This causes tier mismatches between Stripe billing portal and the application settings.

## Solution

### 1. Update Product Names in Stripe Dashboard

For each product in Stripe, update the name to match the new tier system:

- **Basic** → **Starter**
- **Standard** → **Pro**  
- **Premium** → **Enterprise**

### 2. Add Metadata to Products

For each product, add metadata to ensure correct tier detection:

1. Go to Stripe Dashboard → Products
2. Click on each product
3. Scroll to "Metadata" section
4. Add metadata key: `tier` with value:
   - `starter` for Starter plan
   - `pro` for Pro plan
   - `enterprise` for Enterprise plan

### 3. Add Metadata to Prices (Optional but Recommended)

For each price, also add metadata:

1. Go to the product's pricing section
2. Click on each price
3. Add metadata key: `tier` with the same value as the product

### 4. Verify Tier Sync

After updating Stripe:
1. The application will automatically normalize old tier names (basic→starter, standard→pro, premium→enterprise)
2. When users click "Change Plan", the tier is synced from Stripe before opening the portal
3. Webhooks will update the database with the correct tier from Stripe

## Code Normalization

The code already handles normalization of old tier names:
- `basic` → `starter`
- `standard` → `pro`
- `premium` → `enterprise`

However, updating Stripe product names ensures consistency across the platform.

## Testing

After updating Stripe:
1. Click "Change Plan" in settings
2. Verify the tier shown in Stripe portal matches the tier in settings
3. Make a plan change in Stripe
4. Verify the tier updates correctly in the application

