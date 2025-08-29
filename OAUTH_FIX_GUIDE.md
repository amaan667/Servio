# OAuth Fix Guide - Resolving "exchange_failed" Error

## Problem
You're getting a "Sign-in failed while finalizing session" error with `exchange_failed` when trying to sign in with Google OAuth.

## Root Cause
The `exchange_failed` error typically occurs when:
1. OAuth redirect URLs don't match between your app and Supabase/Google configuration
2. Missing or incorrect environment variables
3. PKCE flow issues with token exchange

## Solution Steps

### 1. Update Supabase OAuth Settings

Go to your Supabase project dashboard:
1. Navigate to **Authentication** → **URL Configuration**
2. Add these redirect URLs:
   ```
   https://servio-production.up.railway.app/auth/callback
   https://servio-production.up.railway.app/api/auth/callback
   ```
3. Save the changes

### 2. Update Google OAuth Configuration

In your Google Cloud Console:
1. Go to **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID
3. Add these authorized redirect URIs:
   ```
   https://servio-production.up.railway.app/auth/callback
   https://servio-production.up.railway.app/api/auth/callback
   ```
4. Save the changes

### 3. Verify Environment Variables

Ensure these environment variables are set in Railway:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (should be `https://servio-production.up.railway.app`)

### 4. Test the Fix

1. Visit `/test-oauth` to test the OAuth configuration
2. Try signing in with Google again
3. Check browser console for debug logs

## What Was Fixed

1. **Created missing OAuth callback page** (`/app/auth/callback/page.tsx`)
2. **Updated OAuth redirect flow** to use direct callback instead of API redirect
3. **Added comprehensive error handling** and debugging
4. **Created test page** to verify OAuth configuration

## Debug Information

The app now includes extensive logging with `[AUTH DEBUG]` prefixes to help diagnose issues:
- OAuth initiation
- Callback processing
- Token exchange
- Session validation

## Common Issues

1. **CORS errors**: Make sure redirect URLs are exactly matched
2. **Environment variables**: Verify all required variables are set
3. **PKCE flow**: The app now properly handles PKCE token exchange
4. **Session persistence**: Improved session handling after OAuth

## Next Steps

After updating the configurations:
1. Deploy the changes
2. Test the OAuth flow
3. Monitor the debug logs for any remaining issues
