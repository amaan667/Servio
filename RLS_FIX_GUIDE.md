# Row Level Security (RLS) Fix Guide

## Problem
Your Supabase database has **503 Service Unavailable** errors because:
- ✅ RLS policies exist on tables
- ❌ RLS is not enabled on the tables
- ❌ This creates a security conflict causing PostgREST to reject requests

## Solution 1: Automatic Fix (Recommended)
Run the automated fix script:
```bash
node scripts/fix-rls.js
```

## Solution 2: Manual Fix in Supabase Dashboard

### Step 1: Open Supabase Dashboard
1. Go to [supabase.com](https://supabase.com)
2. Sign in and select your project
3. Go to **SQL Editor** in the left sidebar

### Step 2: Run These SQL Commands
```sql
-- Enable RLS on all affected tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Verify RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('orders', 'users', 'menu_items', 'order_items')
ORDER BY tablename;
```

### Step 3: Check Results
You should see `rowsecurity: true` for all tables.

## What This Fixes
- ✅ Resolves 503 Service Unavailable errors
- ✅ Allows your dashboard to load orders properly
- ✅ Maintains security through existing RLS policies
- ✅ Fixes the infinite loading issue

## After the Fix
1. Refresh your dashboard page
2. Orders should now load properly
3. The service status indicator should show "Service Healthy"
4. No more 503 errors in the console

## Why This Happened
This is a common Supabase configuration issue where:
1. RLS policies are created for security
2. But RLS isn't enabled on the tables
3. PostgREST (Supabase's API) rejects requests due to this mismatch
4. Results in 503 errors instead of proper data access

## Security Note
Enabling RLS doesn't make your data less secure - it actually enables the security policies you already have in place.
