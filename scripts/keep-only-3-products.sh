#!/bin/bash
# Keep only 3 products - one for each tier (starter, pro, enterprise)
# Archives all duplicates

set -e

echo "🔍 Finding products with tier metadata..."
echo ""

# Get all products with tier metadata, sorted by created date (newest first)
ALL_TIERED=$(stripe products list --limit 100 | jq -r '.data[] | select(.metadata.tier == "starter" or .metadata.tier == "pro" or .metadata.tier == "enterprise") | "\(.created)|\(.id)|\(.metadata.tier)|\(.name)"' | sort -t'|' -k1 -rn)

# Keep only the newest product for each tier
KEEP_STARTER=""
KEEP_PRO=""
KEEP_ENTERPRISE=""

while IFS='|' read -r created id tier name; do
  if [ "$tier" = "starter" ] && [ -z "$KEEP_STARTER" ]; then
    KEEP_STARTER="$id"
    echo "✅ Keeping STARTER: $name ($id)"
  elif [ "$tier" = "pro" ] && [ -z "$KEEP_PRO" ]; then
    KEEP_PRO="$id"
    echo "✅ Keeping PRO: $name ($id)"
  elif [ "$tier" = "enterprise" ] && [ -z "$KEEP_ENTERPRISE" ]; then
    KEEP_ENTERPRISE="$id"
    echo "✅ Keeping ENTERPRISE: $name ($id)"
  fi
done <<< "$ALL_TIERED"

echo ""
echo "📊 Products to keep:"
echo "   Starter: $KEEP_STARTER"
echo "   Pro: $KEEP_PRO"
echo "   Enterprise: $KEEP_ENTERPRISE"
echo ""

if [ -z "$KEEP_STARTER" ] || [ -z "$KEEP_PRO" ] || [ -z "$KEEP_ENTERPRISE" ]; then
  echo "❌ Missing one or more tier products!"
  exit 1
fi

# Archive all other products with tier metadata
ARCHIVE_COUNT=0
SKIP_COUNT=0

echo "🗑️  Archiving duplicate products..."
echo ""

while IFS='|' read -r created id tier name; do
  # Skip the ones we're keeping
  if [ "$id" = "$KEEP_STARTER" ] || [ "$id" = "$KEEP_PRO" ] || [ "$id" = "$KEEP_ENTERPRISE" ]; then
    continue
  fi
  
  echo "   Archiving duplicate: $name ($id) - tier: $tier"
  result=$(stripe products update $id -d "active=false" 2>&1)
  
  if [ $? -eq 0 ]; then
    ((ARCHIVE_COUNT++))
    echo "   ✅ Archived"
  else
    if echo "$result" | grep -q "in use"; then
      echo "   ⚠️  Skipped (product in use - has active subscriptions)"
      ((SKIP_COUNT++))
    else
      echo "   ❌ Error: $result"
    fi
  fi
  echo ""
done <<< "$ALL_TIERED"

echo "✨ Summary:"
echo "   Archived duplicates: $ARCHIVE_COUNT"
echo "   Skipped (in use): $SKIP_COUNT"
echo ""

# Verify final state
echo "🔍 Verifying final state..."
ACTIVE_PRODUCTS=$(stripe products list --limit 100 | jq '.data[] | select(.active == true)')
ACTIVE_COUNT=$(echo "$ACTIVE_PRODUCTS" | jq -s 'length')

echo ""
echo "📊 Active products remaining: $ACTIVE_COUNT"
echo ""
echo "$ACTIVE_PRODUCTS" | jq -r '{name, tier: .metadata.tier, id}'

if [ "$ACTIVE_COUNT" -eq 3 ]; then
  echo ""
  echo "✅ Perfect! Exactly 3 active products remain"
  echo ""
  echo "📝 Next steps:"
  echo "   1. Get the price IDs for these products:"
  for prod_id in "$KEEP_STARTER" "$KEEP_PRO" "$KEEP_ENTERPRISE"; do
    tier=$(stripe products retrieve $prod_id | jq -r '.metadata.tier')
    price_id=$(stripe prices list --product $prod_id --active --limit 1 | jq -r '.data[0].id')
    echo "      $tier: $price_id"
  done
  echo ""
  echo "   2. Set these as environment variables:"
  echo "      STRIPE_BASIC_PRICE_ID=<starter price id>"
  echo "      STRIPE_STANDARD_PRICE_ID=<pro price id>"
  echo "      STRIPE_PREMIUM_PRICE_ID=<enterprise price id>"
elif [ "$ACTIVE_COUNT" -gt 3 ]; then
  echo ""
  echo "⚠️  Warning: $ACTIVE_COUNT active products remain (expected 3)"
  echo "   Some products may have active subscriptions and cannot be archived"
else
  echo ""
  echo "⚠️  Warning: Only $ACTIVE_COUNT active products remain (expected 3)"
fi

