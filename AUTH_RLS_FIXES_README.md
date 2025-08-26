# Authentication + RLS Policy Fixes

## 🚨 CRITICAL ISSUES FIXED

### 1. Google OAuth Loop
**Problem**: Users stuck in infinite Google account selection
**Root Cause**: PKCE state conflicts and missing session validation

### 2. Venue Creation Failure ("No rows returned")
**Problem**: New users can't access the app due to missing venues
**Root Cause**: **RLS (Row Level Security) policies blocking legitimate database operations**

## 🔍 RLS POLICY ISSUES IDENTIFIED

The "No rows returned" error was caused by **5 RLS policy errors** on these tables:
- `public.orders`
- `public.users` 
- `public.menu_items`
- `public.order_items`
- `public.venues`

### What Was Wrong:
1. **Incorrect Policy Conditions**: Using `auth.role() = 'authenticated'` instead of `auth.uid() = owner_id`
2. **Missing Owner-Based Policies**: Policies didn't check if user owns the resource
3. **Overly Restrictive Policies**: Some policies blocked legitimate operations

## 🛠️ COMPREHENSIVE FIXES

### Database-Level Fixes (CRITICAL)

**File**: `scripts/comprehensive-auth-rls-fixes.sql`

This script fixes:
- ✅ **RLS Policies**: Proper owner-based access control
- ✅ **Auth Triggers**: Automatic venue creation on signup
- ✅ **Profile Creation**: Automatic profile creation
- ✅ **Permissions**: Proper function execution grants

### Code-Level Fixes

**Files Modified**:
- `app/(auth)/auth/callback/page.tsx` - Enhanced venue creation with session validation
- `app/sign-in/signin-form.tsx` - Added session checks and better error handling

## 📋 DEPLOYMENT STEPS

### Step 1: Apply Database Fixes (REQUIRED)

**Option A: Supabase Dashboard**
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `scripts/comprehensive-auth-rls-fixes.sql`
4. Click "Run" to execute

**Option B: Command Line**
```bash
# Set your database URL
export SUPABASE_DB_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Run the comprehensive fix script
psql "$SUPABASE_DB_URL" -f scripts/comprehensive-auth-rls-fixes.sql
```

### Step 2: Verify Supabase Configuration

1. **OAuth Settings**:
   - Go to Authentication > URL Configuration
   - Verify Site URL matches your domain
   - Add `/auth/callback` to Redirect URLs

2. **Google OAuth**:
   - Go to Authentication > Providers
   - Ensure Google is enabled and configured

### Step 3: Test the Fixes

1. **Clear Browser Data**:
   ```javascript
   // In browser console
   localStorage.clear();
   sessionStorage.clear();
   ```

2. **Test OAuth Flow**:
   - Try signing in with Google
   - Verify no infinite loops
   - Check redirect to dashboard

3. **Test Venue Creation**:
   - Sign up new user with Google
   - Verify venue is automatically created
   - Check venue appears in dashboard

## 🔧 RLS POLICY DETAILS

### Before (Broken):
```sql
-- This was wrong - too restrictive
CREATE POLICY "Venues are insertable by authenticated users" 
ON venues FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
```

### After (Fixed):
```sql
-- This is correct - owner-based
CREATE POLICY "Users can insert their own venues" 
ON venues FOR INSERT 
WITH CHECK (auth.uid() = owner_id);
```

### Key Policy Changes:

1. **Venues Table**:
   - ✅ Public read access (for ordering)
   - ✅ Owner-based write access
   - ✅ Proper owner_id validation

2. **Menu Items Table**:
   - ✅ Public read access (for ordering)
   - ✅ Venue owner-based write access
   - ✅ Proper venue ownership validation

3. **Orders Table**:
   - ✅ Venue owner read access
   - ✅ Public insert access (for customers)
   - ✅ Venue owner update access

4. **Users Table**:
   - ✅ Self-access only
   - ✅ Proper user ID validation

## 🐛 DEBUGGING

### Check RLS Policies:
```sql
-- View all current policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

### Test Venue Creation:
```sql
-- Test as authenticated user (replace with actual user ID)
SELECT auth.uid(); -- Check current user ID

-- Try to insert a venue
INSERT INTO venues (venue_id, name, owner_id, business_type, created_at, updated_at)
VALUES ('test-venue', 'Test Venue', auth.uid(), 'Restaurant', NOW(), NOW());
```

### Browser Console Debug:
Look for these debug messages:
- `[AUTH DEBUG]` - OAuth flow logs
- `[AUTH DEBUG] ✅ User authenticated, proceeding with venue creation`
- `[AUTH DEBUG] ✅ Created venue for user: venue-xxxxx`

## 🚨 COMMON ISSUES & SOLUTIONS

### 1. Still Getting "No rows returned"
**Solution**: Run the comprehensive RLS fix script again
```sql
-- Check if policies were applied
SELECT * FROM pg_policies WHERE tablename = 'venues';
```

### 2. OAuth Still Looping
**Solution**: 
- Clear browser localStorage completely
- Check Supabase redirect URLs configuration
- Verify no multiple Supabase client instances

### 3. Venue Creation Still Failing
**Solution**:
- Ensure user is authenticated before venue creation
- Check RLS policies in Supabase dashboard
- Verify trigger was created successfully

### 4. Permission Errors
**Solution**:
- Ensure RLS is enabled on all tables
- Check that authenticated users can insert venues
- Verify owner_id matches auth.uid()

## 📊 MONITORING

### Key Metrics to Watch:
- OAuth success/failure rates
- Venue creation success rates
- RLS policy violation logs
- User onboarding completion rates

### Supabase Logs:
Check for:
- RLS policy violations
- Function execution errors
- Trigger execution logs

## 🔄 ROLLBACK PLAN

If issues persist:
1. **Disable RLS temporarily**:
   ```sql
   ALTER TABLE venues DISABLE ROW LEVEL SECURITY;
   ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;
   ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
   ```

2. **Remove triggers**:
   ```sql
   DROP TRIGGER IF EXISTS trigger_provision_new_user ON auth.users;
   DROP TRIGGER IF EXISTS trigger_create_profile ON auth.users;
   ```

3. **Use manual venue creation** through complete-profile flow

## ✅ SUCCESS CRITERIA

- ✅ **OAuth Loop Fixed**: Users can sign in without infinite loops
- ✅ **Venue Creation Fixed**: New users get venues automatically
- ✅ **RLS Policies Fixed**: No more "No rows returned" errors
- ✅ **Error Handling**: Proper error messages and graceful failures
- ✅ **Logging**: Comprehensive debug information
- ✅ **Documentation**: Clear instructions for deployment and troubleshooting

## 📞 SUPPORT

If you encounter issues:
1. Check browser console for `[AUTH DEBUG]` messages
2. Review Supabase logs for RLS policy violations
3. Verify all SQL scripts executed successfully
4. Test with a fresh browser session
5. Check the comprehensive test results from the SQL script