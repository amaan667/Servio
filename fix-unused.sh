#!/bin/bash
echo "🔧 Fixing unused variables..."

# Fix getSupabaseClient in app/admin/migrate-ai/page.tsx
sed -i '' 's/getSupabaseClient/_getSupabaseClient/g' app/admin/migrate-ai/page.tsx

# Fix insertedItems and insertedHotspots
find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "insertedItems\|insertedHotspots" | while read f; do
  sed -i '' 's/insertedItems/_insertedItems/g' "$f"
  sed -i '' 's/insertedHotspots/_insertedHotspots/g' "$f"
done

# Fix recentError
find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "recentError" | while read f; do
  sed -i '' 's/recentError/_recentError/g' "$f"
done

# Fix item_count and total_amount
find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "item_count\|total_amount" | while read f; do
  sed -i '' 's/const { item_count }/const { item_count: _item_count }/g' "$f"
  sed -i '' 's/const { total_amount }/const { total_amount: _total_amount }/g' "$f"
done

# Fix Stripe import
find app -name "*.tsx" -o -name "*.ts" | xargs grep -l "import.*Stripe.*from.*stripe" | while read f; do
  sed -i '' 's/import { Stripe }/import { Stripe as _Stripe }/g' "$f"
done

echo "✅ Done"
