#!/bin/bash

# Script to update API routes to use Authorization header instead of cookies
# This ensures consistent authentication across all feature pages

echo "🔐 Updating API routes to use Authorization header authentication..."

# List of API routes that need updating (excluding organization/ensure which needs special handling)
API_ROUTES=(
  "app/api/kds/tickets/bulk-update/route.ts"
  "app/api/kds/tickets/route.ts"
  "app/api/kds/status/route.ts"
  "app/api/tables/[tableId]/route.ts"
  "app/api/feedback/list/route.ts"
  "app/api/dashboard/orders/one/route.ts"
  "app/api/venues/update-reset-time/route.ts"
  "app/api/ai-assistant/conversations/route.ts"
)

echo "Found ${#API_ROUTES[@]} API routes to update"

# Print the pattern that should be used
cat << 'EOF'

📋 PATTERN FOR ALL API ROUTES:

Server-side (API routes):
```ts
import { authenticateRequest, verifyVenueAccess } from "@/lib/api-auth";

export async function GET(req: Request) {
  // 1. Authenticate using Authorization header
  const auth = await authenticateRequest(req);
  if (!auth.success || !auth.user || !auth.supabase) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  
  const { user, supabase } = auth;
  
  // 2. Verify venue access if needed
  const access = await verifyVenueAccess(supabase, user.id, venueId);
  if (!access.hasAccess) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  
  // 3. Use supabase client for queries
  const { data } = await supabase.from('table').select('*');
}
```

Client-side (feature pages):
```ts
import { apiClient } from '@/lib/api-client';

// Automatically includes Authorization header
const response = await apiClient.get('/api/endpoint', { params: { venueId } });
```

✅ NO COOKIES NEEDED!
✅ Works everywhere (localhost, Railway, Vercel, etc.)
✅ Consistent authentication pattern

EOF

echo ""
echo "To update routes, use this pattern in each file."
echo "Routes that need updating:"
for route in "${API_ROUTES[@]}"; do
  echo "  - $route"
done

