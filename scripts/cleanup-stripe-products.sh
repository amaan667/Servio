#!/bin/bash
# Cleanup Stripe Products - Keep only starter, pro, enterprise
# This script archives all products except the 3 with tier metadata

set -e

echo "🔍 Finding products with tier metadata (starter, pro, enterprise)..."
echo ""

# Find products to keep
KEEP_PRODUCTS=$(stripe products list --limit 100 | jq -r '.data[] | select(.metadata.tier == "starter" or .metadata.tier == "pro" or .metadata.tier == "enterprise") | .id' | sort -u)

if [ -z "$KEEP_PRODUCTS" ]; then
  echo "❌ No products found with tier metadata (starter, pro, enterprise)"
  echo "   Please add metadata.tier to your products first"
  exit 1
fi

echo "✅ Products to KEEP:"
for prod_id in $KEEP_PRODUCTS; do
  product_info=$(stripe products retrieve $prod_id)
  name=$(echo "$product_info" | jq -r '.name')
  tier=$(echo "$product_info" | jq -r '.metadata.tier')
  active=$(echo "$product_info" | jq -r '.active')
  echo "   - $name (tier: $tier, id: $prod_id, active: $active)"
done

KEEP_COUNT=$(echo "$KEEP_PRODUCTS" | wc -l | tr -d ' ')
echo ""
echo "📊 Found $KEEP_COUNT products to keep"
echo ""

# Get all products
echo "📦 Fetching all products..."
ALL_PRODUCTS=$(stripe products list --limit 100 | jq -r '.data[] | .id')

# Find products to archive (not in keep list)
ARCHIVE_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

echo "🗑️  Archiving products without tier metadata..."
echo ""

for prod_id in $ALL_PRODUCTS; do
  # Check if this product should be kept
  if echo "$KEEP_PRODUCTS" | grep -q "^$prod_id$"; then
    continue
  fi
  
  # Get product info
  product_info=$(stripe products retrieve $prod_id 2>/dev/null)
  if [ $? -ne 0 ]; then
    ((ERROR_COUNT++))
    continue
  fi
  
  name=$(echo "$product_info" | jq -r '.name')
  active=$(echo "$product_info" | jq -r '.active')
  
  # Skip if already inactive
  if [ "$active" = "false" ]; then
    ((SKIP_COUNT++))
    continue
  fi
  
  # Try to archive
  echo "   Archiving: $name ($prod_id)"
  result=$(stripe products update $prod_id -d "active=false" 2>&1)
  
  if [ $? -eq 0 ]; then
    ((ARCHIVE_COUNT++))
    echo "   ✅ Archived"
  else
    if echo "$result" | grep -q "in use"; then
      echo "   ⚠️  Skipped (product in use)"
      ((SKIP_COUNT++))
    else
      echo "   ❌ Error: $result"
      ((ERROR_COUNT++))
    fi
  fi
  echo ""
done

echo "✨ Summary:"
echo "   Archived: $ARCHIVE_COUNT"
echo "   Skipped (in use or already inactive): $SKIP_COUNT"
echo "   Errors: $ERROR_COUNT"
echo ""

# Verify final state
echo "🔍 Verifying final state..."
ACTIVE_PRODUCTS=$(stripe products list --limit 100 | jq '.data[] | select(.active == true)')
ACTIVE_COUNT=$(echo "$ACTIVE_PRODUCTS" | jq -s 'length')

echo ""
echo "📊 Active products remaining: $ACTIVE_COUNT"
echo ""
echo "$ACTIVE_PRODUCTS" | jq -r '{name, tier: .metadata.tier, id}'

if [ "$ACTIVE_COUNT" -le 3 ]; then
  echo ""
  echo "✅ Success! Only $ACTIVE_COUNT active products remain"
else
  echo ""
  echo "⚠️  Warning: More than 3 active products remain"
  echo "   Some products may have active subscriptions and cannot be archived"
fi
