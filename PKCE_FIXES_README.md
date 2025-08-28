# Supabase PKCE Login Flow Fixes

This document outlines the fixes implemented to resolve the Supabase PKCE login flow issues.

## Problem Summary

The original implementation had the following issues:

1. **JSON Unmarshal Error**: Supabase logs showed `"json: cannot unmarshal object into Go struct field PKCEGrantParams.auth_code of type string"`
2. **Missing Code Error**: Supabase logs showed `"missing_code"`
3. **Conflicting OAuth Flows**: The code had both Supabase's built-in PKCE flow and a custom Google OAuth flow running simultaneously

## Root Cause

The main issue was that the custom Google OAuth callback handler was sending the wrong JSON structure to Supabase's `/auth/v1/token` endpoint. Supabase expects a flat JSON structure with specific field names:

```json
{
  "auth_code": "<string from Google redirect>",
  "code_verifier": "<string PKCE verifier>"
}
```

But the custom implementation was sending nested objects or using incorrect field names.

## Fixes Implemented

### 1. Removed Conflicting Custom Google OAuth Flow

**Files Modified:**
- `app/(auth)/auth/callback/page.tsx`
- `lib/auth/signin.ts`

**Changes:**
- Removed the call to `handleGoogleCallback()` in the callback page
- Simplified the custom Google callback handler to be a no-op
- Let Supabase's built-in PKCE flow handle the token exchange

### 2. Created Proper Supabase PKCE Endpoint

**New File:** `app/api/auth/supabase-pkce/route.ts`

**Features:**
- Sends the exact JSON structure Supabase expects
- Uses correct field names: `auth_code` and `code_verifier`
- Includes comprehensive logging for debugging
- Validates parameter types and presence
- Returns Supabase's response directly

**Key Implementation:**
```typescript
const payload = {
  auth_code: authCode,
  code_verifier: codeVerifier,
};

const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
  },
  body: JSON.stringify(payload),
});
```

### 3. Updated Callback Handler

**File Modified:** `app/(auth)/auth/callback/page.tsx`

**Changes:**
- Added proper PKCE verifier retrieval from both localStorage and sessionStorage
- Implemented the new Supabase PKCE endpoint call
- Added comprehensive logging before and after the exchange
- Enhanced error handling with specific error messages

**Key Implementation:**
```typescript
// Get PKCE verifier from storage
const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
const customVerifier = getPkceVerifier();
const codeVerifier = verifier || customVerifier;

// Call our custom Supabase PKCE endpoint
const exchangeResponse = await fetch('/api/auth/supabase-pkce', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    auth_code: code, 
    code_verifier: codeVerifier 
  })
});
```

### 4. Removed Old Google Callback API

**File Deleted:** `app/api/auth/google/callback/route.ts`

This endpoint was causing conflicts and is no longer needed since we're using Supabase's built-in PKCE flow.

### 5. Added Testing Tools

**New File:** `app/test-pkce/page.tsx`

A comprehensive testing page that allows:
- Testing the PKCE flow
- Checking current PKCE state
- Clearing storage
- Viewing detailed logs

## Requirements Met

✅ **Flat JSON Body**: The new endpoint sends a flat JSON structure, not nested objects

✅ **Correct Field Names**: Uses `auth_code` and `code_verifier` as required

✅ **String Types**: Both fields are validated as strings before sending

✅ **Comprehensive Logging**: Added logging before the request to confirm payload shape

✅ **Error Logging**: Added error logging if auth_code or code_verifier is missing

✅ **Correct Headers**: Uses `Content-Type: application/json` and proper Supabase headers

✅ **Response Logging**: Returns and logs Supabase's response for debugging

## Testing the Fix

1. **Visit the test page**: Navigate to `/test-pkce` to test the PKCE flow
2. **Check logs**: Monitor browser console and server logs for detailed debugging information
3. **Verify success**: The Google sign-up should now work without the JSON unmarshal error

## Expected Flow

1. User clicks "Sign in with Google"
2. PKCE verifier and challenge are generated
3. User is redirected to Google OAuth
4. Google redirects back with authorization code
5. Callback page retrieves PKCE verifier from storage
6. Custom endpoint sends correct JSON to Supabase
7. Supabase exchanges code for session
8. User is authenticated and redirected to dashboard

## Monitoring

To monitor the fix:

1. **Browser Console**: Look for `[Supabase PKCE]` and `[OAuth Frontend]` logs
2. **Server Logs**: Check for the new endpoint logs
3. **Supabase Logs**: Should no longer show JSON unmarshal errors
4. **Network Tab**: Verify the correct JSON payload is sent to `/auth/v1/token`

## Troubleshooting

If issues persist:

1. Check that PKCE verifier is properly stored before redirect
2. Verify the JSON payload structure in network requests
3. Ensure Supabase configuration is correct
4. Check for any remaining custom OAuth code that might interfere

The fix ensures that Supabase receives the exact JSON structure it expects, resolving both the unmarshal error and the missing code error.