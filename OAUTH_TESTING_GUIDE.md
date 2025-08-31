# 🔐 Google OAuth Testing Guide

This guide helps you thoroughly test the Google OAuth flow and identify any issues.

## 🚀 Quick Test

1. **Visit**: `http://localhost:3000/sign-in`
2. **Open Developer Tools** (F12)
3. **Go to Console tab**
4. **Click "Sign in with Google"**
5. **Watch for `[AUTH DEBUG]` logs**
6. **Complete OAuth flow**

## 🔧 Pre-Test Checklist

### Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL` is set
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set

### Supabase Configuration
- [ ] Google OAuth provider is enabled
- [ ] Redirect URL is configured: `http://localhost:3000/auth/callback`
- [ ] Authorized domains include: `localhost:3000`

## 🧪 Automated Tests

### Run Node.js Test
```bash
node test-google-oauth.js
```

### Open Browser Test
Open `test-oauth-browser.html` in your browser

## 🔍 Debug Tools

### 1. Auth Debug Page
- **URL**: `http://localhost:3000/debug-auth`
- **Purpose**: Shows current auth state and environment info

### 2. Callback Debug Page
- **URL**: `http://localhost:3000/auth/callback-debug`
- **Purpose**: Shows PKCE state and OAuth parameters

### 3. API Debug Endpoint
- **URL**: `http://localhost:3000/api/auth/debug`
- **Purpose**: Server-side auth state and configuration

## 📋 Step-by-Step Manual Test

### Step 1: Environment Check
1. Visit `http://localhost:3000/api/auth/debug`
2. Verify:
   - `NODE_ENV` is `development`
   - All environment variables are `Set`
   - No auth errors

### Step 2: Sign-In Page Test
1. Visit `http://localhost:3000/sign-in`
2. Verify:
   - Page loads without errors
   - Google sign-in button is visible
   - No console errors

### Step 3: OAuth Initiation Test
1. Open browser developer tools (F12)
2. Go to Console tab
3. Click "Sign in with Google"
4. Watch for logs:
   ```
   [AUTH DEBUG] Starting Google OAuth sign in
   [AUTH DEBUG] Redirect URL: http://localhost:3000/auth/callback
   [AUTH DEBUG] OAuth sign in initiated successfully
   [AUTH DEBUG] Redirecting to OAuth URL
   ```

### Step 4: OAuth Redirect Test
1. Should redirect to Google OAuth page
2. Verify URL contains:
   - `accounts.google.com`
   - `response_type=code`
   - `redirect_uri=http://localhost:3000/auth/callback`

### Step 5: Callback Test
1. Complete Google OAuth flow
2. Should redirect to `http://localhost:3000/auth/callback`
3. Watch for logs:
   ```
   [AUTH CALLBACK] Processing OAuth callback
   [AUTH CALLBACK] Exchanging code for session
   [AUTH CALLBACK] Session created successfully, redirecting to dashboard
   ```

### Step 6: Session Verification
1. Should redirect to dashboard
2. Visit `http://localhost:3000/api/auth/debug`
3. Verify:
   - `hasUser: true`
   - `hasSession: true`
   - No auth errors

## 🚨 Common Issues & Solutions

### Issue 1: "Auth session missing!" Error
**Cause**: Development environment using production URLs
**Solution**: ✅ Fixed - Now uses localhost URLs in development

### Issue 2: Refresh Token Error
**Cause**: Incorrect redirect URLs or OAuth configuration
**Solution**: ✅ Fixed - Updated OAuth parameters and URLs

### Issue 3: OAuth Redirect Loop
**Cause**: Mismatched redirect URLs
**Solution**: ✅ Fixed - Consistent localhost URLs

### Issue 4: "No authorization code found"
**Cause**: OAuth flow not completing properly
**Solution**: Check Supabase OAuth configuration

## 🔧 Troubleshooting

### If OAuth doesn't start:
1. Check browser console for errors
2. Verify Supabase configuration
3. Check environment variables

### If callback fails:
1. Check callback page logs
2. Verify redirect URL in Supabase
3. Check for CORS issues

### If session isn't created:
1. Check exchange logs
2. Verify Supabase service role key
3. Check database permissions

## 📊 Expected Logs

### Successful Flow:
```
[AUTH DEBUG] Starting Google OAuth sign in
[AUTH DEBUG] Redirect URL: http://localhost:3000/auth/callback
[AUTH DEBUG] OAuth sign in initiated successfully
[AUTH DEBUG] Redirecting to OAuth URL
[AUTH CALLBACK] Processing OAuth callback
[AUTH CALLBACK] Exchanging code for session
[AUTH CALLBACK] Session created successfully, redirecting to dashboard
```

### Error Flow:
```
[AUTH DEBUG] OAuth sign in error: [error message]
[AUTH CALLBACK] Exchange error: [error message]
[AUTH CALLBACK] No session returned from exchange
```

## 🎯 Success Criteria

- [ ] Sign-in page loads without errors
- [ ] OAuth flow initiates successfully
- [ ] Google OAuth page opens
- [ ] Callback processes without errors
- [ ] Session is created successfully
- [ ] User is redirected to dashboard
- [ ] No refresh token errors

## 📞 Support

If you encounter issues:
1. Check the debug tools above
2. Review the console logs
3. Verify Supabase configuration
4. Test with the automated scripts
