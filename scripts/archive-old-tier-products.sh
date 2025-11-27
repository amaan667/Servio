#!/bin/bash
# Archive products with old tier metadata (basic, standard, premium)
# Keeps only products with tier=starter, pro, or enterprise

set -e

echo "🔍 Finding products with old tier metadata..."
echo ""

# Get all active products
ALL_ACTIVE=$(stripe products list --limit 100 --active | jq -r '.data[] | "\(.id)|\(.name)|\(.metadata.tier // "none")|\(.active)"')

ARCHIVE_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

echo "🗑️  Archiving products with old tier metadata (basic, standard, premium)..."
echo ""

while IFS='|' read -r id name tier active; do
  # Skip products with correct tier metadata
  if [ "$tier" = "starter" ] || [ "$tier" = "pro" ] || [ "$tier" = "enterprise" ]; then
    continue
  fi
  
  # Skip if already inactive
  if [ "$active" = "false" ]; then
    continue
  fi
  
  echo "   Archiving: $name ($id) - tier: $tier"
  
  # Try to archive
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
      ((ERROR_COUNT++))
    fi
  fi
  echo ""
done <<< "$ALL_ACTIVE"

echo "✨ Summary:"
echo "   Archived: $ARCHIVE_COUNT"
echo "   Skipped (in use): $SKIP_COUNT"
echo "   Errors: $ERROR_COUNT"
echo ""

# Verify final state
echo "🔍 Verifying final state..."
FINAL_ACTIVE=$(stripe products list --limit 100 --active | jq '.data[] | select(.metadata.tier == "starter" or .metadata.tier == "pro" or .metadata.tier == "enterprise")')
FINAL_COUNT=$(echo "$FINAL_ACTIVE" | jq -s 'length')

echo ""
echo "📊 Active products with correct tier metadata: $FINAL_COUNT"
echo ""
echo "$FINAL_ACTIVE" | jq -r '{name, tier: .metadata.tier, id}'

if [ "$FINAL_COUNT" -eq 3 ]; then
  echo ""
  echo "✅ Perfect! Exactly 3 active products with correct tier metadata"
else
  echo ""
  echo "⚠️  Warning: $FINAL_COUNT products remain (expected 3)"
  if [ "$SKIP_COUNT" -gt 0 ]; then
    echo "   $SKIP_COUNT products couldn't be archived (have active subscriptions)"
    echo "   These will remain active until subscriptions end"
  fi
fi

