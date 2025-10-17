#!/bin/bash

# Fix supabaseAdmin variable references in API routes
# This script adds `const supabaseAdmin = createAdminClient();` at the start of functions

files=(
  "app/api/debug/orders/route.ts"
  "app/api/stripe/webhook/route.ts"
  "app/api/orders/[orderId]/route.ts"
  "app/api/orders/by-session/[sessionId]/route.ts"
  "app/api/orders/by-session/route.ts"
  "app/api/orders/recent-paid/route.ts"
  "app/api/setup-kds/route.ts"
  "app/api/migrations/kds/route.ts"
  "app/api/migrations/kds-trigger/route.ts"
  "app/api/kds/backfill-all/route.ts"
  "app/api/kds/backfill/route.ts"
  "app/api/kds/status/route.ts"
  "app/api/kds/tickets/route.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if file already has the fix
    if ! grep -q "const supabaseAdmin = createAdminClient()" "$file"; then
      # Find the first function (GET, POST, PUT, DELETE) and add the line after the opening brace
      sed -i '' '/^export async function (GET\|POST\|PUT\|DELETE)/,/^{/{
        /^{/a\
    const supabaseAdmin = createAdminClient();
      }' "$file"
      echo "Fixed: $file"
    else
      echo "Already fixed: $file"
    fi
  fi
done

echo "Done!"

