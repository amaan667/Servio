#!/bin/bash
# Setup Stripe Product and Price Metadata
# This ensures tier is always correct and plan changes work smoothly

set -e

echo "🔧 Setting up Stripe product and price metadata..."
echo ""

# Your 3 products
STARTER_PRODUCT="prod_TTwxr7H3qXEwB2"
PRO_PRODUCT="prod_TTwxJorNKjIzlN"
ENTERPRISE_PRODUCT="prod_TTwxJPoKvj18CU"

# Function to setup product metadata
setup_product() {
  local product_id=$1
  local tier=$2
  local name=$3
  
  echo "📦 Setting up $name ($tier)..."
  
  # Update product metadata
  echo "   Setting product metadata: tier=$tier"
  stripe products update $product_id -d "metadata[tier]=$tier" > /dev/null
  
  # Get all active prices for this product
  prices=$(stripe prices list --product $product_id --active --limit 10 | jq -r '.data[].id')
  
  for price_id in $prices; do
    echo "   Setting price metadata: $price_id -> tier=$tier"
    stripe prices update $price_id -d "metadata[tier]=$tier" > /dev/null
  done
  
  echo "   ✅ Done"
  echo ""
}

# Setup each product
setup_product "$STARTER_PRODUCT" "starter" "Starter Plan"
setup_product "$PRO_PRODUCT" "pro" "Pro Plan"
setup_product "$ENTERPRISE_PRODUCT" "enterprise" "Enterprise Plan"

echo "✨ Metadata setup complete!"
echo ""
echo "📝 Verification:"
echo ""

# Verify products
for product_id in "$STARTER_PRODUCT" "$PRO_PRODUCT" "$ENTERPRISE_PRODUCT"; do
  product_info=$(stripe products retrieve $product_id)
  name=$(echo "$product_info" | jq -r '.name')
  tier=$(echo "$product_info" | jq -r '.metadata.tier')
  echo "   $name: tier=$tier"
  
  # Check prices
  prices=$(stripe prices list --product $product_id --active --limit 1)
  price_id=$(echo "$prices" | jq -r '.data[0].id')
  price_tier=$(echo "$prices" | jq -r '.data[0].metadata.tier // "not set"')
  echo "      Price: $price_id (tier=$price_tier)"
done

echo ""
echo "✅ All products and prices now have tier metadata!"
echo ""
echo "📋 How it works:"
echo "   1. When checkout is created, organization_id is set in session metadata"
echo "   2. When subscription is created, organization_id is in subscription metadata"
echo "   3. Tier is read from product/price metadata (most reliable)"
echo "   4. Webhooks automatically sync tier changes to your database"
echo "   5. When users change plans in Stripe portal, webhooks update the organization"

