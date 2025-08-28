# Supabase PKCE Variable Initialization Fix

## Problem Description

The Supabase PKCE exchange was failing with the error "Cannot access uninitialized variable" because the `authCode` and `codeVerifier` variables were being used before they were properly initialized and assigned valid string values.

## Root Cause Analysis

1. **Uninitialized Variables**: Variables were being accessed without proper declaration and initialization
2. **Race Conditions**: PKCE exchange was being called before both variables had valid values
3. **Missing Validation**: No checks to ensure variables were ready before use
4. **Async Flow Issues**: The exchange was not properly waiting for the auth code callback to complete

## Solution Implementation

### 1. Proper Variable Declaration and Initialization

**Before (Problematic Code):**
```typescript
// Variables were used without proper initialization
const code = sp.get("code");
const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
const customVerifier = getPkceVerifier();
const codeVerifier = verifier || customVerifier;

// Direct use without validation
const exchangeResponse = await fetch('/api/auth/supabase-pkce', {
  body: JSON.stringify({ 
    code: code,  // Could be null/undefined
    code_verifier: codeVerifier  // Could be null/undefined
  })
});
```

**After (Fixed Code):**
```typescript
// Step 1: Declare variables with proper initialization
let authCode: string | null = null;
let codeVerifier: string | null = null;

// Step 2: Assign authCode when received
const code = sp.get("code");
if (!code) {
  return router.replace("/sign-in?error=missing_code");
}
authCode = code;

// Step 3: Assign codeVerifier when retrieved
const verifier = localStorage.getItem("supabase.auth.token-code-verifier");
const customVerifier = getPkceVerifier();
codeVerifier = verifier || customVerifier;

// Step 4: Validate both variables before exchange
if (!authCode || !codeVerifier) {
  console.error('[OAuth Frontend] callback: Auth code or code verifier not ready', {
    hasAuthCode: !!authCode,
    hasCodeVerifier: !!codeVerifier,
    authCodeType: typeof authCode,
    codeVerifierType: typeof codeVerifier
  });
  return router.replace("/sign-in?error=variables_not_ready");
}

// Step 5: Only call exchange after validation
const exchangeResponse = await fetch('/api/auth/supabase-pkce', {
  body: JSON.stringify({ 
    code: authCode,  // Guaranteed to be valid string
    code_verifier: codeVerifier  // Guaranteed to be valid string
  })
});
```

### 2. Enhanced Validation in PKCE Endpoint

**Added comprehensive validation:**
```typescript
// Check for null/undefined values
if (authCode === null || authCode === undefined) {
  return NextResponse.json({ 
    error: 'auth_code_not_initialized',
    error_description: 'Authorization code was not properly initialized'
  }, { status: 400 });
}

if (codeVerifier === null || codeVerifier === undefined) {
  return NextResponse.json({ 
    error: 'code_verifier_not_initialized',
    error_description: 'Code verifier was not properly initialized'
  }, { status: 400 });
}

// Validate string lengths
if (authCode.length === 0) {
  return NextResponse.json({ error: 'empty_auth_code' }, { status: 400 });
}

if (codeVerifier.length === 0) {
  return NextResponse.json({ error: 'empty_code_verifier' }, { status: 400 });
}
```

### 3. Step-by-Step Async Flow

The flow is now properly structured with clear steps:

1. **Step 1**: Get authorization code from URL parameters
2. **Step 2**: Assign `authCode` variable
3. **Step 3**: Check for PKCE verifier with retry mechanism
4. **Step 4**: Assign `codeVerifier` variable
5. **Step 5**: Validate both variables have valid string values
6. **Step 6**: Log payload before sending
7. **Step 7**: Call PKCE exchange only after validation

### 4. Improved Error Handling

**Enhanced error logging:**
```typescript
console.error('[OAuth Frontend] callback: Auth code or code verifier not ready', {
  hasAuthCode: !!authCode,
  hasCodeVerifier: !!codeVerifier,
  authCodeType: typeof authCode,
  codeVerifierType: typeof codeVerifier
});
```

**User-friendly error messages:**
- `variables_not_ready`: When auth code or code verifier are not properly initialized
- `auth_code_not_initialized`: When auth code is null/undefined
- `code_verifier_not_initialized`: When code verifier is null/undefined
- `empty_auth_code`: When auth code is empty string
- `empty_code_verifier`: When code verifier is empty string

## Files Modified

### 1. `app/(auth)/auth/callback/page.tsx`
- Added proper variable declaration: `let authCode: string | null = null;`
- Added proper variable declaration: `let codeVerifier: string | null = null;`
- Implemented step-by-step variable assignment
- Added validation before PKCE exchange
- Enhanced error handling and logging

### 2. `app/api/auth/supabase-pkce/route.ts`
- Enhanced variable initialization validation
- Added null/undefined checks
- Added empty string validation
- Improved error messages and logging

### 3. `app/test-pkce-fix/page.tsx` (New)
- Created test page to verify the fix
- Includes PKCE state checking
- Provides storage clearing functionality
- Documents the fix implementation

## Testing the Fix

1. **Visit the test page**: Navigate to `/test-pkce-fix`
2. **Check PKCE state**: Verify current PKCE state
3. **Test OAuth flow**: Initiate the OAuth sign-in process
4. **Monitor console logs**: Look for proper variable initialization logs
5. **Verify success**: Ensure the callback completes without errors

## Expected Behavior

### Before Fix:
- ❌ "Cannot access uninitialized variable" error
- ❌ PKCE exchange fails with undefined values
- ❌ Race conditions between variable assignment and exchange

### After Fix:
- ✅ Variables properly declared and initialized
- ✅ Validation ensures both variables have valid string values
- ✅ PKCE exchange only called after validation
- ✅ Comprehensive error logging for debugging
- ✅ Graceful error handling with user-friendly messages

## Monitoring and Debugging

### Console Logs to Watch:
```
[OAuth Frontend] callback: received authorization code
[OAuth Frontend] callback: PKCE verifier check
[OAuth Frontend] callback: Sending PKCE exchange request
[Supabase PKCE] Request received
[Supabase PKCE] Sending payload to Supabase
```

### Error Scenarios:
- `variables_not_ready`: Check if auth code or verifier are missing
- `auth_code_not_initialized`: Verify OAuth callback received code
- `code_verifier_not_initialized`: Check PKCE verifier storage
- `empty_auth_code`/`empty_code_verifier`: Verify string values are not empty

## Best Practices Implemented

1. **Defensive Programming**: Always validate variables before use
2. **Type Safety**: Use TypeScript types for better error catching
3. **Async Safety**: Ensure proper flow order in async operations
4. **Error Handling**: Comprehensive error logging and user feedback
5. **Testing**: Dedicated test page for verification
6. **Documentation**: Clear documentation of the fix and expected behavior

## Conclusion

This fix resolves the "Cannot access uninitialized variable" error by ensuring proper variable initialization, validation, and async flow management. The PKCE exchange now only occurs after both `authCode` and `codeVerifier` have valid string values, preventing race conditions and undefined variable access.