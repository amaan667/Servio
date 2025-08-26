# 🚨 EMERGENCY FIXES - SESSION STATE + DATABASE RLS

## 🔥 CRITICAL ISSUES IDENTIFIED

### 1. Session State Issue
**Problem**: Website shows "Sign Out" even when no one is signed in
**Root Cause**: Stale session data in localStorage and incorrect session state management

### 2. Database RLS Issues ("No rows returned")
**Problem**: Venue creation fails with "No rows returned" errors
**Root Cause**: Incorrect RLS policies blocking legitimate database operations

## 🛠️ EMERGENCY FIXES APPLIED

### Session State Fix

**File**: `components/SessionStateFix.tsx`
- ✅ Automatically clears stale session data
- ✅ Validates session expiration
- ✅ Removes invalid session tokens
- ✅ Integrated into main layout

**File**: `app/layout.tsx`
- ✅ Added SessionStateFix component
- ✅ Runs on every page load

### Database RLS Fix

**File**: `scripts/emergency-database-fix.sql`
- ✅ Forcefully drops all existing problematic policies
- ✅ Creates correct owner-based RLS policies
- ✅ Enables automatic venue creation triggers
- ✅ Grants proper permissions

## 📋 IMMEDIATE ACTION REQUIRED

### Step 1: Apply Database Fixes (CRITICAL)

**Option A: Supabase Dashboard**
1. Go to your Supabase project
2. Navigate to SQL Editor
3. Copy and paste the contents of `scripts/emergency-database-fix.sql`
4. Click "Run" to execute

**Option B: Command Line**
```bash
# Set your database URL
export SUPABASE_DB_URL="postgresql://postgres:[password]@[host]:5432/postgres"

# Run the emergency fix script
./scripts/emergency-deploy.sh
```

### Step 2: Clear Browser Data

```javascript
// In browser console (F12)
localStorage.clear();
sessionStorage.clear();
```

### Step 3: Test the Fixes

1. **Test Session State**:
   - Load website
   - Verify "Sign Out" is NOT showing when not signed in
   - Check browser console for `[SESSION FIX]` messages

2. **Test OAuth Flow**:
   - Try Google sign-in
   - Verify no infinite loops
   - Check redirect to dashboard

3. **Test Venue Creation**:
   - Sign up new user with Google
   - Verify venue is automatically created
   - Check venue appears in dashboard

## 🔧 WHAT WAS FIXED

### Session State Issues
- ✅ Stale localStorage cleanup
- ✅ Session expiration validation
- ✅ Invalid session removal
- ✅ Proper session state management

### RLS Policy Issues
- ✅ **Venues Table**: Owner-based access control
- ✅ **Menu Items Table**: Venue owner-based access
- ✅ **Orders Table**: Proper read/write permissions
- ✅ **Users Table**: Self-access only
- ✅ **Menu Upload Logs**: Venue owner-based access

### Before (Broken):
```sql
-- Wrong - too restrictive
CREATE POLICY "Venues are insertable by authenticated users" 
ON venues FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');
```

### After (Fixed):
```sql
-- Correct - owner-based
CREATE POLICY "Users can insert their own venues" 
ON venues FOR INSERT 
WITH CHECK (auth.uid() = owner_id);
```

## 🐛 DEBUGGING

### Check Session State:
```javascript
// In browser console
console.log('Session state:', await supabase.auth.getSession());
```

### Check RLS Policies:
```sql
-- In Supabase SQL Editor
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

### Monitor Logs:
- Browser console: `[SESSION FIX]` and `[AUTH DEBUG]` messages
- Supabase logs: RLS policy violations

## 🚨 TROUBLESHOOTING

### Still Showing "Sign Out":
1. Clear all browser data completely
2. Try incognito/private browsing
3. Check `[SESSION FIX]` console messages
4. Verify SessionStateFix component is loaded

### Still Getting "No rows returned":
1. Verify database fixes were applied in Supabase
2. Check RLS policies in Supabase dashboard
3. Run emergency database fix script again
4. Check Supabase logs for policy violations

### OAuth Still Looping:
1. Clear localStorage completely
2. Check Supabase OAuth configuration
3. Verify redirect URLs are correct
4. Test with fresh browser session

## ✅ SUCCESS CRITERIA

- ✅ **Session State Fixed**: "Sign Out" only shows when actually signed in
- ✅ **RLS Policies Fixed**: No more "No rows returned" errors
- ✅ **OAuth Flow Fixed**: No infinite loops
- ✅ **Venue Creation Fixed**: Automatic venue creation for new users
- ✅ **Comprehensive Logging**: Debug information for troubleshooting

## 📞 SUPPORT

If issues persist:
1. Check browser console for debug messages
2. Review Supabase logs for errors
3. Verify all SQL scripts executed successfully
4. Test with fresh browser session
5. Check the emergency deployment script output

## 🚀 DEPLOYMENT STATUS

**Code Changes**: ✅ Applied
**Database Changes**: ⚠️ Requires manual application in Supabase
**Session State Fix**: ✅ Active
**RLS Policy Fix**: ⚠️ Requires database script execution

**Next Step**: Run the emergency database fix script in Supabase SQL Editor